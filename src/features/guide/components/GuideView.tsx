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
  ShieldCheck,
  Zap,
  PlayCircle,
  Sparkles,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function GuideView() {
  const [activeTab, setActiveTab] = useState<"rules" | "player" | "matchstyles" | "faq">("rules");

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
            Pickleball Rules & Player Guide
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-3xl leading-relaxed">
            The official pickleball rulebook, scoring breakdown, game day rotation flows, and player FAQs.
          </p>
        </div>
      </div>

      {/* Interactive Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 font-mono text-xs overflow-x-auto gap-1">
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
          1. Pickleball Rules 101
        </button>
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
          2. Player Game Day Flow
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
          3. Match Styles & Rotations
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
          <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-6 space-y-5 shadow-sm">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Layers className="h-5 w-5 text-emerald-500" />
                Supported Match Styles & Rotation Formats
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-mono pt-1">
                DCTECH Pickleball features a custom automated matching engine. Administrators can select the rotation strategy per session to match the evening&apos;s goal:
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* 1. Balanced DUPR */}
              <div className="rounded-2xl border border-emerald-500/40 bg-emerald-50/40 dark:bg-emerald-950/20 p-5 space-y-3 flex flex-col justify-between shadow-2xs">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Badge variant="volt" className="text-[10px] font-mono font-bold">
                      RECOMMENDED
                    </Badge>
                    <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                      Algorithm Pairing
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    1. Balanced DUPR Matching
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    Sorts the 4 called players by skill rating: <strong>Team A (#1 Best + #4 Lowest)</strong> vs <strong>Team B (#2 + #3 Middle)</strong>.
                  </p>
                </div>
                <div className="rounded-xl bg-white/80 dark:bg-slate-900/80 p-3 border border-emerald-500/20 text-[11px] font-mono text-slate-600 dark:text-slate-400 space-y-1">
                  <div><strong>Strategy:</strong> Equalizes combined team DUPR.</div>
                  <div><strong>Best For:</strong> Competitive matches without blowouts.</div>
                </div>
              </div>

              {/* 2. Social Mix */}
              <div className="rounded-2xl border border-purple-500/30 bg-purple-50/40 dark:bg-purple-950/20 p-5 space-y-3 flex flex-col justify-between shadow-2xs">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900/60 dark:text-purple-300 border-purple-300 dark:border-purple-800 text-[10px] font-mono font-bold">
                      CASUAL / SOCIAL
                    </Badge>
                    <span className="text-xs font-mono text-purple-600 dark:text-purple-400 font-bold">
                      Shuffle
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    2. Social Mixer
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    Shuffles called players to minimize repeat partners and opponents across games, disregarding ratings.
                  </p>
                </div>
                <div className="rounded-xl bg-white/80 dark:bg-slate-900/80 p-3 border border-purple-500/20 text-[11px] font-mono text-slate-600 dark:text-slate-400 space-y-1">
                  <div><strong>Strategy:</strong> Maximizes player mingling and new interactions.</div>
                  <div><strong>Best For:</strong> Team building and welcome sessions.</div>
                </div>
              </div>

              {/* 3. Skill Separated */}
              <div className="rounded-2xl border border-sky-500/30 bg-sky-50/40 dark:bg-sky-950/20 p-5 space-y-3 flex flex-col justify-between shadow-2xs">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Badge className="bg-sky-100 text-sky-700 dark:bg-sky-900/60 dark:text-sky-300 border-sky-300 dark:border-sky-800 text-[10px] font-mono font-bold">
                      TIER BASED
                    </Badge>
                    <span className="text-xs font-mono text-sky-600 dark:text-sky-400 font-bold">
                      Skill Courts
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    3. Skill Separated
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    Groups similar skill levels together (e.g. <strong>Advanced vs Advanced</strong>, <strong>Beginner vs Beginner</strong>).
                  </p>
                </div>
                <div className="rounded-xl bg-white/80 dark:bg-slate-900/80 p-3 border border-sky-500/20 text-[11px] font-mono text-slate-600 dark:text-slate-400 space-y-1">
                  <div><strong>Strategy:</strong> High vs High and Beginner vs Beginner.</div>
                  <div><strong>Best For:</strong> High-paced competitive tournaments.</div>
                </div>
              </div>

              {/* 4. Winners / Losers */}
              <div className="rounded-2xl border border-amber-500/30 bg-amber-50/40 dark:bg-amber-950/20 p-5 space-y-3 flex flex-col justify-between shadow-2xs">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300 border-amber-300 dark:border-amber-800 text-[10px] font-mono font-bold">
                      KING OF COURT
                    </Badge>
                    <span className="text-xs font-mono text-amber-600 dark:text-amber-400 font-bold">
                      Split Winners
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    4. Winners / Losers
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    The winning pair stays on court, splits into opponents, and takes on 2 incoming challengers from the waiting queue.
                  </p>
                </div>
                <div className="rounded-xl bg-white/80 dark:bg-slate-900/80 p-3 border border-amber-500/20 text-[11px] font-mono text-slate-600 dark:text-slate-400 space-y-1">
                  <div><strong>Strategy:</strong> Winner stays and splits with challengers.</div>
                  <div><strong>Best For:</strong> Challenge ladders and court streaks.</div>
                </div>
              </div>

              {/* 5. Classic FIFO */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-5 space-y-3 flex flex-col justify-between shadow-2xs">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="text-[10px] font-mono font-bold">
                      CLASSIC
                    </Badge>
                    <span className="text-xs font-mono text-slate-500 dark:text-slate-400 font-bold">
                      4-On / 4-Off
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    5. Classic FIFO Rack
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    Strict queue order. The first 2 waiting players face off against the next 2 waiting players in line.
                  </p>
                </div>
                <div className="rounded-xl bg-white/80 dark:bg-slate-900/80 p-3 border border-slate-200 dark:border-slate-800 text-[11px] font-mono text-slate-600 dark:text-slate-400 space-y-1">
                  <div><strong>Strategy:</strong> Pure first-in, first-out rotation.</div>
                  <div><strong>Best For:</strong> Maximum court throughput and large turnouts.</div>
                </div>
              </div>

              {/* 6. Coworker Doubles Partner Lock */}
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-50/20 dark:bg-emerald-950/10 p-5 space-y-3 flex flex-col justify-between shadow-2xs">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Badge variant="volt" className="text-[10px] font-mono font-bold">
                      FEATURE
                    </Badge>
                    <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                      Team Pairing
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    6. Coworker Partner Lock
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    When joining with <strong>&quot;+ Coworker&quot;</strong>, the engine guarantees you stay on the same doubles team against 2 challengers.
                  </p>
                </div>
                <div className="rounded-xl bg-white/80 dark:bg-slate-900/80 p-3 border border-emerald-500/20 text-[11px] font-mono text-slate-600 dark:text-slate-400 space-y-1">
                  <div><strong>Strategy:</strong> Preserves premade doubles pairs.</div>
                  <div><strong>Best For:</strong> Coworkers training for doubles tournaments.</div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 1: Pickleball Rules 101 (Complete Official Rulebook) */}
      {activeTab === "rules" && (
        <div className="space-y-6">
          {/* Scoring Call Visual Banner */}
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
                <span className="h-6 w-6 rounded-lg bg-emerald-500 text-white font-bold flex items-center justify-center text-xs">1</span>
                <span><strong>9:</strong> Serving Score</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-6 w-6 rounded-lg bg-sky-500 text-white font-bold flex items-center justify-center text-xs">2</span>
                <span><strong>7:</strong> Receiving Score</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-6 w-6 rounded-lg bg-amber-500 text-white font-bold flex items-center justify-center text-xs">3</span>
                <span><strong>2:</strong> Server #1 or #2</span>
              </div>
            </div>
            <div className="max-w-2xl mx-auto rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-mono">
              <p>
                💡 <strong>The Game Start Exception:</strong> The game always begins at <span className="text-emerald-600 dark:text-emerald-400 font-bold">0 - 0 - 2</span>. The starting team only gets <strong>1 server turn</strong> to minimize first-serve advantage before a side-out occurs.
              </p>
            </div>
          </div>

          {/* The 5 Golden Rules */}
          <div className="space-y-3">
            <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-emerald-500" />
              The 5 Core Fundamental Rules
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* 1. Serve */}
              <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-5 space-y-2.5 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="h-7 w-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 font-mono font-bold text-xs flex items-center justify-center">
                    01
                  </div>
                  <Badge variant="outline" className="text-[10px] font-mono">SERVICE</Badge>
                </div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  1. The Underhand Serve
                </h4>
                <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-1.5 leading-relaxed list-disc list-inside">
                  <li>Paddle contact must be below the waist (navel level).</li>
                  <li>Swing must move in an upward arc; paddle head below wrist.</li>
                  <li>Feet must stay behind baseline until ball is struck.</li>
                  <li>Must land diagonally crosscourt past the 7ft Kitchen line.</li>
                  <li><strong>Drop Serve</strong> is allowed (dropped from natural height, struck off bounce).</li>
                </ul>
              </Card>

              {/* 2. Two-Bounce Rule */}
              <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-5 space-y-2.5 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="h-7 w-7 rounded-lg bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 font-mono font-bold text-xs flex items-center justify-center">
                    02
                  </div>
                  <Badge variant="outline" className="text-[10px] font-mono">BOUNCE</Badge>
                </div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-sky-500" />
                  2. The Two-Bounce Rule
                </h4>
                <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-1.5 leading-relaxed list-disc list-inside">
                  <li><strong>Bounce 1:</strong> Receiving team must let the serve bounce.</li>
                  <li><strong>Bounce 2:</strong> Serving team must let the return bounce.</li>
                  <li>After both bounces, both teams may hit volleys out of the air or play off the bounce.</li>
                  <li>Volleying the 2nd or 3rd shot is an immediate fault!</li>
                </ul>
              </Card>

              {/* 3. The Kitchen (NVZ) */}
              <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-5 space-y-2.5 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="h-7 w-7 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 font-mono font-bold text-xs flex items-center justify-center">
                    03
                  </div>
                  <Badge variant="outline" className="text-[10px] font-mono border-amber-500/40 text-amber-600 dark:text-amber-400">CRITICAL</Badge>
                </div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                  3. The Kitchen (NVZ)
                </h4>
                <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-1.5 leading-relaxed list-disc list-inside">
                  <li>7-foot zone on both sides of the net (Non-Volley Zone).</li>
                  <li>You cannot touch the kitchen or kitchen line while volleying in the air.</li>
                  <li>Momentum carrying you into the kitchen after a volley is a fault.</li>
                  <li><strong>Yes, you can enter the kitchen:</strong> You CAN step in anytime IF the ball bounces first.</li>
                </ul>
              </Card>

              {/* 4. Side-Out & Server Rotation */}
              <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-5 space-y-2.5 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="h-7 w-7 rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 font-mono font-bold text-xs flex items-center justify-center">
                    04
                  </div>
                  <Badge variant="outline" className="text-[10px] font-mono">ROTATION</Badge>
                </div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-purple-500" />
                  4. Side-Out Scoring System
                </h4>
                <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-1.5 leading-relaxed list-disc list-inside">
                  <li><strong>Only the serving team can score points.</strong></li>
                  <li>In doubles, Server 1 serves until losing a rally, then Server 2 serves.</li>
                  <li>When Server 2 loses the rally, a <strong>Side-Out</strong> occurs and the opponents serve.</li>
                  <li>Servers switch right/left courts only upon winning a point.</li>
                </ul>
              </Card>

              {/* 5. Win by 2 (To 11) */}
              <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-5 space-y-2.5 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="h-7 w-7 rounded-lg bg-lime-50 dark:bg-[#d4e938]/20 text-lime-700 dark:text-[#d4e938] font-mono font-bold text-xs flex items-center justify-center">
                    05
                  </div>
                  <Badge variant="outline" className="text-[10px] font-mono">VICTORY</Badge>
                </div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <Trophy className="h-4 w-4 text-emerald-600 dark:text-[#d4e938]" />
                  5. Game Victory (To 11, Win by 2)
                </h4>
                <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-1.5 leading-relaxed list-disc list-inside">
                  <li>Standard games are played to 11 points.</li>
                  <li>A team must win by a minimum margin of 2 points (e.g. 11–9, 12–10, 14–12).</li>
                  <li>Tournament sessions can be configured to 15 or 21 points (win by 2).</li>
                </ul>
              </Card>

              {/* 6. Line In/Out Rulings */}
              <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-5 space-y-2.5 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="h-7 w-7 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 font-mono font-bold text-xs flex items-center justify-center">
                    06
                  </div>
                  <Badge variant="outline" className="text-[10px] font-mono">BOUNDS</Badge>
                </div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-rose-500" />
                  6. Official Line Call Rulings
                </h4>
                <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-1.5 leading-relaxed list-disc list-inside">
                  <li><strong>Sidelines & Baselines:</strong> If the ball touches any part of the line, it is <strong>IN</strong>.</li>
                  <li><strong>Kitchen Line on Serve:</strong> If a serve hits the NVZ kitchen line, it is a <strong>FAULT (OUT)</strong>.</li>
                  <li>During live play, the kitchen line is part of the NVZ.</li>
                </ul>
              </Card>
            </div>
          </div>

          {/* Faults & Rally Enders Reference Table */}
          <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-6 space-y-4 shadow-sm">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Official Faults (What Ends a Rally & Causes a Turnover)
              </h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
                <span className="text-rose-600 dark:text-rose-400 font-bold">❌ Out of Bounds / Net</span>
                <p className="text-slate-600 dark:text-slate-400">Ball hit out of the court boundaries or failing to clear the net.</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
                <span className="text-rose-600 dark:text-rose-400 font-bold">❌ Kitchen Volley Fault</span>
                <p className="text-slate-600 dark:text-slate-400">Volleying while touching the kitchen, or momentum landing in the NVZ after hitting.</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
                <span className="text-rose-600 dark:text-rose-400 font-bold">❌ Two-Bounce Violation</span>
                <p className="text-slate-600 dark:text-slate-400">Volleying before the ball has bounced once on each side of the court.</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
                <span className="text-rose-600 dark:text-rose-400 font-bold">❌ Double Bounce</span>
                <p className="text-slate-600 dark:text-slate-400">Ball bouncing twice on the same side before being hit.</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
                <span className="text-rose-600 dark:text-rose-400 font-bold">❌ Body / Clothing Contact</span>
                <p className="text-slate-600 dark:text-slate-400">Ball touching any player, clothing, or accessory before bouncing.</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
                <span className="text-rose-600 dark:text-rose-400 font-bold">❌ Net Touch</span>
                <p className="text-slate-600 dark:text-slate-400">Touching the net, net posts, or opponent&apos;s court while the ball is in play.</p>
              </div>
            </div>
          </Card>

          {/* Singles vs Doubles Differences */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-5 space-y-2 shadow-sm">
              <Badge variant="volt" className="text-[10px] font-mono font-bold">DOUBLES (2v2)</Badge>
              <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">Doubles Scoring & Rotation</h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-mono">
                Uses the 3-number call (<span className="text-emerald-600 dark:text-emerald-400 font-bold">Score - Opponent - Server</span>). Both partners get a turn to serve before side-out (except 0-0-2 at start).
              </p>
            </Card>

            <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-5 space-y-2 shadow-sm">
              <Badge variant="secondary" className="text-[10px] font-mono font-bold">SINGLES (1v1)</Badge>
              <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">Singles Scoring & Rotation</h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-mono">
                Uses a 2-number call (<span className="text-emerald-600 dark:text-emerald-400 font-bold">Server - Receiver</span>). Serve from <strong>Right</strong> when your score is even (0, 2, 4...), and from <strong>Left</strong> when odd (1, 3, 5...).
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

          <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-5 space-y-2 shadow-sm">
            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <HelpCircle className="h-4 w-4 text-emerald-500" />
              Can I use this app on my iPhone, Android, or iPad at the venue?
            </h4>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-mono">
              Yes! The app is 100% mobile-friendly with a native bottom bar. You can also tap <strong>&quot;Add to Home Screen&quot;</strong> in your mobile browser (Safari / Chrome) to install it as a standalone full-screen app.
            </p>
          </Card>
        </div>
      )}
    </div>
  );
}
