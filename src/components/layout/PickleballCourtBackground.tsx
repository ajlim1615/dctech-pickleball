"use client";

import { useEffect, useId, useState, useSyncExternalStore, type CSSProperties } from "react";
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

type Facing = "left" | "right";

type PlayerSpot = {
  x: number;
  y: number;
  size: number;
  facing: Facing;
  swing: string;
};

type CourtLayout = {
  viewBox: string;
  courtTransform: string;
  /** Rotation and scale inside `courtTransform`, so the crowd can be drawn upright at true size. */
  courtAngle: number;
  courtScale: number;
  /** Court size in its own (unrotated) units. Sidelines are the long edges. */
  courtWidth: number;
  courtHeight: number;
  /** Spectator avatar radius (screen units) and their distance outside the sideline (court units). */
  crowd: { radius: number; offset: number; maxRows: number };
  /**
   * Where the ball meets each paddle, at 0% / 25% / 50% / 75% of the 8s rally.
   * Must alternate teams so the ball always crosses the net, and must match the
   * paddle-*-swing timing of the player being hit.
   */
  rally: [number, number][];
  /** Order: top-left, bottom-left, top-right, bottom-right (matches rally avatar order). */
  players: PlayerSpot[];
};

/**
 * Wide screens: horizontal court tilted -12deg, teams behind the left/right baselines.
 * Rally: TL (left) -> BR (right) -> BL (left) -> TR (right).
 */
const LANDSCAPE_LAYOUT: CourtLayout = {
  viewBox: "0 0 1200 800",
  courtTransform: "translate(600 400) rotate(-12) translate(-440 -200)",
  courtAngle: -12,
  courtScale: 1,
  courtWidth: 880,
  courtHeight: 400,
  crowd: { radius: 20, offset: 52, maxRows: 2 },
  rally: [
    [141, 314],
    [1041, 362],
    [210, 532],
    [996, 164],
  ],
  players: [
    { x: 20, y: 300, size: 120, facing: "right", swing: "paddle-tl-swing" },
    { x: 65, y: 520, size: 120, facing: "right", swing: "paddle-bl-swing" },
    { x: 1020, y: 140, size: 120, facing: "left", swing: "paddle-tr-swing" },
    { x: 1065, y: 350, size: 120, facing: "left", swing: "paddle-br-swing" },
  ],
};

/**
 * Tall screens: upright court tilted -6deg, teams behind the top/bottom baselines.
 * Rally: TL (top) -> BR (bottom) -> TR (top) -> BL (bottom). TR and BL borrow the
 * bl/tr swing timings so each player swings when the ball reaches them.
 */
const PORTRAIT_LAYOUT: CourtLayout = {
  viewBox: "0 0 800 1200",
  courtTransform: "translate(400 600) rotate(-6) scale(0.9) translate(-200 -440)",
  courtAngle: -6,
  courtScale: 0.9,
  courtWidth: 400,
  courtHeight: 880,
  crowd: { radius: 24, offset: 62, maxRows: 3 },
  rally: [
    [232, 90],
    [560, 966],
    [527, 67],
    [292, 1002],
  ],
  players: [
    { x: 195, y: 44, size: 150, facing: "left", swing: "paddle-tl-swing" },
    { x: 275, y: 1010, size: 150, facing: "left", swing: "paddle-tr-swing" },
    { x: 375, y: 25, size: 150, facing: "right", swing: "paddle-bl-swing" },
    { x: 455, y: 992, size: 150, facing: "right", swing: "paddle-br-swing" },
  ],
};

