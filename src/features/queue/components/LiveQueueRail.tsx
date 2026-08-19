"use client";

import Link from "next/link";
import { Users, Plus, ArrowUpRight } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface QueuePlayer {
  id: string;
  position: number;
  name: string;
  rating: string;
  type: "Singles" | "Doubles Pair";
  waitTime: string;
  partner?: string;
}

export function LiveQueueRail({ queue = [] }: { queue?: QueuePlayer[] }) {
  return (
    <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 shadow-sm">
      <CardHeader className="pb-3 border-b border-slate-200 dark:border-slate-800/60 flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Users className="h-4 w-4 text-emerald-600 dark:text-[#d4e938]" />
            Live Open-Play Queue
          </CardTitle>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
            {queue.length > 0
              ? `${queue.length} players waiting • Est. wait ~${queue.length * 3}m`
              : "0 players waiting • Courts ready"}
          </p>
        </div>
        <Link href="/queue">
          <Button variant="volt" size="sm" className="font-mono text-xs shadow-xs">
            <Plus className="h-3.5 w-3.5 mr-1" />
            Join Queue
          </Button>
        </Link>
      </CardHeader>

      <CardContent className="pt-3 divide-y divide-slate-200 dark:divide-slate-800/60">
        {queue.length === 0 ? (
          <div className="py-6 text-center space-y-2">
            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
              Queue is currently empty.
            </p>
            <Link
              href="/queue"
              className="inline-flex items-center justify-center text-xs font-bold text-emerald-600 dark:text-[#d4e938] hover:underline font-mono"
            >
              Enter Queue to Play Next →
            </Link>
          </div>
        ) : (
          queue.map((item) => (
            <div
              key={item.id}
              className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between group"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 font-mono text-xs font-bold text-slate-700 dark:text-slate-200 shadow-2xs">
                  #{item.position}
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    {item.name}
                    <Badge variant="secondary" className="text-[10px] py-0 px-1 font-mono">
                      DUPR {item.rating}
                    </Badge>
                  </div>
                  {item.partner && (
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      w/ {item.partner}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 font-mono text-xs text-slate-500 dark:text-slate-400">
                <span className="text-slate-400 dark:text-slate-500 text-[11px]">{item.waitTime}</span>
                <Badge variant="outline" className="text-[10px] py-0 px-1">
                  {item.type}
                </Badge>
              </div>
            </div>
          ))
        )}

        <div className="pt-3">
          <Link
            href="/queue"
            className="flex items-center justify-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 font-medium py-1 transition-colors"
          >
            <span>View Full Queue & Auto-Match Rules</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
