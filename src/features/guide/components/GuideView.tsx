"use client";

import { useState } from "react";
import {
  Activity,
  BookOpen,
  ClipboardList,
  HelpCircle,
  Layers,
  Search,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  ADMIN_GUIDE_SECTIONS,
  STAFF_GUIDE_SECTIONS,
  getVisibleGuideTabs,
  type GuideTabId,
} from "@/features/guide/data/guideData";
import { RulesSection } from "@/features/guide/components/RulesSection";
import { PlayerFlowSection } from "@/features/guide/components/PlayerFlowSection";
import { MatchStylesSection } from "@/features/guide/components/MatchStylesSection";
import { FaqSection } from "@/features/guide/components/FaqSection";
import { StaffAdminSection } from "@/features/guide/components/StaffAdminSection";

interface GuideViewProps {
  initialTab?: GuideTabId;
  canViewStaff?: boolean;
  canViewAdmin?: boolean;
}

function TabIcon({ id }: { id: GuideTabId }) {
  switch (id) {
    case "rules":
      return <Activity className="h-4 w-4" />;
    case "flow":
      return <Users className="h-4 w-4" />;
    case "matchstyles":
      return <Layers className="h-4 w-4" />;
    case "faq":
      return <HelpCircle className="h-4 w-4" />;
    case "staff":
      return <ClipboardList className="h-4 w-4" />;
    case "admin":
      return <ShieldCheck className="h-4 w-4" />;
  }
}

export function GuideView({
  initialTab = "rules",
  canViewStaff = false,
  canViewAdmin = false,
}: GuideViewProps) {
  const visibleTabs = getVisibleGuideTabs({ canViewStaff, canViewAdmin });
  const [activeTab, setActiveTab] = useState<GuideTabId>(initialTab);
  const [query, setQuery] = useState("");

  const handleSelectTab = (tabId: GuideTabId) => {
    setActiveTab(tabId);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", tabId);
      window.history.replaceState(null, "", url.toString());
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 space-y-8">
      {/* Header */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 p-6 sm:p-8 backdrop-blur-md shadow-sm transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="volt" className="text-xs font-mono font-bold">
                PLAYER HANDBOOK & RULES
              </Badge>
              <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                DCTECH Recreation Committee
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
              <BookOpen className="h-7 w-7 text-emerald-500 dark:text-emerald-400" />
              Pickleball Rules & Player Guide
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-2xl leading-relaxed">
              The official pickleball rulebook, scoring breakdown, game day workflows, match styles,
              and FAQs.
            </p>
          </div>

          <div className="relative w-full sm:w-64 shrink-0">
            <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter current tab..."
              aria-label="Filter guide content"
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 pl-8 pr-8 py-2 text-xs font-mono text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear filter"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Interactive Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 font-mono text-xs overflow-x-auto gap-1">
        {visibleTabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleSelectTab(tab.id)}
              className={`px-4 py-3 font-bold border-b-2 whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                isActive
                  ? "border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20"
                  : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              <TabIcon id={tab.id} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === "rules" && <RulesSection query={query} />}
      {activeTab === "flow" && <PlayerFlowSection query={query} />}
      {activeTab === "matchstyles" && <MatchStylesSection query={query} />}
      {activeTab === "faq" && <FaqSection query={query} />}
      {activeTab === "staff" && canViewStaff && (
        <StaffAdminSection
          sections={STAFF_GUIDE_SECTIONS}
          query={query}
          emptyLabel={`No staff guide items matched "${query}".`}
        />
      )}
      {activeTab === "admin" && canViewAdmin && (
        <StaffAdminSection
          sections={ADMIN_GUIDE_SECTIONS}
          query={query}
          emptyLabel={`No admin guide items matched "${query}".`}
        />
      )}
    </div>
  );
}
