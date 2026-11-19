"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { Eye, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

let spotlightActive = false;
const spotlightListeners = new Set<() => void>();

function setSpotlight(next: boolean) {
  spotlightActive = next;
  if (typeof document !== "undefined") {
    if (next) document.documentElement.setAttribute("data-bg-spotlight", "true");
    else document.documentElement.removeAttribute("data-bg-spotlight");
  }
  spotlightListeners.forEach((l) => l());
}

function subscribeSpotlight(listener: () => void) {
  spotlightListeners.add(listener);
  return () => {
    spotlightListeners.delete(listener);
  };
}

function getSpotlightSnapshot() {
  return spotlightActive;
}

function getSpotlightServerSnapshot() {
  return false;
}

export function BackgroundSpotlightButton() {
  const active = useSyncExternalStore(
    subscribeSpotlight,
    getSpotlightSnapshot,
    getSpotlightServerSnapshot
  );

  return (
    <button
      type="button"
      onClick={() => setSpotlight(!active)}
      title="View animated pickleball background"
      aria-label="View animated pickleball background"
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:border-emerald-500/40 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors cursor-pointer"
    >
      <Eye className="h-4 w-4" />
    </button>
  );
}

let cachedAvatars: string[] | null = null;
let inflightAvatars: Promise<string[]> | null = null;

async function loadPlayerAvatars(): Promise<string[]> {
  if (cachedAvatars) return cachedAvatars;
  if (inflightAvatars) return inflightAvatars;

  const supabase = createClient();
  inflightAvatars = (async () => {
    try {
      const { data } = await supabase
        .from("profiles")
        .select("avatar_url")
        .eq("is_active", true)
        .not("avatar_url", "is", null)
        .neq("avatar_url", "");

      const urls = (data ?? [])
        .map((row) => row.avatar_url)
        .filter((url): url is string => typeof url === "string" && url.trim().length > 0);
      cachedAvatars = urls;
      return urls;
    } catch {
      return [];
    } finally {
      inflightAvatars = null;
    }
  })();

  return inflightAvatars;
}

function pickCourtCast(pool: string[]): { rally: string[]; audience: string[] } {
  if (pool.length === 0) return { rally: [], audience: [] };
  const copy = [...pool];
  // Fisher-Yates shuffle for unbiased random selection
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  const rally = Array.from({ length: 4 }, (_, idx) => copy[idx % copy.length]);
  const rallySet = new Set(rally);
  const audience = copy.filter((url) => !rallySet.has(url));
  return { rally, audience };
}

function PickleballSvg({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" className={className}>
      <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="2.5" fill="currentColor" fillOpacity="0.14" />
      <circle cx="22" cy="22" r="3.2" fill="currentColor" />
      <circle cx="38" cy="19" r="3.2" fill="currentColor" />
      <circle cx="46" cy="33" r="3.2" fill="currentColor" />
      <circle cx="31" cy="34" r="3.2" fill="currentColor" />
      <circle cx="19" cy="40" r="3.2" fill="currentColor" />
      <circle cx="37" cy="46" r="3.2" fill="currentColor" />
    </svg>
  );
}