/** Stick figure with avatar head, drawn in a 120x135 box and placed in court coordinates. */
function RallyPlayer({
  spot,
  avatarUrl,
  spotlight,
}: {
  spot: PlayerSpot;
  avatarUrl?: string;
  spotlight: boolean;
}) {
  const clipId = `pb-avatar-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return (
    <g
      className={`rally-player ${spot.swing} transition-opacity duration-300 ${
        spotlight ? "opacity-95" : "opacity-55 dark:opacity-50"
      }`}
    >
      <svg
        x={spot.x}
        y={spot.y}
        width={spot.size}
        height={(spot.size * 135) / 120}
        viewBox="0 0 120 135"
        overflow="visible"
        className="text-emerald-700 dark:text-emerald-400"
      >
        <defs>
          <clipPath id={clipId}>
            <circle cx="60" cy="22" r="20" />
          </clipPath>
        </defs>

        {/* Body + paddle, mirrored when facing left (head stays unmirrored) */}
        <g transform={spot.facing === "left" ? "translate(120 0) scale(-1 1)" : undefined}>
          <g transform="translate(5 40)">
            {/* Neck & upright athletic torso */}
            <line x1="55" y1="0" x2="53" y2="40" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
            {/* Back balance arm */}
            <path d="M54 12 L34 22 L28 14" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            {/* Bent-knee stance legs */}
            <path d="M53 40 L38 62 L32 82 L26 82" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M53 40 L68 60 L72 82 L79 82" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
            {/* Shoulder anchor (keeps translate separate from CSS rotate) */}
            <g transform="translate(54 13)">
              <g className="arm-swing">
                <path d="M0 0 L18 8 L36 6" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
                <g transform="translate(36 6) rotate(32)">
                  <rect x="-2.5" y="-12" width="5" height="14" rx="2" fill="currentColor" />
                  <rect x="-11" y="-40" width="22" height="29" rx="8" stroke="currentColor" strokeWidth="2.6" fill="currentColor" fillOpacity="0.22" />
                </g>
              </g>
            </g>
          </g>
        </g>

        {/* Avatar head centered over the neck */}
        <circle cx="60" cy="22" r="21" className="fill-white dark:fill-slate-900" />
        {avatarUrl ? (
          <image
            href={avatarUrl}
            x="40"
            y="2"
            width="40"
            height="40"
            preserveAspectRatio="xMidYMid slice"
            clipPath={`url(#${clipId})`}
          />
        ) : (
          <circle cx="60" cy="22" r="6" fill="currentColor" fillOpacity="0.6" />
        )}
        <circle cx="60" cy="22" r="21" stroke="currentColor" strokeOpacity="0.8" strokeWidth="2.5" />
      </svg>
    </g>
  );
}

function CourtLines({ orientation }: { orientation: "landscape" | "portrait" }) {
  if (orientation === "landscape") {
    return (
      <>
        <rect x="0" y="0" width="880" height="400" rx="12" stroke="currentColor" strokeWidth="2" />
        <rect x="300" y="0" width="280" height="400" fill="currentColor" fillOpacity="0.16" />
        <line x1="300" y1="0" x2="300" y2="400" stroke="currentColor" strokeWidth="2" />
        <line x1="580" y1="0" x2="580" y2="400" stroke="currentColor" strokeWidth="2" />
        <line x1="440" y1="-14" x2="440" y2="414" stroke="currentColor" strokeWidth="2.5" strokeDasharray="8 6" />
        <line x1="0" y1="200" x2="300" y2="200" stroke="currentColor" strokeWidth="1.75" />
        <line x1="580" y1="200" x2="880" y2="200" stroke="currentColor" strokeWidth="1.75" />
      </>
    );
  }
  return (
    <>
      <rect x="0" y="0" width="400" height="880" rx="12" stroke="currentColor" strokeWidth="2" />
      <rect x="0" y="300" width="400" height="280" fill="currentColor" fillOpacity="0.16" />
      <line x1="0" y1="300" x2="400" y2="300" stroke="currentColor" strokeWidth="2" />
      <line x1="0" y1="580" x2="400" y2="580" stroke="currentColor" strokeWidth="2" />
      <line x1="-14" y1="440" x2="414" y2="440" stroke="currentColor" strokeWidth="2.5" strokeDasharray="8 6" />
      <line x1="200" y1="0" x2="200" y2="300" stroke="currentColor" strokeWidth="1.75" />
      <line x1="200" y1="580" x2="200" y2="880" stroke="currentColor" strokeWidth="1.75" />
    </>
  );
}

type CrowdSpot = { x: number; y: number; r: number; avatarUrl: string };

/** Keeps spectators clear of the court corners, where the baseline players stand. */
const CROWD_CORNER_MARGIN = 70;
/** Smallest spectator head we will shrink to before giving up (screen units). */
const CROWD_MIN_RADIUS = 11;

/** Splits `total` into `parts` near-equal counts, larger ones first (inner rows fill first). */
function splitEvenly(total: number, parts: number): number[] {
  return Array.from({ length: parts }, (_, i) =>
    Math.floor(total / parts) + (i < total % parts ? 1 : 0)
  );
}

/**
 * Seats every audience avatar in stands along both sidelines (the court's long
 * edges), in court units, alternating sides. Adds rows outward first, then
 * shrinks the spectators, so everyone fits. Baselines stay clear for the players.
 */
