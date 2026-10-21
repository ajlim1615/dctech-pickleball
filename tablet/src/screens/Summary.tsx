import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { formatMatchScore } from "@/features/matches/utils/scoring";
import type { Navigate } from "../App";
import { Button, Card, ScreenHeader, toast } from "../components/ui";
import { ResultSheet } from "../components/ResultSheet";
import { loadSessionState, saveSessionState } from "../db/repo";
import { correctResult } from "../engine/game";
import { sessionLeaderboard } from "../engine/leaderboard";
import { isEngineError, type DeskGame, type SessionState } from "../engine/types";
import { buildWorkbook, exportFileName, XLSX_MIME } from "../io/export";
import { shareFile } from "../io/native";
import { formatDate, liveCtx, playerName, styleLabel } from "../lib/ctx";

export function Summary({ sessionId, navigate }: { sessionId: string; navigate: Navigate }) {
  const [state, setState] = useState<SessionState | null>(null);
  const [fixing, setFixing] = useState<DeskGame | null>(null);

  useEffect(() => {
    loadSessionState(sessionId).then(setState, () => navigate({ name: "home" }));
  }, [sessionId, navigate]);

  if (!state) return null;
  const s = state;
  const names = (id: string) => playerName(s, id);
  const { trackScores } = s.session;
  const board = sessionLeaderboard(s);
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

  return (
    <>
      <ScreenHeader
        title={s.session.title}
        onBack={() => navigate({ name: "home" })}
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
      <main className="grid flex-1 grid-cols-2 gap-6 overflow-y-auto p-6">
        <section>
          <p className="mb-3 text-sm text-muted-foreground">
            {formatDate(s.session.date)} · {styleLabel(s.session.matchingStyle)} ·{" "}
            <span className="font-mono tabular-nums">{games.length}</span> games
          </p>
          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">#</th>
                  <th className="px-3 py-2 font-medium">Player</th>
                  <th className="px-3 py-2 text-right font-medium">W</th>
                  <th className="px-3 py-2 text-right font-medium">L</th>
                  {trackScores && <th className="px-3 py-2 text-right font-medium">Diff</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {board.map((r) => (
                  <tr key={r.id}>
                    <td className="px-3 py-2 font-mono tabular-nums text-muted-foreground">{r.rank}</td>
                    <td className="px-3 py-2">{r.display_name}</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">{r.games_won}</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">{r.games_lost}</td>
                    {trackScores && (
                      <td className="px-3 py-2 text-right font-mono tabular-nums">
                        {r.point_diff > 0 ? `+${r.point_diff}` : r.point_diff}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">Games</h2>
          {games.length === 0 ? (
            <p className="text-sm text-muted-foreground">No finished games.</p>
          ) : (
            <Card className="divide-y divide-border">
              {games.map((g, i) => (
                <div key={g.id} className="flex min-h-14 items-center gap-3 px-3">
                  <span className="w-6 font-mono text-sm tabular-nums text-muted-foreground">{i + 1}</span>
                  <div className="flex-1 text-sm">
                    <p>
                      <span className={g.winner === "A" ? "font-semibold text-team1" : ""}>{g.teamA.map(names).join(" & ")}</span>
                      <span className="text-muted-foreground"> vs </span>
                      <span className={g.winner === "B" ? "font-semibold text-team2" : ""}>{g.teamB.map(names).join(" & ")}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {court(g.courtId)}
                      {g.correctedAt && " · fixed"}
                    </p>
                  </div>
                  {trackScores && <span className="font-mono tabular-nums">{formatMatchScore(g.scoreA, g.scoreB)}</span>}
                  <Button variant="ghost" onClick={() => setFixing(g)}>
                    Fix result
                  </Button>
                </div>
              ))}
            </Card>
          )}
        </section>
      </main>

      {fixing && (
        <ResultSheet
          title="Fix result"
          session={s.session}
          game={fixing}
          names={names}
          onCancel={() => setFixing(null)}
          onSubmit={async (result) => {
            const next = correctResult(s, fixing.id, result, liveCtx());
            if (isEngineError(next)) return toast(next.error);
            await saveSessionState(next);
            setState(next);
            setFixing(null);
            toast("Result fixed.");
          }}
        />
      )}
    </>
  );
}
