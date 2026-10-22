import { useEffect, useState } from "react";
import { Download, Trophy } from "lucide-react";
import clsx from "clsx";
import { formatMatchScore } from "@/features/matches/utils/scoring";
import type { Navigate } from "../App";
import { Button, Card, EmptyState, ScreenHeader, toast } from "../components/ui";
import { ResultSheet } from "../components/ResultSheet";
import { loadSessionState, saveSessionState } from "../db/repo";
import { correctResult } from "../engine/game";
import { sessionLeaderboard } from "../engine/leaderboard";
import { isEngineError, type DeskGame, type GameResult, type SessionState } from "../engine/types";
import { buildWorkbook, exportFileName, XLSX_MIME } from "../io/export";
import { shareFile } from "../io/native";
import { formatDate, liveCtx, playerName, styleLabel } from "../lib/ctx";

const PLACES = ["1st", "2nd", "3rd"];

function clockTime(iso?: string) {
  return iso ? new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : "";
}

function signed(n: number) {
  return n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0";
}

export function Summary({ sessionId, navigate }: { sessionId: string; navigate: Navigate }) {
  const [state, setState] = useState<SessionState | null>(null);
  const [fixing, setFixing] = useState<DeskGame | null>(null);
  const [fixError, setFixError] = useState<{ message: string; key: number } | null>(null);

  useEffect(() => {
    loadSessionState(sessionId).then(setState, () => navigate({ name: "home" }));
  }, [sessionId, navigate]);

  if (!state) return null;
  const s = state;
  const names = (id: string) => playerName(s, id);
  const { trackScores } = s.session;
  const board = sessionLeaderboard(s).filter((r) => r.games_played > 0);
  const podium = board.slice(0, 3);
  const rest = board.slice(3);
  const games = s.games
    .filter((g) => g.endedAt && g.winner)
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  const court = (id: string) => s.session.courts.find((c) => c.id === id)?.name ?? "Court";

  async function exportSession() {
    try {
      await shareFile(exportFileName(s.session), buildWorkbook(s), XLSX_MIME);
    } catch {
      toast("The export couldn't be saved. Try again.");
    }
  }

  async function fix(game: DeskGame, result: GameResult) {
    const next = correctResult(s, game.id, result, liveCtx());
    if (isEngineError(next)) {
      setFixError({ message: next.error, key: Date.now() });
      return;
    }
    try {
      await saveSessionState(next);
    } catch {
      toast("That didn't save. Try again.");
      return;
    }
    setState(next);
    setFixing(null);
    setFixError(null);
    toast("Result fixed.");
  }

  return (
    <>
      <ScreenHeader
        title={s.session.title}
        onBack={() => navigate({ name: "home" })}
        meta={
          <>
            {formatDate(s.session.date)} · {styleLabel(s.session.matchingStyle)} ·{" "}
            <span className="font-mono tabular-nums">{games.length}</span> {games.length === 1 ? "game" : "games"}
          </>
        }
        actions={
          <>
            {s.session.status === "live" && (
              <Button onClick={() => navigate({ name: "live", sessionId })}>Back to live board</Button>
            )}
            <Button variant="primary" onClick={exportSession}>
              <Download size={18} /> Export to Excel
            </Button>
          </>
        }
      />

      {games.length === 0 ? (
        <main className="mx-auto w-full max-w-2xl flex-1 overflow-y-auto px-6 py-10">
          <Card>
            <EmptyState icon={<Trophy size={28} />} title="No finished games yet" body="Results and the leaderboard appear here as games finish." />
          </Card>
        </main>
      ) : (
        <main className="grid min-h-0 flex-1 grid-cols-1 gap-5 overflow-y-auto px-6 py-6 lg:grid-cols-[1.1fr_1fr]">
          <section className="min-w-0">
            <div className="mb-4 grid grid-cols-3 gap-3">
              {podium.map((r, i) => (
                <Card key={r.id} className={clsx("p-4", i === 0 && "border-primary/40")}>
                  <p className="text-xs text-muted">{PLACES[i]}</p>
                  <p className="truncate font-serif text-lg font-semibold">{r.display_name}</p>
                  <p className="font-mono text-sm tabular-nums text-muted">
                    {r.games_won}–{r.games_lost}
                    {trackScores && <> · {signed(r.point_diff)}</>}
                  </p>
                </Card>
              ))}
            </div>
            {rest.length > 0 && (
              <Card className="overflow-hidden">
                <table className="w-full text-[15px]">
                  <thead className="text-left text-xs text-muted">
                    <tr className="border-b border-line">
                      <th className="px-4 py-2.5 font-medium">#</th>
                      <th className="px-4 py-2.5 font-medium">Player</th>
                      <th className="px-4 py-2.5 text-right font-medium">W</th>
                      <th className="px-4 py-2.5 text-right font-medium">L</th>
                      {trackScores && <th className="px-4 py-2.5 text-right font-medium">Diff</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {rest.map((r) => (
                      <tr key={r.id}>
                        <td className="px-4 py-2.5 font-mono tabular-nums text-muted">{r.rank}</td>
                        <td className="max-w-0 truncate px-4 py-2.5">{r.display_name}</td>
                        <td className="px-4 py-2.5 text-right font-mono tabular-nums">{r.games_won}</td>
                        <td className="px-4 py-2.5 text-right font-mono tabular-nums">{r.games_lost}</td>
                        {trackScores && <td className="px-4 py-2.5 text-right font-mono tabular-nums">{signed(r.point_diff)}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            )}
          </section>

          <section className="min-w-0">
            <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.05em] text-muted">Games</h2>
            <Card className="divide-y divide-line overflow-hidden">
              {[...games].reverse().map((g) => {
                const number = games.indexOf(g) + 1;
                return (
                  <div key={g.id} className="flex min-h-16 items-center gap-3 py-2 pl-4 pr-2">
                    <span className="w-6 font-mono text-[13px] tabular-nums text-muted">{number}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px]">
                        <span className={g.winner === "A" ? "font-semibold text-t1" : ""}>{g.teamA.map(names).join(" & ")}</span>
                        <span className="text-muted"> vs </span>
                        <span className={g.winner === "B" ? "font-semibold text-t2" : ""}>{g.teamB.map(names).join(" & ")}</span>
                      </p>
                      <p className="text-xs text-muted">
                        {court(g.courtId)} · {clockTime(g.endedAt)}
                        {g.correctedAt && " · fixed"}
                      </p>
                    </div>
                    {trackScores && <span className="font-mono tabular-nums">{formatMatchScore(g.scoreA, g.scoreB)}</span>}
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setFixError(null);
                        setFixing(g);
                      }}
                    >
                      Fix
                    </Button>
                  </div>
                );
              })}
            </Card>
          </section>
        </main>
      )}

      {fixing && (
        <ResultSheet
          title="Fix result"
          session={s.session}
          game={fixing}
          courtName={court(fixing.courtId)}
          names={names}
          error={fixError?.message}
          errorKey={fixError?.key}
          onCancel={() => setFixing(null)}
          onSubmit={(result) => fix(fixing, result)}
        />
      )}
    </>
  );
}
