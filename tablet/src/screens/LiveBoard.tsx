import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Coffee, ListChecks, LogOut, UserPlus } from "lucide-react";
import { seededRandom } from "@/features/queue/utils/matchingEngine";
import type { Navigate } from "../App";
import { Button, ScreenHeader, toast, ConfirmSheet, UndoToast } from "../components/ui";

import { CourtCard } from "../components/CourtCard";
import { PlayerForm } from "../components/PlayerForm";
import { PlayerPicker } from "../components/PlayerPicker";
import { ResultSheet } from "../components/ResultSheet";
import { loadSessionState, saveSessionState, upsertPlayer } from "../db/repo";
import { createBoardController, type BoardController, type EngineStep } from "../lib/boardController";
import { activeGameOnCourt, checkIn, finishGame, startGame, suggestAll, waitingLine, type Teams } from "../engine/game";
import { endSession, markLeft, moveInQueue, setBreak, setCourtClosed, swapPlayerInGame } from "../engine/queue";
import type { DeskPlayer, EngineError, SessionState } from "../engine/types";
import { keepAwake } from "../io/native";
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
  // Admin's edits to a court's suggested four, until the game starts.
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
          {
            const label = controller.current?.undoLabel();
            const at = controller.current?.undoStartedAt();
            setUndo(label && at ? { label, at } : null);
          }
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

  const suggestions = useMemo(() => {
    if (!state) return {};
    const seed = waitingLine(state).map((q) => q.id).join(",");
    return suggestAll(state, (courtId) => seededRandom(courtId + seed));
  }, [state]);

  if (!state) return null;
  const s = state;
  const names = (id: string) => playerName(s, id);
  const line = waitingLine(s);
  const onBreak = s.queue.filter((q) => q.status === "on_break");
  const goneHome = s.queue.filter((q) => q.status === "left");
  const activeIds = new Set(s.queue.filter((q) => q.status === "waiting" || q.status === "playing").map((q) => q.playerId));

  function teamsFor(courtId: string): Teams | null {
    const suggestion = suggestions[courtId];
    if (!suggestion || "waitingFor" in suggestion) return null;
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
    if (done) setDrafts(({ [courtId]: _, ...rest }) => rest);
  }

  async function addWalkIn(player: DeskPlayer) {
    await upsertPlayer(player);
    setDialog(null);
    const done = await apply("Checked in", (st) => checkIn({ ...st, players: { ...st.players, [player.id]: player } }, [player.id], liveCtx()));
    if (done) toast(`${player.name} checked in.`);
  }

  const finishing = dialog?.kind === "finish" ? s.games.find((g) => g.id === dialog.gameId) : undefined;

  return (
    <>
      <ScreenHeader
        title={s.session.title}
        onBack={() => navigate({ name: "home" })}
        actions={
          <>
            <span className="mr-2 hidden text-sm text-muted-foreground lg:inline">{styleLabel(s.session.matchingStyle)}</span>
            <Button variant="ghost" onClick={() => navigate({ name: "summary", sessionId })}>
              <ListChecks size={18} /> Results
            </Button>
            <Button onClick={() => setDialog({ kind: "checkIn" })}>
              <UserPlus size={18} /> Check in
            </Button>
            <Button variant="ghost" onClick={() => setDialog({ kind: "end" })}>
              End session
            </Button>
          </>
        }
      />

      <main className="grid flex-1 grid-cols-[1fr_340px] overflow-hidden">
        <section className="grid content-start gap-4 overflow-y-auto p-4 xl:grid-cols-2">
          {s.session.courts.map((court) => {
            const game = activeGameOnCourt(s, court.id);
            const suggestion = suggestions[court.id];
            const teams = teamsFor(court.id);
            const mode = game
              ? { kind: "playing" as const, game, minutes: Math.max(0, Math.floor((now - Date.parse(game.startedAt)) / 60_000)) }
              : court.closed
                ? { kind: "closed" as const }
                : teams
                  ? { kind: "suggested" as const, teams }
                  : { kind: "waiting" as const, waitingFor: suggestion && "waitingFor" in suggestion ? suggestion.waitingFor : 4 };
            return (
              <CourtCard
                key={court.id}
                court={court}
                mode={mode}
                names={names}
                onStart={() => start(court.id)}
                onFinish={game ? () => setDialog({ kind: "finish", gameId: game.id }) : undefined}
                onTapPlayer={
                  game
                    ? (playerId) => setDialog({ kind: "swapInGame", gameId: game.id, playerId })
                    : teams
                      ? (playerId) => setDialog({ kind: "swapInSuggestion", courtId: court.id, playerId })
                      : undefined
                }
                onToggleClosed={() =>
                  apply(court.closed ? "Court reopened" : "Court closed", (st) =>
                    setCourtClosed(st, court.id, !court.closed, liveCtx())
                  )
                }
              />
            );
          })}
        </section>

        <aside className="flex flex-col overflow-y-auto border-l border-border p-4">
          <h2 className="mb-2 flex items-baseline justify-between text-sm font-medium text-muted-foreground">
            <span>In line</span>
            <span className="font-mono tabular-nums">{line.length}</span>
          </h2>
          {line.length === 0 ? (
            <p className="py-6 text-sm text-muted-foreground">Nobody waiting. Check players in to fill the courts.</p>
          ) : (
            <ol className="space-y-1">
              {line.map((q, i) => (
                <li key={q.id} className="flex min-h-11 items-center gap-1 rounded-lg bg-card pl-3">
                  <span className="w-6 font-mono text-sm tabular-nums text-muted-foreground">{i + 1}</span>
                  <span className="flex-1 truncate">{names(q.playerId)}</span>
                  <span className="mr-1 font-mono text-xs tabular-nums text-muted-foreground" title="Games played">
                    {q.gamesPlayed}
                  </span>
                  <IconButton label="Move up" disabled={i === 0} onClick={() => apply("Moved", (st) => moveInQueue(st, q.id, i - 1))}>
                    <ArrowUp size={16} />
                  </IconButton>
                  <IconButton
                    label="Move down"
                    disabled={i === line.length - 1}
                    onClick={() => apply("Moved", (st) => moveInQueue(st, q.id, i + 1))}
                  >
                    <ArrowDown size={16} />
                  </IconButton>
                  <IconButton label="Take a break" onClick={() => apply("On a break", (st) => setBreak(st, q.playerId, true, liveCtx()))}>
                    <Coffee size={16} />
                  </IconButton>
                  <IconButton
                    label="Gone home"
                    onClick={() => apply(`${names(q.playerId)} went home`, (st) => markLeft(st, q.playerId, liveCtx()), true)}
                  >
                    <LogOut size={16} />
                  </IconButton>
                </li>
              ))}
            </ol>
          )}

          <PlayingList state={s} names={names} apply={apply} />

          {onBreak.length > 0 && (
            <>
              <h2 className="mb-2 mt-6 text-sm font-medium text-muted-foreground">On a break</h2>
              <ul className="space-y-1">
                {onBreak.map((q) => (
                  <li key={q.id} className="flex min-h-11 items-center gap-2 rounded-lg bg-card pl-3">
                    <span className="flex-1 truncate text-muted-foreground">{names(q.playerId)}</span>
                    <Button
                      variant="ghost"
                      onClick={() =>
                        apply(`${names(q.playerId)} is back`, (st) => setBreak(st, q.playerId, false, liveCtx()), true)
                      }
                    >
                      Back in line
                    </Button>
                  </li>
                ))}
              </ul>
            </>
          )}

          {goneHome.length > 0 && (
            <p className="mt-6 text-sm text-muted-foreground">
              Gone home: {goneHome.map((q) => names(q.playerId)).join(", ")}
            </p>
          )}
        </aside>
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
          onCancel={() => setDialog(null)}
        />
      )}

      {dialog?.kind === "walkIn" && (
        <PlayerForm title="Add walk-in" saveLabel="Add and check in" onSave={addWalkIn} onCancel={() => setDialog(null)} />
      )}

      {finishing && (
        <ResultSheet
          title="Finish game"
          session={s.session}
          game={finishing}
          names={names}
          onCancel={() => setDialog(null)}
          onSubmit={async (result) => {
            const done = await apply("Game finished", (st) => finishGame(st, finishing.id, result, liveCtx()), true);
            if (done) setDialog(null);
          }}
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
          onCancel={() => setDialog(null)}
        />
      )}

      {dialog?.kind === "swapInSuggestion" &&
        (() => {
          const teams = teamsFor(dialog.courtId);
          if (!teams) return null;
          const shown = new Set(
            Object.entries(suggestions).flatMap(([courtId, sug]) =>
              courtId === dialog.courtId || "waitingFor" in sug ? [] : [...sug.teamA, ...sug.teamB]
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
              onCancel={() => setDialog(null)}
            />
          );
        })()}

      {dialog?.kind === "end" && (
        <ConfirmSheet
          title="End this session?"
          body="Games still running won't get a result. You can still fix results and export from the summary."
          confirmLabel="End session"
          danger
          onCancel={() => setDialog(null)}
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

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="flex h-11 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
    >
      {children}
    </button>
  );
}

/** Who's on court, with break / gone-home requests that take effect after their game. */
function PlayingList({
  state,
  names,
  apply,
}: {
  state: SessionState;
  names: (id: string) => string;
  apply: (label: string, fn: (s: SessionState) => SessionState | EngineError, undoable?: boolean) => Promise<unknown>;
}) {
  const playing = state.queue
    .filter((q) => q.status === "playing")
    .sort((a, b) => names(a.playerId).localeCompare(names(b.playerId)));
  if (playing.length === 0) return null;
  return (
    <>
      <h2 className="mb-2 mt-6 text-sm font-medium text-muted-foreground">On court</h2>
      <ul className="space-y-1">
        {playing.map((q) => (
          <li key={q.id} className="flex min-h-11 items-center gap-1 rounded-lg pl-3">
            <span className="flex-1 truncate text-sm">
              {names(q.playerId)}
              {q.breakAfterGame && <span className="ml-2 text-xs text-amber">break after game</span>}
              {q.leaveAfterGame && <span className="ml-2 text-xs text-amber">leaving after game</span>}
            </span>
            <IconButton
              label={q.breakAfterGame ? "Cancel break" : "Break after this game"}
              onClick={() => apply("Break", (st) => setBreak(st, q.playerId, !q.breakAfterGame, liveCtx()))}
            >
              <Coffee size={16} />
            </IconButton>
            <IconButton
              label="Going home after this game"
              onClick={() => apply(`${names(q.playerId)} went home`, (st) => markLeft(st, q.playerId, liveCtx()), true)}
            >
              <LogOut size={16} />
            </IconButton>
          </li>
        ))}
      </ul>
    </>
  );
}

