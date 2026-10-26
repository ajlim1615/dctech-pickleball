import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ListChecks, Plus } from "lucide-react";
import { seededRandom } from "@/features/queue/matchmaking";
import { describeRule } from "@/features/matches/utils/scoring";
import type { Navigate } from "../App";
import { Button, ConfirmSheet, ScreenHeader, toast, UndoToast } from "../components/ui";
import { CourtCard } from "../components/CourtCard";
import { PlayerForm } from "../components/PlayerForm";
import { PlayerPicker } from "../components/PlayerPicker";
import { QueuePanel } from "../components/QueuePanel";
import { ResultSheet } from "../components/ResultSheet";
import { loadSessionState, saveSessionState, upsertPlayer } from "../db/repo";
import { createBoardController, type BoardController, type EngineStep } from "../lib/boardController";
import { activeGameOnCourt, checkIn, finishGame, scoringRule, startGame, suggestAll, waitingLine, type Teams } from "../engine/game";
import { endSession, setCourtClosed, swapPlayerInGame } from "../engine/queue";
import { isEngineError, type DeskPlayer, type GameResult, type SessionState } from "../engine/types";
import { keepAwake } from "../io/native";
import { boardStats } from "../lib/boardStats";
import { courtControls, courtPill } from "../lib/courtStatus";
import { liveCtx, playerName, styleLabel } from "../lib/ctx";

type Dialog =
  | { kind: "checkIn" }
  | { kind: "walkIn" }
  | { kind: "finish"; gameId: string }
  | { kind: "swapInGame"; gameId: string; playerId: string }
  | { kind: "swapInSuggestion"; courtId: string; playerId: string }
  | { kind: "end" };

function useMinuteTick() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