function getCrowdSpots(
  layout: CourtLayout,
  orientation: "landscape" | "portrait",
  audience: string[]
): CrowdSpot[] {
  if (audience.length === 0) return [];
  const longIsX = orientation === "landscape";
  const s = layout.courtScale;
  const length = longIsX ? layout.courtWidth : layout.courtHeight;
  const usable = length - 2 * CROWD_CORNER_MARGIN;
  const perSideNeeded = Math.ceil(audience.length / 2);

  // Along the sideline each fan needs head width (+ shoulders when stacked vertically);
  // between rows they need head height + shoulders (wide court) or head width (upright court).
  const seatsPerRow = (r: number) =>
    Math.max(1, Math.floor(usable / ((2 * r + (longIsX ? 10 : 24)) / s)));
  const rowGap = (r: number) => (2 * r + (longIsX ? 22 : 10)) / s;

  let r = layout.crowd.radius;
  let rows = 1;
  for (; r >= CROWD_MIN_RADIUS; r -= 1) {
    rows = Math.ceil(perSideNeeded / seatsPerRow(r));
    if (rows <= layout.crowd.maxRows) break;
  }
  r = Math.max(r, CROWD_MIN_RADIUS);
  rows = Math.ceil(perSideNeeded / seatsPerRow(r));

  const sides: string[][] = [[], []];
  audience.forEach((url, idx) => sides[idx % 2].push(url));

  // Inner row sits where a full-size fan would; smaller fans move a little closer.
  const innerOffset = layout.crowd.offset - (layout.crowd.radius - r) / s;

  return sides.flatMap((urls, sideIdx) => {
    const rowSizes = splitEvenly(urls.length, rows);
    let next = 0;
    return rowSizes.flatMap((count, rowIdx) => {
      const offset = innerOffset + rowIdx * rowGap(r);
      const rowUrls = urls.slice(next, next + count);
      next += count;
      return rowUrls.map((avatarUrl, i) => {
        const t = CROWD_CORNER_MARGIN + ((i + 0.5) * usable) / count;
        if (longIsX) {
          return { x: t, y: sideIdx === 0 ? -offset : layout.courtHeight + offset, r, avatarUrl };
        }
        return { x: sideIdx === 0 ? -offset : layout.courtWidth + offset, y: t, r, avatarUrl };
      });
    });
  });
}

/** Cheering spectator, drawn upright at true size even though it sits inside the tilted court group. */
function SidelineSpectator({
  spot,
  layout,
  delayMs,
  spotlight,
}: {
  spot: CrowdSpot;
  layout: CourtLayout;
  delayMs: number;
  spotlight: boolean;
}) {
  const clipId = `pb-fan-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const r = spot.r;
  return (
    <g
      transform={`translate(${spot.x} ${spot.y}) scale(${1 / layout.courtScale}) rotate(${-layout.courtAngle})`}
    >
      <g
        style={{ animationDelay: `${delayMs}ms` }}
        className={`audience-cheer text-emerald-700 dark:text-emerald-400 transition-opacity duration-300 ${
          spotlight ? "opacity-95" : "opacity-45 dark:opacity-40"
        }`}
      >
        <defs>
          <clipPath id={clipId}>
            <circle cx="0" cy={-6} r={r} />
          </clipPath>
        </defs>
        {/* Little cheering stickman shoulders */}
        <path
          d={`M0 ${r - 6} L0 ${r + 10} M0 ${r} L-10 ${r - 5} M0 ${r} L10 ${r - 5}`}
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <circle cx="0" cy={-6} r={r} className="fill-white dark:fill-slate-900" />
        <image
          href={spot.avatarUrl}
          x={-r}
          y={-6 - r}
          width={2 * r}
          height={2 * r}
          preserveAspectRatio="xMidYMid slice"
          clipPath={`url(#${clipId})`}
        />
        <circle cx="0" cy={-6} r={r} stroke="currentColor" strokeOpacity="0.6" strokeWidth="2.5" />
      </g>
    </g>
  );
}

/**
 * Court, rally ball and players share one coordinate system and scale together
 * ("contain" fit), so they stay aligned at every screen size.
 */
