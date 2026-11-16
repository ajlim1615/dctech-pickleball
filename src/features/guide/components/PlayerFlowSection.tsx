import Link from "next/link";
import { Activity, ArrowRight, Calendar, History, Trophy, User } from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  PLAYER_APP_FEATURES,
  PLAYER_FLOW_STEPS,
  type AppFeatureCard,
  type FlowStep,
} from "@/features/guide/data/guideData";

const STEP_CHIP_STYLES: Record<FlowStep["accent"], string> = {
  emerald: "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  lime: "bg-lime-50 dark:bg-[#d4e938]/10 text-lime-700 dark:text-[#d4e938]",
  sky: "bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400",
  purple: "bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400",
};

function FeatureIcon({ name }: { name: AppFeatureCard["iconName"] }) {
  switch (name) {
    case "activity":
      return <Activity className="h-5 w-5 text-emerald-500" />;
    case "calendar":
      return <Calendar className="h-5 w-5 text-sky-500" />;
    case "trophy":
      return <Trophy className="h-5 w-5 text-amber-500" />;
    case "history":
      return <History className="h-5 w-5 text-purple-500" />;
    case "user":
      return <User className="h-5 w-5 text-emerald-600 dark:text-[#d4e938]" />;
  }
}

export function PlayerFlowSection({ query = "" }: { query?: string }) {
  const q = query.trim().toLowerCase();
  const steps = q
    ? PLAYER_FLOW_STEPS.filter(
        (s) => s.title.toLowerCase().includes(q) || s.description.toLowerCase().includes(q)
      )
    : PLAYER_FLOW_STEPS;

  const features = q
    ? PLAYER_APP_FEATURES.filter(
        (f) => f.title.toLowerCase().includes(q) || f.description.toLowerCase().includes(q)
      )
    : PLAYER_APP_FEATURES;

  return (
    <div className="space-y-6">
      {steps.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {steps.map((step) => (
            <Card
              key={step.step}
              className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-5 flex flex-col justify-between gap-4 shadow-sm"
            >
              <div className="space-y-3">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-lg font-mono font-bold text-sm ${STEP_CHIP_STYLES[step.accent]}`}
                >
                  {step.step}
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  {step.title}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  {step.description}
                </p>
              </div>
              <Link
                href={step.href}
                className="inline-flex items-center gap-1 text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
              >
                {step.ctaLabel}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Card>
          ))}
        </div>
      )}

      {features.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-mono font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Platform Features
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {features.map((feature) => (
              <Card
                key={feature.title}
                className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-5 flex flex-col justify-between gap-3 shadow-sm"
              >
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <FeatureIcon name={feature.iconName} />
                    <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      {feature.title}
                    </h4>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-mono">
                    {feature.description}
                  </p>
                </div>
                <Link
                  href={feature.href}
                  className="inline-flex items-center gap-1 text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                >
                  {feature.ctaLabel}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Card>
            ))}
          </div>
        </div>
      )}

      {q && steps.length === 0 && features.length === 0 && (
        <p className="text-xs font-mono text-slate-500 dark:text-slate-400 text-center py-8">
          No game day steps or features matched &quot;{query}&quot;.
        </p>
      )}
    </div>
  );
}
