"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { BookOpen, Check, Moon, PlayCircle, Sunrise, Users } from "lucide-react";
import { RATING_RULES } from "@/features/rankings/ratingConfig";
import { NO_SHOW_WINDOW_MINUTES } from "@/features/queue/utils/noShow";

/** A button name, written the way it appears on screen. */
function Btn({ children }: { children: ReactNode }) {
  return (
    <span className="whitespace-nowrap rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-1.5 py-px text-[12px] font-semibold text-slate-800 dark:text-slate-100">
      {children}
    </span>
  );
}

interface Step {
  id: string;
  title: ReactNode;
  detail: ReactNode;
}

const PHASES: { id: string; label: string; when: string; icon: typeof Sunrise; steps: Step[] }[] = [
  {
    id: "before",
    label: "Before",
    when: "Any day before",
    icon: Sunrise,
    steps: [
      {
        id: "create",
        title: <>Create the session</>,
        detail: (
          <>
            Sessions tab → <Btn>New session</Btn>. Set the date, place and number of courts, then the game mode,
            ranked or casual, and how games are scored (points or win/loss only).
          </>
        ),
      },
      {
        id: "check",
        title: <>Check who&apos;s going</>,
        detail: (
          <>
            Players tap <Btn>I&apos;m going</Btn>. You can add or remove people in Who&apos;s going. Ranked or casual
            can&apos;t be changed fairly once games are played, so decide now.
          </>
        ),
      },
    ],
  },
  {
    id: "during",
    label: "During",
    when: "On the night",
    icon: PlayCircle,
    steps: [
      {
        id: "start",
        title: <>Start the session</>,
        detail: (
          <>
            <Btn>Start session</Btn> shuffles everyone going into the line and opens the courts. Anyone else joins at
            the back with <Btn>Join queue</Btn>, or you can use <Btn>Add players</Btn>.
          </>
        ),
      },
      {
        id: "call",
        title: <>Put players on courts</>,
        detail: (
          <>
            <Btn>Call next 4</Btn> on an open court, or <Btn>Fill open courts</Btn> for all of them. With{" "}
            <Btn>Auto-fill courts</Btn> on, the next 4 are called as soon as a result is saved.
          </>
        ),
      },
      {
        id: "score",
        title: <>Record each game</>,
        detail: (
          <>
            Win/loss only: tap the side that won, then <Btn>Record win</Btn>. Scored games: count the points, then{" "}
            <Btn>Submit result</Btn>. Ranked games update ratings straight away.
          </>
        ),
      },
      {
        id: "noshow",
        title: <>Someone didn&apos;t show</>,
        detail: (
          <>
            Within {NO_SHOW_WINDOW_MINUTES} minutes and before the first point, tap <Btn>No-show?</Btn> on the court and
            pick them. The next person in line takes their place.
          </>
        ),
      },
    ],
  },
  {
    id: "after",
    label: "After",
    when: "When play stops",
    icon: Moon,
    steps: [
      {
        id: "end",
        title: <>End the session</>,
        detail: (
          <>
            Record any game still on court first: <Btn>End session</Btn> doesn&apos;t save games in progress. It frees
            the courts, clears the line and shows the final standings.
          </>
        ),
      },
      {
        id: "export",
        title: <>Save attendance</>,
        detail: (
          <>
            On the session page, <Btn>Export to Excel</Btn> downloads the standings, who came and how many games each
            person played.
          </>
        ),
      },
      {
        id: "fix",
        title: <>Fix a wrong result</>,
        detail: (
          <>
            Session standings → Match logs → <Btn>Fix result</Btn>. Ratings are recalculated for that game.
          </>
        ),
      },
    ],
  },
];

const PICKING = [
  "The line is in arrival order. Everyone going starts in a random order, then each finished game goes to the back.",
  "For each court the app looks at the first few people in line, and always takes whoever is first.",
  "The session's game mode picks the best group of 4 from them: close ratings, fewer repeat partners and opponents.",
  "Partners who joined together stay together, but only when the session allows partners.",
];

const PLAYER_RULES = [
  "One break per session. Their place in line is kept.",
  "If they leave, they can rejoin once, at the back. After that, an admin has to add them.",
  `Ratings move after every ranked game. A player is ranked after ${RATING_RULES.qualifyGames} ranked games.`,
];

const PERMISSIONS: { action: string; admins: boolean }[] = [
  { action: "Create, start and end sessions", admins: true },
  { action: "Call players, record and fix results", admins: true },
  { action: "Add or remove people in the line", admins: true },
  { action: "Turn accounts on or off", admins: true },
  { action: "Change ratings, names, photos and roles", admins: false },
  { action: "Reset passwords", admins: false },
];

