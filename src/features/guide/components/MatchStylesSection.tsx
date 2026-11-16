import { Layers } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  GUIDE_MATCHING_STYLES,
  type MatchingStyleAccent,
  type MatchingStyleMeta,
} from "@/features/queue/constants/matchingStyles";
import { PARTNER_LOCK_FEATURE } from "@/features/guide/data/guideData";

const ACCENT_CARD_STYLES: Record<
  MatchingStyleAccent,
  { container: string; tag: string; detailBox: string }
> = {
  emerald: {
    container: "border-emerald-500/40 bg-emerald-50/40 dark:bg-emerald-950/20",
    tag: "text-emerald-600 dark:text-emerald-400",
    detailBox: "border-emerald-500/20",
  },
  purple: {
    container: "border-purple-500/30 bg-purple-50/40 dark:bg-purple-950/20",
    tag: "text-purple-600 dark:text-purple-400",
    detailBox: "border-purple-500/20",
  },
  sky: {
    container: "border-sky-500/30 bg-sky-50/40 dark:bg-sky-950/20",
    tag: "text-sky-600 dark:text-sky-400",
    detailBox: "border-sky-500/20",
  },
  amber: {
    container: "border-amber-500/30 bg-amber-50/40 dark:bg-amber-950/20",
    tag: "text-amber-600 dark:text-amber-400",
    detailBox: "border-amber-500/20",
  },
  slate: {
    container: "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60",
    tag: "text-slate-500 dark:text-slate-400",
    detailBox: "border-slate-200 dark:border-slate-800",
  },
};

function StyleBadge({ style }: { style: MatchingStyleMeta }) {
  if (!style.badge) return null;
  if (style.badgeTone === "volt") {
    return (
      <Badge variant="volt" className="text-[10px] font-mono font-bold">
        {style.badge}
      </Badge>
    );
  }
  if (style.badgeTone === "outline") {
    return (
      <Badge variant="outline" className="text-[10px] font-mono font-bold">
        {style.badge}
      </Badge>
    );
  }
  const colorMap: Record<"purple" | "sky" | "amber", string> = {
    purple:
      "bg-purple-100 text-purple-700 dark:bg-purple-900/60 dark:text-purple-300 border-purple-300 dark:border-purple-800",
    sky: "bg-sky-100 text-sky-700 dark:bg-sky-900/60 dark:text-sky-300 border-sky-300 dark:border-sky-800",
    amber:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300 border-amber-300 dark:border-amber-800",
  };
  const cls = style.badgeTone ? colorMap[style.badgeTone] : colorMap.purple;
  return <Badge className={`${cls} text-[10px] font-mono font-bold`}>{style.badge}</Badge>;
}

export function MatchStylesSection({ query = "" }: { query?: string }) {
  const q = query.trim().toLowerCase();
  const styles = q
    ? GUIDE_MATCHING_STYLES.filter(
        (s) =>
          s.label.toLowerCase().includes(q) ||
          s.guideDescription.toLowerCase().includes(q) ||
          s.strategy.toLowerCase().includes(q) ||
          s.bestFor.toLowerCase().includes(q)
      )
    : GUIDE_MATCHING_STYLES;

  const showPartnerLock =
    !q ||
    PARTNER_LOCK_FEATURE.title.toLowerCase().includes(q) ||
    PARTNER_LOCK_FEATURE.description.toLowerCase().includes(q);

  return (
    <div className="space-y-6">
      <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-6 space-y-5 shadow-sm">
        <div>
          <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Layers className="h-5 w-5 text-emerald-500" />
            Supported Match Styles & Rotation Formats
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-mono pt-1">
            DCTECH Pickleball features an automated matching engine. Administrators select the
            rotation strategy per session to match the evening&apos;s goal:
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {styles.map((style, idx) => {
            const accent = ACCENT_CARD_STYLES[style.accent];
            return (
              <div
                key={style.id}
                id={style.id}
                className={`rounded-2xl border p-5 space-y-3 flex flex-col justify-between shadow-2xs ${accent.container}`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <StyleBadge style={style} />
                    <span className={`text-xs font-mono font-bold ${accent.tag}`}>{style.tag}</span>
                  </div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    {idx + 1}. {style.label}
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {style.guideDescription}
                  </p>
                </div>
                <div
                  className={`rounded-xl bg-white/80 dark:bg-slate-900/80 p-3 border text-[11px] font-mono text-slate-600 dark:text-slate-400 space-y-1 ${accent.detailBox}`}
                >
                  <div>
                    <strong>Strategy:</strong> {style.strategy}
                  </div>
                  <div>
                    <strong>Best For:</strong> {style.bestFor}
                  </div>
                </div>
              </div>
            );
          })}

          {showPartnerLock && (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-50/20 dark:bg-emerald-950/10 p-5 space-y-3 flex flex-col justify-between shadow-2xs">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="volt" className="text-[10px] font-mono font-bold">
                    {PARTNER_LOCK_FEATURE.badge}
                  </Badge>
                  <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                    {PARTNER_LOCK_FEATURE.tag}
                  </span>
                </div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {PARTNER_LOCK_FEATURE.title}
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  {PARTNER_LOCK_FEATURE.description}
                </p>
              </div>
              <div className="rounded-xl bg-white/80 dark:bg-slate-900/80 p-3 border border-emerald-500/20 text-[11px] font-mono text-slate-600 dark:text-slate-400 space-y-1">
                <div>
                  <strong>Strategy:</strong> {PARTNER_LOCK_FEATURE.strategy}
                </div>
                <div>
                  <strong>Best For:</strong> {PARTNER_LOCK_FEATURE.bestFor}
                </div>
              </div>
            </div>
          )}
        </div>

        {styles.length === 0 && !showPartnerLock && (
          <p className="text-xs font-mono text-slate-500 dark:text-slate-400 text-center py-6">
            No match styles matched &quot;{query}&quot;.
          </p>
        )}
      </Card>
    </div>
  );
}