function CourtStage({
  orientation,
  rallyAvatars,
  audience,
  spotlight,
}: {
  orientation: "landscape" | "portrait";
  rallyAvatars: string[];
  audience: string[];
  spotlight: boolean;
}) {
  const layout = orientation === "landscape" ? LANDSCAPE_LAYOUT : PORTRAIT_LAYOUT;
  const crowd = getCrowdSpots(layout, orientation, audience);
  const stageClass = orientation === "landscape" ? "hidden landscape:flex" : "flex landscape:hidden";
  const sizeClass =
    orientation === "landscape"
      ? "w-[min(96vw,144vh)] aspect-[3/2]"
      : "w-[min(94vw,52vh)] aspect-[2/3]";

  return (
    <div className={`absolute inset-0 items-center justify-center ${stageClass}`}>
      <svg
        className={`court-float ${sizeClass} overflow-visible transition-colors duration-300 ${
          spotlight
            ? "text-emerald-700/30 dark:text-emerald-400/35"
            : "text-emerald-700/[0.11] dark:text-emerald-400/[0.13]"
        }`}
        viewBox={layout.viewBox}
        preserveAspectRatio="xMidYMid meet"
        fill="none"
      >
        <g transform={layout.courtTransform}>
          <CourtLines orientation={orientation} />
          {/* Audience along both sidelines; baselines stay clear for the players */}
          {crowd.map((spot, idx) => (
            <SidelineSpectator
              key={`${idx}-${spot.avatarUrl}`}
              spot={spot}
              layout={layout}
              delayMs={(idx % 6) * 300}
              spotlight={spotlight}
            />
          ))}
        </g>

        {layout.players.map((spot, idx) => (
          <RallyPlayer key={spot.swing} spot={spot} avatarUrl={rallyAvatars[idx]} spotlight={spotlight} />
        ))}

        {/* Ball rallying diagonally between the 4 doubles players */}
        <g
          className={`pickleball-rally transition-colors duration-300 ${
            spotlight ? "text-lime-600 dark:text-[#d4e938]" : "text-lime-600/50 dark:text-[#d4e938]/50"
          }`}
          transform={`translate(${layout.rally[0][0]} ${layout.rally[0][1]})`}
          style={
            Object.fromEntries(
              layout.rally.flatMap(([x, y], i) => [
                [`--rally-${i}-x`, `${x}px`],
                [`--rally-${i}-y`, `${y}px`],
              ])
            ) as CSSProperties
          }
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
  // Sign-in screens: keep the court faint so the form card stays the focus.
  const quiet = isAuthScreen && !spotlight;

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

        {/* Perforated dot-grid fills the whole screen */}
        <svg
          className={`absolute inset-0 h-full w-full transition-colors duration-300 ${
            spotlight
              ? "text-emerald-700/30 dark:text-emerald-400/35"
              : "text-emerald-700/[0.11] dark:text-emerald-400/[0.13]"
          }`}
          fill="none"
        >
          <defs>
            <pattern id="pb-dot-grid" width="32" height="32" patternUnits="userSpaceOnUse">
              <circle cx="16" cy="16" r="1.2" fill="currentColor" opacity="0.6" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#pb-dot-grid)" />
        </svg>

        {/* Court + 2v2 rally: horizontal on wide screens, upright on tall screens */}
        <div className={`absolute inset-0 transition-opacity duration-300 ${quiet ? "opacity-40" : ""}`}>
          <CourtStage orientation="landscape" rallyAvatars={rallyAvatars} audience={cast.audience} spotlight={spotlight} />
          <CourtStage orientation="portrait" rallyAvatars={rallyAvatars} audience={cast.audience} spotlight={spotlight} />
        </div>

        {/* Multi-depth floating pickleballs */}
        <div
          className={`pb-float-b absolute top-[5%] right-[5%] transition-colors duration-300 ${
            spotlight ? "text-lime-600/80 dark:text-[#d4e938]/80" : "text-lime-600/25 dark:text-[#d4e938]/25"
          }`}
        >
          <PickleballSvg className="h-12 w-12" />
        </div>
        <div
          className={`pb-float-c absolute bottom-[5%] left-[5%] transition-colors duration-300 [animation-delay:-5s] ${
            spotlight ? "text-lime-600/75 dark:text-[#d4e938]/75" : "text-lime-600/20 dark:text-[#d4e938]/20"
          }`}
        >
          <PickleballSvg className="h-10 w-10" />
        </div>
        <div
          className={`pb-float-a hidden md:block absolute top-[12%] left-[4%] transition-colors duration-300 [animation-delay:-9s] ${
            spotlight ? "text-emerald-600/70 dark:text-emerald-400/70" : "text-emerald-600/20 dark:text-emerald-400/20"
          }`}
        >
          <PickleballSvg className="h-8 w-8" />
        </div>
        <div
          className={`pb-float-b hidden sm:block absolute bottom-[6%] right-[5%] transition-colors duration-300 [animation-delay:-11s] ${
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