export function LiveBoard({ sessionId, navigate }: { sessionId: string; navigate: Navigate }) {
  const [state, setState] = useState<SessionState | null>(null);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [undo, setUndo] = useState<{ label: string; at: number } | null>(null);
  // A rejected score is shown inside the Finish sheet instead of as a toast.
  const [finishError, setFinishError] = useState<{ message: string; key: number } | null>(null);
  // The open Finish sheet's game, so a late result can't land on a sheet it doesn't belong to.
  const finishingId = useRef<string | null>(null);
  // Admin's edits to a court's suggested four, until the game starts.
  const [forced, setForced] = useState<Set<string>>(() => new Set());
  const [drafts, setDrafts] = useState<Record<string, Teams>>({});
  const controller = useRef<BoardController | null>(null);
  const now = useMinuteTick();

  useEffect(() => {
    loadSessionState(sessionId).then((loaded) => {
      controller.current = createBoardController({
        initial: loaded,
        save: saveSessionState,
        onState: (next) => {
          setState(next);
          const label = controller.current?.undoLabel();
          const at = controller.current?.undoStartedAt();
          setUndo(label && at ? { label, at } : null);
        },
        onError: toast,
      });
      setState(loaded);
    }, () => navigate({ name: "home" }));
  }, [sessionId, navigate]);

  useEffect(() => {
    keepAwake(true);
    return () => {
      keepAwake(false);
    };
  }, []);

  /** Runs an engine action on the latest state, saves it, and offers undo for the ones that need it. */
  const apply = useCallback(
    async (label: string, fn: EngineStep, undoable = false) =>
      controller.current ? controller.current.apply(label, fn, undoable) : null,
    []
  );

  async function runUndo() {
    setUndo(null);
    await controller.current?.undo();
  }

  const expireUndo = useCallback(() => setUndo(null), []);

  // Forcing only lasts while the court is still held; derived here, then pruned from state below.
  const { suggestions, stillHeld } = useMemo(() => {
    if (!state) return { suggestions: {}, stillHeld: new Set<string>() };
    const seed = waitingLine(state).map((q) => q.id).join(",");
    const random = (courtId: string) => seededRandom(courtId + seed);
    const plain = suggestAll(state, random);
    const held = new Set([...forced].filter((id) => plain[id] && "hold" in plain[id]));
    return { suggestions: held.size > 0 ? suggestAll(state, random, held) : plain, stillHeld: held };
  }, [state, forced]);

  useEffect(() => {
    if (stillHeld.size !== forced.size) setForced(stillHeld);
  }, [stillHeld, forced]);

  if (!state) return null;
  const s = state;
  const names = (id: string) => playerName(s, id);
  const line = waitingLine(s);
  const stats = boardStats(s);
  const activeIds = new Set(s.queue.filter((q) => q.status === "waiting" || q.status === "playing").map((q) => q.playerId));

  function teamsFor(courtId: string): Teams | null {
    const suggestion = suggestions[courtId];
    if (!suggestion || !("teamA" in suggestion)) return null;
    const draft = drafts[courtId];
    const waiting = new Set(line.map((q) => q.playerId));
    // A draft only stands while everyone in it is still waiting.
    if (draft && [...draft.teamA, ...draft.teamB].every((id) => waiting.has(id))) return draft;
    return suggestion;
  }

  async function start(courtId: string) {
    const teams = teamsFor(courtId);
    if (!teams) return;
    const done = await apply("Game started", (st) => startGame(st, courtId, teams, liveCtx()));
    if (done) {
      setDrafts(({ [courtId]: _, ...rest }) => rest);
      setForced((prev) => {
        const next = new Set(prev);
        next.delete(courtId);
        return next;
      });
    }
  }

  async function addWalkIn(player: DeskPlayer) {
    await upsertPlayer(player);
    setDialog(null);
    const done = await apply("Checked in", (st) => checkIn({ ...st, players: { ...st.players, [player.id]: player } }, [player.id], liveCtx()));
    if (done) toast(`${player.name} checked in.`);
  }

  async function submitFinish(gameId: string, result: GameResult) {
    const court = s.session.courts.find((c) => c.id === s.games.find((g) => g.id === gameId)?.courtId);
    const outcome = await controller.current?.attempt(
      `Game finished on ${court?.name ?? "court"}`,
      (st) => finishGame(st, gameId, result, liveCtx()),
      true
    );
    if (!outcome || finishingId.current !== gameId) return;
    if (isEngineError(outcome)) setFinishError({ message: outcome.error, key: Date.now() });
    else closeDialog();
  }

  function openFinish(gameId: string) {
    finishingId.current = gameId;
    setFinishError(null);
    setDialog({ kind: "finish", gameId });
  }

  function closeDialog() {
    finishingId.current = null;
    setDialog(null);
    setFinishError(null);
  }

  const finishing = dialog?.kind === "finish" ? s.games.find((g) => g.id === dialog.gameId) : undefined;
  const courtName = (courtId: string) => s.session.courts.find((c) => c.id === courtId)?.name ?? "Court";

  return (
    <>
      <ScreenHeader
        title={s.session.title}
        onBack={() => navigate({ name: "home" })}
        meta={
          <>
            {styleLabel(s.session.matchingStyle)} · {describeRule(scoringRule(s.session))} ·{" "}
            <span className="font-mono tabular-nums">{stats.playing}</span> playing ·{" "}
            <span className="font-mono tabular-nums">{stats.inLine}</span> in line ·{" "}
            <span className="font-mono tabular-nums">{stats.games}</span> {stats.games === 1 ? "game" : "games"}
          </>
        }
        actions={
          <>
            <Button variant="ghost" onClick={() => navigate({ name: "summary", sessionId })}>
              <ListChecks size={18} /> Results
            </Button>
            <Button onClick={() => setDialog({ kind: "checkIn" })}>
              <Plus size={18} /> Check in
            </Button>
            <Button variant="ghost" onClick={() => setDialog({ kind: "end" })}>
              End session
            </Button>
          </>
        }
      />

      <main className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-[1fr_300px] lg:overflow-hidden">
        <section className="grid content-start gap-4 p-5 lg:overflow-y-auto xl:grid-cols-2">
          {s.session.courts.map((court) => {
            const game = activeGameOnCourt(s, court.id);
            const teams = game ? null : teamsFor(court.id);
            return (
              <CourtCard
                key={court.id}
                court={court}
                game={game}
                teams={court.closed ? null : teams}
                pill={courtPill(court, game, court.closed ? undefined : suggestions[court.id], now)}
                toggleLabel={courtControls(court, Boolean(game)).toggleLabel}
                names={names}
                onStart={() => start(court.id)}
                onStartAnyway={
                  !court.closed && !game && suggestions[court.id] && "hold" in suggestions[court.id]
                    ? () => setForced((prev) => new Set(prev).add(court.id))
                    : undefined
                }
                onFinish={game ? () => openFinish(game.id) : undefined}
                onSwapHint={() => toast("Tap the player you want to swap out.")}
                onTapPlayer={
                  game
                    ? (playerId) => setDialog({ kind: "swapInGame", gameId: game.id, playerId })
                    : teams && !court.closed
                      ? (playerId) => setDialog({ kind: "swapInSuggestion", courtId: court.id, playerId })
                      : undefined
                }
                onToggleClosed={() =>
                  apply(court.closed ? "Court reopened" : "Court closed", (st) => setCourtClosed(st, court.id, !court.closed, liveCtx()))
                }
              />
            );
          })}
        </section>

        <QueuePanel state={s} line={line} names={names} apply={apply} />
      </main>

      {dialog?.kind === "checkIn" && (
        <PlayerPicker
          title="Check in players"
          multiple
          players={Object.values(s.players)
            .filter((p) => !p.archived && !activeIds.has(p.id))
            .sort((a, b) => a.name.localeCompare(b.name))}
          emptyText="Everyone on the roster is already here. Add a walk-in."
          onAddWalkIn={() => setDialog({ kind: "walkIn" })}
          onPick={async (ids) => {
            setDialog(null);
            const done = await apply("Checked in", (st) => checkIn(st, ids, liveCtx()));
            if (done) toast(`${ids.length} checked in.`);
          }}
          onCancel={closeDialog}
        />
      )}

      {dialog?.kind === "walkIn" && (
        <PlayerForm title="Add walk-in" saveLabel="Add and check in" onSave={addWalkIn} onCancel={closeDialog} />
      )}

      {finishing && (
        <ResultSheet
          title="Finish game"
          session={s.session}
          game={finishing}
          courtName={courtName(finishing.courtId)}
          names={names}
          error={finishError?.message}
          errorKey={finishError?.key}
          onCancel={closeDialog}
          onSubmit={(result) => submitFinish(finishing.id, result)}
        />
      )}

      {dialog?.kind === "swapInGame" && (
        <PlayerPicker
          title={`Swap ${names(dialog.playerId)} for…`}
          players={line.map((q) => s.players[q.playerId])}
          emptyText="Nobody is waiting to swap in."
          onPick={async ([inId]) => {
            setDialog(null);
            await apply("Swapped", (st) => swapPlayerInGame(st, dialog.gameId, dialog.playerId, inId, liveCtx()));
          }}
          onCancel={closeDialog}
        />
      )}

      {dialog?.kind === "swapInSuggestion" &&
        (() => {
          const teams = teamsFor(dialog.courtId);
          if (!teams) return null;
          const shown = new Set(
            Object.entries(suggestions).flatMap(([courtId, sug]) =>
              courtId === dialog.courtId || !("teamA" in sug) ? [] : [...sug.teamA, ...sug.teamB]
            )
          );
          [...teams.teamA, ...teams.teamB].forEach((id) => shown.add(id));
          return (
            <PlayerPicker
              title={`Put someone in for ${names(dialog.playerId)}`}
              players={line.filter((q) => !shown.has(q.playerId)).map((q) => s.players[q.playerId])}
              emptyText="Everyone waiting is already on a court."
              onPick={([inId]) => {
                const swap = (team: string[]) => team.map((id) => (id === dialog.playerId ? inId : id));
                setDrafts((d) => ({ ...d, [dialog.courtId]: { teamA: swap(teams.teamA), teamB: swap(teams.teamB) } }));
                setDialog(null);
              }}
              onCancel={closeDialog}
            />
          );
        })()}

      {dialog?.kind === "end" && (
        <ConfirmSheet
          title="End this session?"
          body="Games still running won't get a result. You can still fix results and export from the summary."
          confirmLabel="End session"
          danger
          onCancel={closeDialog}
          onConfirm={async () => {
            const done = await apply("Session ended", (st) => endSession(st, liveCtx()));
            setDialog(null);
            if (done) navigate({ name: "summary", sessionId });
          }}
        />
      )}

      {undo && <UndoToast key={undo.at} label={undo.label} startedAt={undo.at} onUndo={runUndo} onExpire={expireUndo} />}
    </>
  );
}
