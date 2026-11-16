import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { RoleGuideSection } from "@/features/guide/data/guideData";

export function StaffAdminSection({
  sections,
  query = "",
  emptyLabel,
}: {
  sections: RoleGuideSection[];
  query?: string;
  emptyLabel: string;
}) {
  const q = query.trim().toLowerCase();
  const filtered = q
    ? sections.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q) ||
          s.items.some(
            (item) =>
              item.label.toLowerCase().includes(q) || item.detail.toLowerCase().includes(q)
          )
      )
    : sections;

  return (
    <div className="space-y-4">
      {filtered.map((section) => (
        <Card
          key={section.title}
          className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-6 space-y-4 shadow-sm"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant="volt" className="text-[10px] font-mono font-bold">
                  {section.badge}
                </Badge>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-emerald-500" />
                  {section.title}
                </h3>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 font-mono leading-relaxed">
                {section.description}
              </p>
            </div>
            {section.href && section.ctaLabel && (
              <Link
                href={section.href}
                className="inline-flex items-center gap-1 text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 hover:underline shrink-0"
              >
                {section.ctaLabel}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {section.items.map((item) => (
              <div
                key={item.label}
                className="rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3.5 space-y-1 text-xs font-mono"
              >
                <div className="font-bold text-slate-900 dark:text-slate-100">{item.label}</div>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">{item.detail}</p>
              </div>
            ))}
          </div>
        </Card>
      ))}
      {filtered.length === 0 && (
        <p className="text-xs font-mono text-slate-500 dark:text-slate-400 text-center py-8">
          {emptyLabel}
        </p>
      )}
    </div>
  );
}
