"use client";

import { useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  HelpCircle,
  Users,
  Trophy,
  Activity,
  CheckCircle2,
  AlertCircle,
  Volume2,
  Layers,
  PlusCircle,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function GuideView() {
  const [activeTab, setActiveTab] = useState<"player" | "matchstyles" | "rules" | "faq">("player");

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 space-y-8">
      {/* Header */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 p-6 sm:p-8 backdrop-blur-md shadow-sm transition-colors">
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
            Pickleball Player & Rules Guide
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-3xl leading-relaxed">
            Everything you need to know to participate in open play, queue up with colleagues, learn pickleball scoring rules, and climb the company DUPR leaderboard.
          </p>
        </div>
      </div>

      {/* Interactive Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 font-mono text-xs overflow-x-auto gap-1">
        <button
          type="button"
          onClick={() => setActiveTab("player")}
          className={`px-4 py-3 font-bold border-b-2 whitespace-nowrap transition-colors flex items-center gap-1.5 ${
            activeTab === "player"
              ? "border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20"
              : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <Users className="h-4 w-4" />
          1. Player Game Day Flow
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("matchstyles")}
          className={`px-4 py-3 font-bold border-b-2 whitespace-nowrap transition-colors flex items-center gap-1.5 ${
            activeTab === "matchstyles"
              ? "border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20"
              : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <Layers className="h-4 w-4" />
          2. Match Styles & Rotations
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("rules")}
          className={`px-4 py-3 font-bold border-b-2 whitespace-nowrap transition-colors flex items-center gap-1.5 ${
            activeTab === "rules"
              ? "border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20"
              : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <Activity className="h-4 w-4" />
          3. Pickleball Rules 101
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("faq")}
          className={`px-4 py-3 font-bold border-b-2 whitespace-nowrap transition-colors flex items-center gap-1.5 ${
            activeTab === "faq"
              ? "border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20"
              : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <HelpCircle className="h-4 w-4" />
          4. Player FAQs
        </button>
      </div>

      {/* TAB 1: Player Game Day Flow */}
      {activeTab === "player" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-5 space-y-3 shadow-sm">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono font-bold text-sm">
                01
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Join the Queue</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Log into the app. Head to the <strong>Queue</strong> tab and tap <strong>&quot;Join Open-Play Queue&quot;</strong>. (Joining automatically registers your attendance for today&apos;s session!).
              </p>
            </Card>

            <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-5 space-y-3 shadow-sm">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-lime-50 dark:bg-[#d4e938]/10 text-lime-700 dark:text-[#d4e938] font-mono font-bold text-sm">
                02
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Choose Partner Mode</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                You can join the rotation as a <strong>Solo Player</strong> or pair up with a registered <strong>Coworker</strong> to guarantee you play on the same doubles team.
              </p>
            </Card>

            <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-5 space-y-3 shadow-sm">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 font-mono font-bold text-sm">
                03
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Live Court Call-Up</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Watch your position in line. When an arena court opens, the screen alerts you: <span className="text-slate-800 dark:text-slate-200 font-bold">&quot;Court 1 Ready!&quot;</span>. Walk over and begin your match!
              </p>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-5 space-y-3 shadow-sm">
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-emerald-500" />
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">Live Arena Scoreboards</h4>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-mono">
                The home screen displays live scores and timers for all active facility courts, streaming referee updates in real time without refreshing.
              </p>
            </Card>

            <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-5 space-y-3 shadow-sm">
              <div className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-amber-500" />
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">Company Leaderboard & Ratings</h4>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-mono">
                Official scores recorded by administrators automatically adjust your DUPR skill rating and update the Gold, Silver, and Bronze podium in the <strong>Rankings</strong> tab.
              </p>
            </Card>
          </div>
        </div>
      )}

      {/* TAB 2: Match Styles & Rotations */}
      {activeTab === "matchstyles" && (
        <div className="space-y-6">
          <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-6 space-y-4 shadow-sm">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Layers className="h-5 w-5 text-emerald-500" />
              Supported Match Styles & Rotation Formats
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-mono">
              Here is how different open play formats work so you know what to expect when you take the court:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              {/* Format 1 */}
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-50/40 dark:bg-emerald-950/20 p-5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <Badge variant="volt" className="text-[10px] font-mono font-bold">DEFAULT</Badge>
                  <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400 font-bold">4-On / 4-Off FIFO</span>
                </div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">Standard Open Play</h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Players line up in virtual paddle racks. When a match ends, all 4 players step off the court, and the next 4 waiting players enter.
                </p>
                <div className="text-[11px] font-mono text-slate-500 pt-1">
                  <strong>Best for:</strong> Equal playing time, casual mixing, and large employee turnouts.
                </div>
              </div>

              {/* Format 2 */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-[10px] font-mono font-bold">COMPETITIVE</Badge>
                  <span className="text-xs font-mono text-amber-600 dark:text-amber-400 font-bold">Winners Stay</span>
                </div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">King of the Court</h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  The winning pair stays on court (splits into opponents). The 2 losing players return to the queue, and 2 new challengers enter.
                </p>
                <div className="text-[11px] font-mono text-slate-500 pt-1">
                  <strong>Best for:</strong> High-tempo rotations and challenging top-ranked players.
                </div>
              </div>

              {/* Format 3 */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-[10px] font-mono font-bold">BALANCED</Badge>
                  <span className="text-xs font-mono text-sky-600 dark:text-sky-400 font-bold">Skill Matching</span>
                </div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">Balanced DUPR Pairing</h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  The rotation engine pairs players by DUPR skill level (e.g. #1 & #4 vs #2 & #3) so every match remains competitive and fun.
                </p>
                <div className="text-[11px] font-mono text-slate-500 pt-1">
                  <strong>Best for:</strong> Accurate skill calibration and balanced team play.
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 3: Pickleball Rules 101 */}
      {activeTab === "rules" && (
        <div className="space-y-6">
          <div className="rounded-2xl border-2 border-emerald-500/40 bg-slate-50 dark:bg-slate-950 p-6 text-center space-y-3 shadow-sm">
            <span className="text-xs font-mono text-slate-600 dark:text-slate-400 uppercase tracking-widest flex items-center justify-center gap-1.5">
              <Volume2 className="h-4 w-4 text-emerald-600 dark:text-[#d4e938]" />
              HOW PICKLEBALL SCORING CALLS WORK
            </span>
            <div className="text-4xl sm:text-5xl font-black font-mono text-emerald-700 dark:text-[#d4e938]">
              9 - 7 - 2
            </div>
            <div className="flex flex-wrap items-center justify-center gap-6 text-xs font-mono text-slate-700 dark:text-slate-300 pt-2">
              <div><span className="text-emerald-600 dark:text-emerald-400 font-bold">9:</span> Serving Team Score</div>
              <div><span className="text-sky-600 dark:text-sky-400 font-bold">7:</span> Receiving Team Score</div>
              <div><span className="text-emerald-700 dark:text-[#d4e938] font-bold">2:</span> Server #1 or #2</div>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 pt-2 max-w-lg mx-auto leading-relaxed">
              Only the team currently serving can score points. If the receiver wins the rally, no point is awarded—they earn a &quot;Side-Out&quot; to become the server.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-5 space-y-2 shadow-sm">
              <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                1. The Serve
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Must be hit underhand, diagonally crosscourt, and clear the 7-foot Kitchen line into the opposing service box.
              </p>
            </Card>

            <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-5 space-y-2 shadow-sm">
              <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                2. Two-Bounce Rule
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                The ball must bounce once on the receiving side and once on the serving side before either team is allowed to volley in the air.
              </p>
            </Card>

            <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-5 space-y-2 shadow-sm">
              <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <AlertCircle className="h-4 w-4 text-amber-500" />
                3. The Kitchen (NVZ)
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                You cannot step inside the 7ft Non-Volley Zone and hit a ball out of the air. You may only enter the kitchen if the ball bounces first.
              </p>
            </Card>
          </div>
        </div>
      )}

      {/* TAB 4: Player FAQ */}
      {activeTab === "faq" && (
        <div className="space-y-4">
          <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-5 space-y-2 shadow-sm">
            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <HelpCircle className="h-4 w-4 text-emerald-500" />
              What if I am called to a court but need a minute (tying shoes / arriving)?
            </h4>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-mono">
              Ask an organizer or click the <strong className="text-amber-500">⏩ Bump / Play Next</strong> button on your paddle card in the Queue screen. It shifts you down 1 game so ready players play immediately and you take the court in the very next match.
            </p>
          </Card>

          <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-5 space-y-2 shadow-sm">
            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <HelpCircle className="h-4 w-4 text-emerald-500" />
              Can I pair up with a specific colleague for Doubles?
            </h4>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-mono">
              Yes! In the Queue screen, choose &quot;+ Coworker&quot; and pick their name from the employee list. You will be assigned to the same team when called.
            </p>
          </Card>

          <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-5 space-y-2 shadow-sm">
            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <HelpCircle className="h-4 w-4 text-emerald-500" />
              How are match scores recorded and how does DUPR adjust?
            </h4>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-mono">
              To guarantee fairness and integrity across the company, all official match scores are recorded by tournament administrators or staff umpires. Winning against higher-rated opponents boosts your DUPR rating on the leaderboard.
            </p>
          </Card>
        </div>
      )}
    </div>
  );
}