function RallyPlayer({
  paddleClass,
  positionClass,
  avatarUrl,
  spotlight,
  facing = "right",
}: {
  paddleClass: string;
  positionClass: string;
  avatarUrl?: string;
  spotlight: boolean;
  facing?: "left" | "right";
}) {
  return (
    <div
      className={`absolute flex flex-col items-center origin-center scale-75 sm:scale-90 lg:scale-100 ${positionClass} ${paddleClass} transition-opacity duration-300 ${
        spotlight ? "opacity-95" : "opacity-55 dark:opacity-50"
      }`}
    >
      <div className={`relative flex flex-col items-center ${facing === "left" ? "-scale-x-100" : ""}`}>
        {/* Avatar Head centered over the stickman's neck */}
        <div
          className={`relative z-10 h-10 w-10 sm:h-11 sm:w-11 rounded-full overflow-hidden border-2 border-emerald-600/80 dark:border-emerald-400/80 shadow-sm bg-white dark:bg-slate-900 flex items-center justify-center ${
            facing === "left" ? "-scale-x-100" : ""
          }`}
        >
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt=""
              width={44}
              height={44}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="h-3 w-3 rounded-full bg-emerald-600/60 dark:bg-emerald-400/60" />
          )}
        </div>

        {/* Clean athletic stickman body + properly gripped swinging paddle */}
        <svg
          viewBox="0 0 110 92"
          fill="none"
          className="-mt-1 h-20 w-24 sm:h-24 sm:w-28 text-emerald-700 dark:text-emerald-400 overflow-visible"
        >
          {/* Neck & upright athletic torso (centered at x=55) */}
          <line x1="55" y1="0" x2="53" y2="40" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />

          {/* Back balance arm */}
          <path
            d="M54 12 L34 22 L28 14"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Athletic bent-knee stance legs */}
          <path
            d="M53 40 L38 62 L32 82 L26 82"
            stroke="currentColor"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M53 40 L68 60 L72 82 L79 82"
            stroke="currentColor"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Shoulder anchor (keeps translate separate from CSS rotate) */}
          <g transform="translate(54 13)">
            <g className="arm-swing">
              {/* Front forearm reaching forward */}
              <path
                d="M0 0 L18 8 L36 6"
                stroke="currentColor"
                strokeWidth="3.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Hand gripping bottom of paddle handle, paddle angled forward clear of head */}
              <g transform="translate(36 6) rotate(32)">
                <rect x="-2.5" y="-12" width="5" height="14" rx="2" fill="currentColor" />
                <rect
                  x="-11"
                  y="-40"
                  width="22"
                  height="29"
                  rx="8"
                  stroke="currentColor"
                  strokeWidth="2.6"
                  fill="currentColor"
                  fillOpacity="0.22"
                />
              </g>
            </g>
          </g>
        </svg>
      </div>
    </div>
  );
}

