import { AlertCircle, CheckCircle2, Sparkles, Trophy, Volume2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CORE_RULES, OFFICIAL_FAULTS, type CoreRuleItem } from "@/features/guide/data/guideData";

const ACCENT_STYLES: Record<CoreRuleItem["accent"], { chip: string; icon: string }> = {
  emerald: {
    chip: "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400",
    icon: "text-emerald-500",
  },
  sky: {
    chip: "bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400",
    icon: "text-sky-500",
  },
  amber: {
    chip: "bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400",
    icon: "text-amber-500",
  },
  purple: {
    chip: "bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400",
    icon: "text-purple-500",
  },
  lime: {
    chip: "bg-lime-50 dark:bg-[#d4e938]/20 text-lime-700 dark:text-[#d4e938]",
    icon: "text-emerald-600 dark:text-[#d4e938]",
  },
  rose: {
    chip: "bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400",
    icon: "text-rose-500",
  },
};

export function RulesSection({ query = "" }: { query?: string }) {
  const q = query.trim().toLowerCase();
  const filteredRules = q
    ? CORE_RULES.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.badge.toLowerCase().includes(q) ||
          r.bullets.some((b) => b.toLowerCase().includes(q))
      )
    : CORE_RULES;

  const filteredFaults = q
    ? OFFICIAL_FAULTS.filter(
        (f) => f.title.toLowerCase().includes(q) || f.description.toLowerCase().includes(q)
      )
    : OFFICIAL_FAULTS;

  return (
    <div className="space-y-6">
      {!q && (
        <div className="rounded-3xl border-2 border-emerald-500/40 bg-slate-50 dark:bg-slate-950 p-6 sm:p-8 text-center space-y-4 shadow-sm">
          <span className="text-xs font-mono text-slate-600 dark:text-slate-400 uppercase tracking-widest flex items-center justify-center gap-1.5 font-bold">
            <Volume2 className="h-4 w-4 text-emerald-600 dark:text-[#d4e938]" />
            HOW OFFICIAL PICKLEBALL SCORING CALLS WORK
          </span>
          <div className="text-4xl sm:text-6xl font-black font-mono text-emerald-700 dark:text-[#d4e938] tracking-tight">
            9 - 7 - 2
          </div>
          <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10 text-xs sm:text-sm font-mono text-slate-700 dark:text-slate-300 pt-1">
            <div className="flex items-center gap-1.5">
              <span className="h-6 w-6 rounded-lg bg-emerald-500 text-white font-bold flex items-center justify-center text-xs">
                1
              </span>
              <span>
                <strong>9:</strong> Serving Score
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-6 w-6 rounded-lg bg-sky-500 text-white font-bold flex items-center justify-center text-xs">
                2
              </span>
              <span>
                <strong>7:</strong> Receiving Score
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-6 w-6 rounded-lg bg-amber-500 text-white font-bold flex items-center justify-center text-xs">
                3
              </span>
              <span>
                <strong>2:</strong> Server #1 or #2
              </span>
            </div>
          </div>
          <div className="max-w-2xl mx-auto rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-mono">
            <p>
              <strong>The Game Start Exception:</strong> The game always begins at{" "}
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">0 - 0 - 2</span>.
              The starting team only gets <strong>1 server turn</strong> to minimize first-serve
              advantage before a side-out occurs.
            </p>
          </div>
        </div>
      )}

      {filteredRules.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-emerald-500" />
            Core Fundamental Rules
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredRules.map((rule) => {
              const style = ACCENT_STYLES[rule.accent];
              const Icon =
                rule.accent === "amber"
                  ? AlertCircle
                  : rule.accent === "lime"
                    ? Trophy
                    : CheckCircle2;
              return (
                <Card
                  key={rule.number}
                  className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-5 space-y-2.5 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <div
                      className={`h-7 w-7 rounded-lg font-mono font-bold text-xs flex items-center justify-center ${style.chip}`}
                    >
                      {rule.number}
                    </div>
                    <Badge variant="outline" className="text-[10px] font-mono">
                      {rule.badge}
                    </Badge>
                  </div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    <Icon className={`h-4 w-4 ${style.icon}`} />
                    {rule.title}
                  </h4>
                  <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-1.5 leading-relaxed list-disc list-inside">
                    {rule.bullets.map((bullet) => (
                      <li key={bullet}>{bullet}</li>
                    ))}
                  </ul>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {filteredFaults.length > 0 && (
        <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-6 space-y-4 shadow-sm">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Official Faults (What Ends a Rally & Causes a Turnover)
            </h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
            {filteredFaults.map((fault) => (
              <div
                key={fault.title}
                className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1"
              >
                <span className="text-rose-600 dark:text-rose-400 font-bold">{fault.title}</span>
                <p className="text-slate-600 dark:text-slate-400">{fault.description}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {!q && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-5 space-y-2 shadow-sm">
            <Badge variant="volt" className="text-[10px] font-mono font-bold">
              DOUBLES (2v2)
            </Badge>
            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Doubles Scoring & Rotation
            </h4>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-mono">
              Uses the 3-number call (
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                Score - Opponent - Server
              </span>
              ). Both partners get a turn to serve before side-out (except 0-0-2 at start).
            </p>
          </Card>

          <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-5 space-y-2 shadow-sm">
            <Badge variant="secondary" className="text-[10px] font-mono font-bold">
              SINGLES (1v1)
            </Badge>
            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Singles Scoring & Rotation
            </h4>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-mono">
              Uses a 2-number call (
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                Server - Receiver
              </span>
              ). Serve from <strong>Right</strong> when your score is even (0, 2, 4...), and from{" "}
              <strong>Left</strong> when odd (1, 3, 5...).
            </p>
          </Card>
        </div>
      )}

      {q && filteredRules.length === 0 && filteredFaults.length === 0 && (
        <p className="text-xs font-mono text-slate-500 dark:text-slate-400 text-center py-8">
          No rules matched &quot;{query}&quot;.
        </p>
      )}
    </div>
  );
}
