import { useEffect, useState } from "react";
import { Archive, ArrowRight, CalendarDays, ChevronRight, Moon, Plus, Sun, Users } from "lucide-react";
import type { Navigate } from "../App";
import { BrandMark, Button, Card, EmptyState, IconButton } from "../components/ui";
import { getMeta, listPlayers, listSessions, loadSessionState } from "../db/repo";
import type { DeskSession } from "../engine/types";
import { styleLabel } from "../lib/ctx";
import { backupReminder } from "../lib/backupReminder";
import { boardStats } from "../lib/boardStats";
import { sessionHighlights } from "../lib/sessionHighlights";
import { applyTheme, saveTheme, type Theme } from "../lib/theme";

const MAX_PAST = 20;

type PastRow = { session: DeskSession; highlights: ReturnType<typeof sessionHighlights> };
type LiveCard = { session: DeskSession; stats: ReturnType<typeof boardStats> };

function dateTile(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return { day: d, month: date.toLocaleDateString(undefined, { month: "short" }).toUpperCase() };
}

function clockTime(iso?: string) {
  return iso ? new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : "";
}

export function Home({ navigate }: { navigate: Navigate }) {
  const [live, setLive] = useState<LiveCard | null>(null);
  const [past, setPast] = useState<PastRow[]>([]);
  const [reminder, setReminder] = useState<string | null>(null);
  const [playerCount, setPlayerCount] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [theme, setTheme] = useState<Theme>(() =>
    document.documentElement.dataset.theme === "dark" ? "dark" : "light"
  );

  useEffect(() => {
    (async () => {
      const [all, players, lastBackupAt] = await Promise.all([listSessions(), listPlayers(), getMeta("lastBackupAt")]);
      setPlayerCount(players.length);
      setReminder(backupReminder(lastBackupAt, players.length > 0 || all.length > 0));

      const liveSession = all.find((s) => s.status === "live");
      if (liveSession) setLive({ session: liveSession, stats: boardStats(await loadSessionState(liveSession.id)) });

      const ended = all.filter((s) => s.status === "ended").slice(0, MAX_PAST);
      const rows = await Promise.all(
        ended.map(async (session) => ({ session, highlights: sessionHighlights(await loadSessionState(session.id)) }))
      );
      setPast(rows);
      setLoaded(true);
    })();
  }, []);

  function toggleTheme() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    applyTheme(next);
    setTheme(next);
    saveTheme(next).catch(() => {});
  }

  return (
    <>
      <header className="flex min-h-16 shrink-0 items-center gap-2 border-b border-line px-5">
        <BrandMark />
        <span className="flex-1" />
        <Button variant="ghost" onClick={() => navigate({ name: "roster" })}>
          <Users size={18} /> Roster <span className="font-mono tabular-nums">{playerCount}</span>
        </Button>
        <Button variant="ghost" onClick={() => navigate({ name: "backup" })}>
          <Archive size={18} /> Backup
        </Button>
        <IconButton
          label={theme === "dark" ? "Switch to light" : "Switch to dark"}
          onClick={toggleTheme}
          className="border border-line bg-surface"
        >
          {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
        </IconButton>
      </header>

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-5 overflow-y-auto px-6 py-6">
        {live ? (
          <div className="flex items-center gap-5 rounded-[18px] bg-primary p-6 text-on-primary shadow-card">
            <div className="min-w-0 flex-1">
              <p className="text-[13px] opacity-75">Live now · started {clockTime(live.session.startedAt)}</p>
              <p className="truncate font-serif text-[28px] font-semibold leading-tight tracking-[-0.01em]">
                {live.session.title}
              </p>
              <p className="text-sm opacity-80">
                <span className="font-mono tabular-nums">{live.session.courts.length}</span> courts ·{" "}
                <span className="font-mono tabular-nums">{live.stats.playing}</span> playing ·{" "}
                <span className="font-mono tabular-nums">{live.stats.games}</span> games
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate({ name: "live", sessionId: live.session.id })}
              className="inline-flex min-h-12 shrink-0 items-center gap-2 rounded-xl bg-on-primary px-5 text-sm font-semibold text-primary transition active:scale-[0.98]"
            >
              Open live board <ArrowRight size={18} />
            </button>
          </div>
        ) : (
          <Card className="flex items-center gap-5 p-6">
            <div className="min-w-0 flex-1">
              <p className="font-serif text-2xl font-semibold">No session running</p>
              <p className="text-[15px] text-muted">Set up courts and matchmaking, then check players in.</p>
            </div>
            <Button variant="primary" size="lg" onClick={() => navigate({ name: "new" })}>
              <Plus size={18} /> New session
            </Button>
          </Card>
        )}

        {reminder && (
          <button
            type="button"
            onClick={() => navigate({ name: "backup" })}
            className="min-h-11 rounded-xl bg-clay-bg px-4 py-2.5 text-left text-sm text-clay"
          >
            {reminder} <span className="font-semibold underline underline-offset-2">Back up now</span>
          </button>
        )}

        <section>
          <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.05em] text-muted">Past sessions</h2>
          {loaded && past.length === 0 ? (
            <Card>
              <EmptyState
                icon={<CalendarDays size={28} />}
                title="No past sessions yet"
                body="When you end a session it shows up here with its results."
              />
            </Card>
          ) : (
            <Card className="divide-y divide-line overflow-hidden">
              {past.map(({ session, highlights }) => {
                const tile = dateTile(session.date);
                return (
                  <button
                    key={session.id}
                    type="button"
                    onClick={() => navigate({ name: "summary", sessionId: session.id })}
                    className="flex min-h-16 w-full items-center gap-4 px-4 py-2.5 text-left transition hover:bg-sunken"
                  >
                    <span className="w-11 shrink-0 text-center">
                      <span className="block font-serif text-xl font-semibold leading-none">{tile.day}</span>
                      <span className="block text-[11px] text-muted">{tile.month}</span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{session.title}</span>
                      <span className="block truncate text-[13px] text-muted">
                        {styleLabel(session.matchingStyle)} · <span className="font-mono tabular-nums">{highlights.games}</span>{" "}
                        {highlights.games === 1 ? "game" : "games"}
                        {highlights.top && (
                          <>
                            {" "}· top: {highlights.top.name}{" "}
                            <span className="font-mono tabular-nums">
                              {highlights.top.won}–{highlights.top.lost}
                            </span>
                          </>
                        )}
                      </span>
                    </span>
                    <ChevronRight size={18} className="shrink-0 text-muted" />
                  </button>
                );
              })}
            </Card>
          )}
        </section>
      </main>
    </>
  );
}
