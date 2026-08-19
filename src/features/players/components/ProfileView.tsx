"use client";

import { useState } from "react";
import { User, Trophy, Flame, LogOut, CheckCircle2, Award, Calendar, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { signOut } from "@/features/auth/api/authActions";
import { formatRating } from "@/lib/utils";
import type { Profile } from "@/types";

interface ProfileViewProps {
  profile: Profile;
  matches?: any[];
}

export function ProfileView({ profile, matches = [] }: ProfileViewProps) {
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const winRate = profile.games_played > 0
    ? Math.round((profile.games_won / profile.games_played) * 100)
    : 0;

  async function handleLogout() {
    setIsLoggingOut(true);
    await signOut();
  }

  const displayMatches = matches;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 space-y-8">
      {/* Profile Header Card */}
      <Card className="border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 shadow-md backdrop-blur-md">
        <CardContent className="p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl border-2 border-emerald-500/40 bg-emerald-50 dark:bg-slate-950 font-mono text-2xl font-bold text-emerald-600 dark:text-emerald-400 shadow-md shadow-emerald-500/10">
              {profile.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.avatar_url}
                  alt={profile.full_name || "Avatar"}
                  className="h-full w-full rounded-2xl object-cover"
                />
              ) : (
                profile.full_name ? profile.full_name.slice(0, 2).toUpperCase() : "DC"
              )}
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
                  {profile.full_name || profile.display_name || "DCTECH Employee"}
                </h1>
                <Badge variant={profile.role === "admin" ? "volt" : "secondary"} className="text-xs uppercase font-mono">
                  {profile.role}
                </Badge>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">{profile.email}</p>
              <div className="flex items-center gap-2 pt-1">
                <Badge variant="default" className="text-xs font-mono">
                  ★ DUPR {formatRating(profile.skill_rating)}
                </Badge>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Verified Employee
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="text-xs text-rose-500 dark:text-red-400 hover:bg-rose-50 dark:hover:bg-red-950/40 border-rose-500/30 w-full sm:w-auto"
            >
              <LogOut className="h-3.5 w-3.5 mr-1.5" />
              {isLoggingOut ? "Signing out..." : "Sign Out"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Player Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-4 text-center shadow-xs">
          <div className="text-xs font-mono text-slate-500 dark:text-slate-400">GAMES PLAYED</div>
          <div className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 mt-1">
            {profile.games_played}
          </div>
        </Card>

        <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-4 text-center shadow-xs">
          <div className="text-xs font-mono text-slate-500 dark:text-slate-400">GAMES WON</div>
          <div className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">
            {profile.games_won}
          </div>
        </Card>

        <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-4 text-center shadow-xs">
          <div className="text-xs font-mono text-slate-500 dark:text-slate-400">WIN RATE</div>
          <div className="text-3xl font-extrabold text-emerald-700 dark:text-[#d4e938] mt-1">
            {winRate}%
          </div>
        </Card>

        <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-4 text-center shadow-xs">
          <div className="text-xs font-mono text-slate-500 dark:text-slate-400">SKILL RATING</div>
          <div className="text-3xl font-extrabold text-sky-600 dark:text-sky-400 mt-1 font-mono">
            {formatRating(profile.skill_rating)}
          </div>
        </Card>
      </div>

      {/* Match History Table */}
      <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 shadow-sm">
        <CardHeader className="pb-3 border-b border-slate-200 dark:border-slate-800/60 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Trophy className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
              Recent Match History
            </CardTitle>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Verified game scores & open-play log
            </p>
          </div>
          <Badge variant="outline" className="font-mono text-xs">
            {displayMatches.length} Matches Logged
          </Badge>
        </CardHeader>

        <CardContent className="pt-3 divide-y divide-slate-200 dark:divide-slate-800/60">
          {displayMatches.length === 0 ? (
            <div className="py-8 text-center font-mono text-xs text-slate-400 space-y-2">
              <Trophy className="h-6 w-6 text-slate-400 dark:text-slate-600 mx-auto" />
              <p className="text-slate-700 dark:text-slate-300 font-semibold">No Matches Played Yet</p>
              <p className="text-slate-500 text-[11px]">
                Check in to an open-play session and record your first match to start tracking your DUPR progress!
              </p>
            </div>
          ) : (
            displayMatches.map((m, idx) => (
              <div key={idx} className="py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-lg font-mono text-xs font-bold ${
                      m.result === "WIN"
                        ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-700"
                    }`}
                  >
                    {m.result}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                      {m.court} • {m.format}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                      {m.date} • {m.type}
                    </div>
                  </div>
                </div>

                <div className="text-right font-mono">
                  <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    {m.score}
                  </div>
                  <div className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center justify-end gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Verified
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