/** The admin's game-night checklist: what to do before, during and after a session. */
export function AdminRulesGuide() {
  const [done, setDone] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Running a session</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Tick the steps off as you go. The ticks reset when you leave this page.
          </p>
        </div>
        {done.size > 0 && (
          <button
            type="button"
            onClick={() => setDone(new Set())}
            className="self-start sm:self-auto text-xs font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 cursor-pointer"
          >
            Clear ticks
          </button>
        )}
      </div>

      {/* Before / During / After */}
      <ol className="grid gap-4 md:grid-cols-3">
        {PHASES.map((phase) => {
          const Icon = phase.icon;
          const finished = phase.steps.filter((s) => done.has(`${phase.id}:${s.id}`)).length;
          return (
            <li
              key={phase.id}
              className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 shadow-sm"
            >
              <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 px-4 py-3">
                <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100">
                  <Icon className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden />
                  {phase.label}
                  <span className="font-normal text-slate-400 dark:text-slate-500">{phase.when}</span>
                </h3>
                <span className="font-mono text-[11px] tabular-nums text-slate-400 dark:text-slate-500">
                  {finished}/{phase.steps.length}
                </span>
              </div>
              <ol className="divide-y divide-slate-100 dark:divide-slate-800/70">
                {phase.steps.map((step) => {
                  const key = `${phase.id}:${step.id}`;
                  const isDone = done.has(key);
                  return (
                    <li key={step.id} className="flex gap-3 px-4 py-3">
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={isDone}
                        aria-labelledby={`step-${key}`}
                        onClick={() => toggle(key)}
                        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-emerald-500 ${
                          isDone
                            ? "border-emerald-600 bg-emerald-600 text-white"
                            : "border-slate-300 dark:border-slate-600 hover:border-emerald-500"
                        }`}
                      >
                        {isDone && <Check className="h-3.5 w-3.5" aria-hidden />}
                      </button>
                      <div className="min-w-0">
                        <p
                          id={`step-${key}`}
                          className={`text-sm font-semibold ${
                            isDone ? "text-slate-400 line-through dark:text-slate-500" : "text-slate-900 dark:text-slate-100"
                          }`}
                        >
                          {step.title}
                        </p>
                        <p className="mt-1 text-[13px] leading-relaxed text-slate-600 dark:text-slate-400">{step.detail}</p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </li>
          );
        })}
      </ol>

      <div className="grid gap-4 md:grid-cols-2">
        {/* How players are picked */}
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 shadow-sm p-4 space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100">
            <Users className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden />
            How players are picked
          </h3>
          <ul className="space-y-2">
            {PICKING.map((line) => (
              <li key={line} className="flex gap-2 text-[13px] leading-relaxed text-slate-600 dark:text-slate-400">
                <span aria-hidden className="mt-2 h-1 w-1 shrink-0 rounded-full bg-slate-400" />
                {line}
              </li>
            ))}
          </ul>
          <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">What players can do</p>
            <ul className="mt-2 space-y-1.5">
              {PLAYER_RULES.map((line) => (
                <li key={line} className="flex gap-2 text-[13px] leading-relaxed text-slate-600 dark:text-slate-400">
                  <span aria-hidden className="mt-2 h-1 w-1 shrink-0 rounded-full bg-slate-400" />
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Who can do what */}
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 shadow-sm p-4 space-y-3">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Who can do what</h3>
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                <th className="pb-2 font-semibold">Action</th>
                <th className="pb-2 w-16 text-center font-semibold">Admins</th>
                <th className="pb-2 w-20 text-center font-semibold">System Admin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
              {PERMISSIONS.map((row) => (
                <tr key={row.action}>
                  <td className="py-2 pr-2 text-slate-700 dark:text-slate-300">{row.action}</td>
                  <td className="py-2 text-center">
                    {row.admins ? (
                      <Check className="mx-auto h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-label="Yes" />
                    ) : (
                      <span className="text-slate-300 dark:text-slate-600" aria-label="No">–</span>
                    )}
                  </td>
                  <td className="py-2 text-center">
                    <Check className="mx-auto h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-label="Yes" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-slate-500 dark:text-slate-400">The System Admin is admin@dctechmicro.com.</p>
        </section>
      </div>

      <Link
        href="/guide"
        className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700 hover:underline underline-offset-4 dark:text-emerald-400"
      >
        <BookOpen className="h-4 w-4" aria-hidden />
        Full rules and player guide
      </Link>
    </div>
  );
}