function AudienceSpectator({
  avatarUrl,
  delayMs,
  spotlight,
}: {
  avatarUrl: string;
  delayMs: number;
  spotlight: boolean;
}) {
  return (
    <div
      style={{ animationDelay: `${delayMs}ms` }}
      className={`audience-cheer flex flex-col items-center transition-opacity duration-300 ${
        spotlight ? "opacity-95" : "opacity-45 dark:opacity-40"
      }`}
    >
      <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-full overflow-hidden border-2 border-emerald-600/60 dark:border-emerald-400/60 bg-white dark:bg-slate-900 shadow-xs">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={avatarUrl}
          alt=""
          width={32}
          height={32}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
        />
      </div>
      {/* Little cheering stickman shoulders */}
      <svg viewBox="0 0 32 18" fill="none" className="-mt-0.5 h-3.5 w-7 text-emerald-700 dark:text-emerald-400">
        <path
          d="M16 1 L16 14 M16 6 L6 2 M16 6 L26 2"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

/**
 * Combined site-wide pickleball background:
 * - Soft emerald/volt stadium ambient glows
 * - Subtle court blueprint + 2v2 doubles paddle-and-ball rally with random player avatars
 * - Multi-depth floating pickleballs over a perforated dot-grid
 */
export function PickleballCourtBackground() {
  const pathname = usePathname();
  const isAuthScreen = pathname === "/login" || pathname === "/set-password";
  const [cast, setCast] = useState<{ rally: string[]; audience: string[] }>({
    rally: [],
    audience: [],
  });
  const spotlight = useSyncExternalStore(
    subscribeSpotlight,
    getSpotlightSnapshot,
    getSpotlightServerSnapshot
  );

  useEffect(() => {
    if (!spotlight) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSpotlight(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [spotlight]);

  useEffect(() => {
    if (isAuthScreen) return;
    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    void loadPlayerAvatars().then((pool) => {
      if (cancelled || pool.length === 0) return;
      setCast(pickCourtCast(pool));
      if (pool.length > 1) {
        intervalId = setInterval(() => {
          setCast(pickCourtCast(pool));
        }, 16000);
      }
    });

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, [isAuthScreen]);

  const rallyAvatars = cast.rally;
  const halfAudience = Math.ceil(cast.audience.length / 2);
  const topAudience = cast.audience.slice(0, halfAudience);
  const bottomAudience = cast.audience.slice(halfAudience);

  return (
    <>
      <div
        aria-hidden="true"
        className={`pointer-events-none fixed inset-0 overflow-hidden select-none transition-all duration-300 ${
          spotlight ? "z-30" : "-z-10"
        }`}
      >
        {/* Soft stadium ambient glows */}
        <div className="court-glow-drift absolute -top-32 left-1/4 h-[28rem] w-[28rem] rounded-full bg-emerald-500/[0.07] dark:bg-emerald-500/[0.11] blur-3xl" />
        <div className="court-glow-drift absolute -bottom-32 right-1/4 h-[26rem] w-[26rem] rounded-full bg-lime-400/[0.08] dark:bg-[#d4e938]/[0.07] blur-3xl [animation-delay:-8s]" />

        {/* Court blueprint, perforated dot-grid, and bouncing pickleball */}
        <svg
          className={`court-float absolute inset-0 h-full w-full transition-colors duration-300 ${
            spotlight
              ? "text-emerald-700/30 dark:text-emerald-400/35"
              : "text-emerald-700/[0.11] dark:text-emerald-400/[0.13]"
          }`}
          viewBox="0 0 1200 800"
          preserveAspectRatio="xMidYMid slice"
          fill="none"
        >
          <defs>
            <pattern id="pb-dot-grid" width="32" height="32" patternUnits="userSpaceOnUse">
              <circle cx="16" cy="16" r="1.2" fill="currentColor" opacity="0.6" />
            </pattern>
          </defs>

          <rect width="1200" height="800" fill="url(#pb-dot-grid)" />

          {/* Centered pickleball court */}
          <g transform="translate(600 400) rotate(-12) translate(-440 -200)">
            <rect x="0" y="0" width="880" height="400" rx="12" stroke="currentColor" strokeWidth="2" />
            <rect x="300" y="0" width="280" height="400" fill="currentColor" fillOpacity="0.16" />
            <line x1="300" y1="0" x2="300" y2="400" stroke="currentColor" strokeWidth="2" />
            <line x1="580" y1="0" x2="580" y2="400" stroke="currentColor" strokeWidth="2" />
            <line
              x1="440"
              y1="-14"
              x2="440"
              y2="414"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeDasharray="8 6"
            />
            <line x1="0" y1="200" x2="300" y2="200" stroke="currentColor" strokeWidth="1.75" />
            <line x1="580" y1="200" x2="880" y2="200" stroke="currentColor" strokeWidth="1.75" />
          </g>

          {/* Bouncing pickleball rallying diagonally across all 4 doubles corners */}
          <g
            className={`pickleball-rally transition-colors duration-300 ${
              spotlight
                ? "text-lime-600 dark:text-[#d4e938]"
                : "text-lime-600/50 dark:text-[#d4e938]/50"
            }`}
            transform="translate(160 240)"
          >
            <circle cx="0" cy="0" r="20" stroke="currentColor" strokeWidth="2.5" fill="currentColor" fillOpacity="0.22" />
            <circle cx="-6" cy="-5" r="2.6" fill="currentColor" />
            <circle cx="6" cy="-7" r="2.6" fill="currentColor" />
            <circle cx="9" cy="3" r="2.6" fill="currentColor" />
            <circle cx="-2" cy="4" r="2.6" fill="currentColor" />
            <circle cx="-8" cy="8" r="2.6" fill="currentColor" />
            <circle cx="4" cy="10" r="2.6" fill="currentColor" />
          </g>
        </svg>

        {/* 2v2 Doubles Rallying Stickmen positioned behind the left & right baselines */}
        <RallyPlayer
          paddleClass="paddle-tl-swing"
          positionClass="top-[28%] left-1 sm:left-4 lg:left-[6%]"
          avatarUrl={rallyAvatars[0]}
          spotlight={spotlight}
          facing="right"
        />
        <RallyPlayer
          paddleClass="paddle-bl-swing"
          positionClass="bottom-24 sm:bottom-[16%] left-1 sm:left-6 lg:left-[9%]"
          avatarUrl={rallyAvatars[1]}
          spotlight={spotlight}
          facing="right"
        />
        <RallyPlayer
          paddleClass="paddle-tr-swing"
          positionClass="top-24 sm:top-[18%] right-1 sm:right-6 lg:right-[9%]"
          avatarUrl={rallyAvatars[2]}
          spotlight={spotlight}
          facing="left"
        />
        <RallyPlayer
          paddleClass="paddle-br-swing"
          positionClass="bottom-28 sm:bottom-[24%] right-1 sm:right-4 lg:right-[6%]"
          avatarUrl={rallyAvatars[3]}
          spotlight={spotlight}
          facing="left"
        />

        {/* Sideline Audience (positioned clear of sticky top navbar & mobile bottom nav) */}
        {topAudience.length > 0 && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[90vw] sm:w-[78vw] max-w-4xl flex flex-wrap items-end justify-center gap-2 sm:gap-3.5">
            {topAudience.map((url, idx) => (
              <AudienceSpectator
                key={`top-${idx}-${url}`}
                avatarUrl={url}
                delayMs={(idx % 6) * 300}
                spotlight={spotlight}
              />
            ))}
          </div>
        )}
        {bottomAudience.length > 0 && (
          <div className="absolute bottom-20 lg:bottom-4 left-1/2 -translate-x-1/2 w-[90vw] sm:w-[78vw] max-w-4xl flex flex-wrap items-end justify-center gap-2 sm:gap-3.5">
            {bottomAudience.map((url, idx) => (
              <AudienceSpectator
                key={`bot-${idx}-${url}`}
                avatarUrl={url}
                delayMs={(idx % 6) * 320 + 150}
                spotlight={spotlight}
              />
            ))}
          </div>
        )}

        {/* Multi-depth floating pickleballs */}
        <div
          className={`pb-float-b absolute top-[14%] right-[18%] transition-colors duration-300 ${
            spotlight ? "text-lime-600/80 dark:text-[#d4e938]/80" : "text-lime-600/25 dark:text-[#d4e938]/25"
          }`}
        >
          <PickleballSvg className="h-12 w-12" />
        </div>
        <div
          className={`pb-float-c absolute bottom-[14%] left-[24%] transition-colors duration-300 [animation-delay:-5s] ${
            spotlight ? "text-lime-600/75 dark:text-[#d4e938]/75" : "text-lime-600/20 dark:text-[#d4e938]/20"
          }`}
        >
          <PickleballSvg className="h-10 w-10" />
        </div>
        <div
          className={`pb-float-a hidden md:block absolute top-[44%] right-[24%] transition-colors duration-300 [animation-delay:-9s] ${
            spotlight ? "text-emerald-600/70 dark:text-emerald-400/70" : "text-emerald-600/20 dark:text-emerald-400/20"
          }`}
        >
          <PickleballSvg className="h-8 w-8" />
        </div>
        <div
          className={`pb-float-b hidden sm:block absolute bottom-[8%] left-[48%] transition-colors duration-300 [animation-delay:-11s] ${
            spotlight ? "text-lime-600/70 dark:text-[#d4e938]/70" : "text-lime-600/20 dark:text-[#d4e938]/20"
          }`}
        >
          <PickleballSvg className="h-10 w-10" />
        </div>
      </div>

      {spotlight && (
        <button
          type="button"
          onClick={() => setSpotlight(false)}
          className="fixed top-4 right-4 z-50 inline-flex items-center gap-1.5 rounded-full border border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 px-3.5 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 shadow-lg backdrop-blur-md hover:border-emerald-500/50 transition-colors cursor-pointer"
        >
          <X className="h-3.5 w-3.5" />
          <span>Back to App</span>
        </button>
      )}
    </>
  );
}
