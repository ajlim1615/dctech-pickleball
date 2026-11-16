import { HelpCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PLAYER_FAQS } from "@/features/guide/data/guideData";

export function FaqSection({ query = "" }: { query?: string }) {
  const q = query.trim().toLowerCase();
  const faqs = q
    ? PLAYER_FAQS.filter(
        (f) => f.question.toLowerCase().includes(q) || f.answer.toLowerCase().includes(q)
      )
    : PLAYER_FAQS;

  return (
    <div className="space-y-4">
      {faqs.map((faq) => (
        <Card
          key={faq.question}
          className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-5 space-y-2 shadow-sm"
        >
          <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <HelpCircle className="h-4 w-4 text-emerald-500 shrink-0" />
            {faq.question}
          </h4>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-mono">
            {faq.answer}
          </p>
        </Card>
      ))}
      {faqs.length === 0 && (
        <p className="text-xs font-mono text-slate-500 dark:text-slate-400 text-center py-8">
          No FAQs matched &quot;{query}&quot;.
        </p>
      )}
    </div>
  );
}
