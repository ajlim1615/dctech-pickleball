import { RATING_RULES } from "@/features/rankings/ratingConfig";
import { formatRating } from "@/lib/utils";
import { SELF_BREAKS_ENABLED } from "@/features/queue/utils/queueLimits";

const LAST_NEW_PLAYER_GAMES =
  RATING_RULES.newPlayerSchedule[RATING_RULES.newPlayerSchedule.length - 1].beforeGames;

export const RATING_GUIDE_COPY = {
  change:
    "Your rating changes after every ranked game. Beating a stronger team moves it more; losing to a weaker one costs more. Casual sessions don't count.",
  start: `Everyone starts at ${formatRating(RATING_RULES.start)}. Your first ${LAST_NEW_PLAYER_GAMES} games move your rating faster so you reach your level quickly.`,
  ranked: `You're ranked after ${RATING_RULES.qualifyGames} ranked games. Rankings are ordered by rating; wins and win rate are shown too.`,
};

export type GuideTabId = "rules" | "flow" | "matchstyles" | "faq" | "staff" | "admin";

export interface GuideRoleAccess {
  canViewStaff: boolean;
  canViewAdmin: boolean;
}

export interface GuideTabDefinition {
  id: GuideTabId;
  label: string;
  minRole: "player" | "staff" | "admin";
}

export const GUIDE_TABS: GuideTabDefinition[] = [
  { id: "rules", label: "1. Pickleball Rules 101", minRole: "player" },
  { id: "flow", label: "2. Game Day & Features", minRole: "player" },
  { id: "matchstyles", label: "3. Match Styles & Rotations", minRole: "player" },
  { id: "faq", label: "4. Player FAQs", minRole: "player" },
  { id: "staff", label: "5. Staff & Umpire Guide", minRole: "staff" },
  { id: "admin", label: "6. Admin Operations", minRole: "admin" },
];

export function getVisibleGuideTabs(access: GuideRoleAccess): GuideTabDefinition[] {
  return GUIDE_TABS.filter((tab) => {
    if (tab.minRole === "staff") return access.canViewStaff;
    if (tab.minRole === "admin") return access.canViewAdmin;
    return true;
  });
}

export function resolveGuideTab(
  rawTab: string | string[] | undefined,
  access: GuideRoleAccess
): GuideTabId {
  const candidate = Array.isArray(rawTab) ? rawTab[0] : rawTab;
  const visibleIds = new Set(getVisibleGuideTabs(access).map((t) => t.id));
  if (candidate && visibleIds.has(candidate as GuideTabId)) {
    return candidate as GuideTabId;
  }
  return "rules";
}

export interface CoreRuleItem {
  number: string;
  badge: string;
  title: string;
  accent: "emerald" | "sky" | "amber" | "purple" | "lime" | "rose";
  bullets: string[];
}

export const CORE_RULES: CoreRuleItem[] = [
  {
    number: "01",
    badge: "SERVICE",
    title: "1. The Underhand Serve",
    accent: "emerald",
    bullets: [
      "Paddle contact must be below the waist (navel level).",
      "Swing must move in an upward arc; paddle head below wrist.",
      "Feet must stay behind the baseline, between the center line and sideline, until the ball is struck.",
      "Must land diagonally crosscourt past the 7ft Kitchen line.",
      "Drop Serve is allowed (dropped from natural height, struck off bounce).",
    ],
  },
  {
    number: "02",
    badge: "BOUNCE",
    title: "2. The Two-Bounce Rule",
    accent: "sky",
    bullets: [
      "Bounce 1: Receiving team must let the serve bounce.",
      "Bounce 2: Serving team must let the return bounce.",
      "After both bounces, both teams may hit volleys out of the air or play off the bounce.",
      "Volleying the serve or the return before it bounces is a fault. From the 3rd shot on, volleys are allowed.",
    ],
  },
  {
    number: "03",
    badge: "CRITICAL",
    title: "3. The Kitchen (NVZ)",
    accent: "amber",
    bullets: [
      "7-foot zone on both sides of the net (Non-Volley Zone).",
      "You cannot touch the kitchen or kitchen line while volleying in the air.",
      "Momentum carrying you into the kitchen after a volley is a fault.",
      "You can stand in the kitchen any time. You just can't volley there: step in to play a ball that has bounced.",
    ],
  },
  {
    number: "04",
    badge: "ROTATION",
    title: "4. Side-Out Scoring System",
    accent: "purple",
    bullets: [
      "Only the serving team can score points.",
      "In doubles, Server 1 serves until losing a rally, then Server 2 serves.",
      "When Server 2 loses the rally, a Side-Out occurs and the opponents serve.",
      "At the start of a game, the first serving team gets only one server (the score is called 0-0-2).",
      "Servers switch right/left courts only upon winning a point.",
    ],
  },
  {
    number: "05",
    badge: "VICTORY",
    title: "5. Game Victory (To 11, Win by 2)",
    accent: "lime",
    bullets: [
      "Standard games are played to 11 points.",
      "A team must win by a minimum margin of 2 points (e.g. 11–9, 12–10, 14–12).",
      "Fast-play or tournament sessions can be configured to 6 points (first to 6) or win/loss-only tracking.",
    ],
  },
  {
    number: "06",
    badge: "BOUNDS",
    title: "6. Official Line Call Rulings",
    accent: "rose",
    bullets: [
      "Sidelines & Baselines: If the ball touches any part of the line, it is IN.",
      "Kitchen Line on Serve: If a serve hits the NVZ kitchen line, it is a FAULT (OUT).",
      "During live play, the kitchen line is part of the NVZ.",
    ],
  },
];

export interface FaultItem {
  title: string;
  description: string;
}

export const OFFICIAL_FAULTS: FaultItem[] = [
  {
    title: "Out of Bounds / Net",
    description: "Ball hit out of the court boundaries or failing to clear the net.",
  },
  {
    title: "Kitchen Volley Fault",
    description: "Volleying while touching the kitchen, or momentum landing in the NVZ after hitting.",
  },
  {
    title: "Two-Bounce Violation",
    description: "Volleying before the ball has bounced once on each side of the court.",
  },
  {
    title: "Double Bounce",
    description: "Ball bouncing twice on the same side before being hit.",
  },
  {
    title: "Body / Clothing Contact",
    description: "Ball touching any player, clothing, or accessory before bouncing.",
  },
  {
    title: "Net Touch",
    description: "Touching the net, net posts, or opponent's court while the ball is in play.",
  },
];

export interface FlowStep {
  step: string;
  title: string;
  description: string;
  href: string;
  ctaLabel: string;
  accent: "emerald" | "lime" | "sky" | "purple";
}

export const PLAYER_FLOW_STEPS: FlowStep[] = [
  {
    step: "01",
    title: "RSVP & Check In to a Session",
    description:
      'Tap "I\'m going" on upcoming scheduled sessions to RSVP. Once a session starts, check in on the session page to join the roster and view live standings.',
    href: "/sessions",
    ctaLabel: "Open Sessions",
    accent: "emerald",
  },
  {
    step: "02",
    title: "Join Queue & Partner Mode",
    description:
      "Once the session is live, join the rotation as a Solo Player—or pair up with a Coworker or guest if the admin turned on Allow partners.",
    href: "/sessions",
    ctaLabel: "Open Sessions",
    accent: "lime",
  },
  {
    step: "03",
    title: "Wait Estimate, Activity & Call-Up",
    description:
      "Track your queue position, live wait timer, session game count, estimated wait-time card, and live session activity feed. When an admin starts your game, you'll get a live call-up alert with your court.",
    href: "/sessions",
    ctaLabel: "Check Session",
    accent: "sky",
  },
];

export interface AppFeatureCard {
  title: string;
  description: string;
  href: string;
  ctaLabel: string;
  iconName: "activity" | "calendar" | "trophy" | "history" | "user";
}

export const PLAYER_APP_FEATURES: AppFeatureCard[] = [
  {
    title: "Live Arena Scoreboards",
    description:
      "The home screen streams live scores, active players, and timers for all facility courts in real time without refreshing.",
    href: "/",
    ctaLabel: "View Live Courts",
    iconName: "activity",
  },
  {
    title: "Sessions & Final Standings",
    description:
      "RSVP to upcoming sessions, check in when live, follow the session activity feed and wait-time card, and share high-res leaderboard or final standings cards.",
    href: "/sessions",
    ctaLabel: "Browse Sessions",
    iconName: "calendar",
  },
  {
    title: "Company Leaderboard & Ratings",
    description:
      `${RATING_GUIDE_COPY.start} ${RATING_GUIDE_COPY.ranked} You can tap any player's avatar to view their photo full size.`,
    href: "/rankings",
    ctaLabel: "View Rankings",
    iconName: "trophy",
  },
  {
    title: "Match History",
    description:
      "Review completed matches across sessions, including final scores, team pairings, and court assignments.",
    href: "/matches",
    ctaLabel: "View Matches",
    iconName: "history",
  },
  {
    title: "Player Profile & Rating History",
    description:
      "Update your profile details and inspect your personal match log and rating progression over time.",
    href: "/profile",
    ctaLabel: "Open Profile",
    iconName: "user",
  },
];

export const PARTNER_LOCK_FEATURE = {
  badge: "FEATURE",
  tag: "Team Pairing",
  title: "Coworker Partner Lock",
  description:
    'Only in sessions where the admin turned on Allow partners. When joining with "+ Coworker", the engine guarantees you stay on the same doubles team against 2 challengers.',
  strategy: "Preserves premade doubles pairs.",
  bestFor: "Coworkers training for doubles tournaments.",
};

export interface FaqItem {
  question: string;
  answer: string;
}

export const PLAYER_FAQS: FaqItem[] = [
  {
    question: "Why do some players have slightly more games than others, and how does fair matching work?",
    answer:
      "In rotation styles, #1 in line always plays next, so waiting longest guarantees your spot. Among the first eight waiting, players with fewer games since arriving get a gentle nudge so fast and slow courts even out. Late arrivals start neutral instead of leapfrogging earlier players, and totals can still differ slightly due to arrival times, breaks, or court speeds.",
  },
  {
    question: "What if I am called to a court but need a minute (tying shoes / arriving)?",
    answer:
      "Tell an admin right away. Before the first point is played, they can swap the next person in line in for you, so the court doesn't wait. You go back into the line and play in a later game.",
  },
  {
    question: "How do I leave the session or step away?",
    answer: SELF_BREAKS_ENABLED
      ? "Tap Take a break to skip games without losing your place (one break per session), then I'm back when you return. To go home, tap Check out: it takes you out of the line. You can check back in once, at the back of the line. You can't check out in the middle of a game."
      : "To go home, tap Check out: it takes you out of the line. You can check back in once, at the back of the line; after that, ask an admin. You can't check out in the middle of a game. Need a short break instead? Ask an admin to put you on one so you keep your place.",
  },
  {
    question: "Can I pair up with a specific colleague for Doubles?",
    answer:
      'Yes, if the admin turned on Allow partners for that session. Then, in the queue on the session page, choose "+ Coworker" and pick their name from the employee list. You will be assigned to the same team when called. Otherwise everyone joins solo and the game mode makes the teams.',
  },
  {
    question: "How are match scores recorded and how does my rating change?",
    answer:
      `${RATING_GUIDE_COPY.change} ${RATING_GUIDE_COPY.start} ${RATING_GUIDE_COPY.ranked} Only administrators finalize official match scores, and they can correct a saved result if needed.`,
  },
  {
    question: "When can I join the queue for a session?",
    answer:
      'You can tap "I\'m going" on upcoming scheduled sessions to RSVP early, while the live queue itself opens once the admin starts the session.',
  },
  {
    question: "What is the difference between 11-point, 6-point, and Result-Only sessions?",
    answer:
      "Admins can configure each session's scoring target (11 pts win-by-2 or fast 6 pts) and whether exact point scores are tracked or only the winning team is recorded.",
  },
  {
    question: "Can I use this app on my iPhone, Android, or iPad at the venue?",
    answer:
      'Yes! The app is mobile-friendly with a bottom navigation bar. You can also tap "Add to Home Screen" in Safari or Chrome to install it as a standalone full-screen app.',
  },
];

export interface RoleGuideSection {
  title: string;
  badge: string;
  description: string;
  items: { label: string; detail: string }[];
  href?: string;
  ctaLabel?: string;
}

export const STAFF_GUIDE_SECTIONS: RoleGuideSection[] = [
  {
    title: "Court Monitor & Live Umpiring",
    badge: "STAFF / UMPIRE",
    description:
      "Stationed staff manage live match flow and scoring from the court's Umpire view.",
    href: "/",
    ctaLabel: "Open Live Courts",
    items: [
      {
        label: "Access Umpire Mode",
        detail: "Tap Umpire on your court's card on the session page to open its full-screen scoring view.",
      },
      {
        label: "Live Scoring & Side-Out",
        detail:
          "Increment Team A / Team B points in real time; public scoreboards update immediately via live subscriptions.",
      },
      {
        label: "Admin Score & Queue Handoff",
        detail:
          "Staff handle live point tracking in Court Monitor; finalizing official match scores, fixing saved results, and calling the next 4 players are admin-only actions.",
      },
    ],
  },
];

export const ADMIN_GUIDE_SECTIONS: RoleGuideSection[] = [
  {
    title: "Session Lifecycle & Matchmaking Config",
    badge: "SESSIONS",
    description:
      "Create, edit, start, complete, or cancel open-play sessions in Admin (/admin) with per-session rules.",
    href: "/admin",
    ctaLabel: "Open Admin Panel",
    items: [
      {
        label: "Matchmaking Mode",
        detail:
          "Choose from all 8 session matching styles (Balanced, Social Mix, Skill Separated, Winners/Losers, Skill Courts, Mixed Doubles, King/Queen, Club Wars).",
      },
      {
        label: "Scoring & Ranking Tags",
        detail:
          "Configure Ranked vs. Casual, target points (11 pts win-by-2 or 6 pts), and point-by-point vs. win/loss-only tracking.",
      },
      {
        label: "Per-Session Courts, Partners & Spread",
        detail:
          "Set a custom court count per session, toggle Allow partners on/off, and configure the max rating spread for Skill Separated mode.",
      },
    ],
  },
  {
    title: "Courts, Staff & Queue Controls",
    badge: "OPERATIONS",
    description:
      "Full operational control over venue courts, staff assignments, and live queue order.",
    href: "/admin",
    ctaLabel: "Manage Operations",
    items: [
      {
        label: "Courts",
        detail:
          "Add a court (you'll name it) or remove an empty one with its ×. Set a free court to Open, Maintenance or Reserved; a court shows In play by itself while a game is on it.",
      },
      {
        label: "Staff Assignment",
        detail: "Assign or unassign staff umpires to specific courts.",
      },
      {
        label: "Live Queue Tools & No-Show Swaps",
        detail:
          "Add players to the line, tap a name in the line to remove or check them out, and tap a player on a live court to replace them, switch teams or mark a no-show (with Undo). Tap a name on an Up Next match to swap that player, then start it on an open court. Saving a result never starts the next game by itself.",
      },
      {
        label: "Result Correction & Activity Audit",
        detail:
          "Fix a saved match result from the session or leaderboard (recalculating ratings) and inspect timestamped session events in the Admin Activity Audit tab.",
      },
    ],
  },
  {
    title: "Player Directory & Walk-Ins",
    badge: "PLAYERS",
    description:
      "Manage employee accounts, ratings, and on-site walk-in participants.",
    href: "/admin",
    ctaLabel: "Open Directory",
    items: [
      {
        label: "Walk-In Players",
        detail: "Quickly register walk-in players so they can check in and join the queue immediately.",
      },
      {
        label: "Turning Accounts On or Off",
        detail: "Any admin can turn a player's account on or off from the Players tab. It can be switched back at any time.",
      },
      {
        label: "System Admin Only",
        detail:
          "Only the System Admin account (admin@dctechmicro.com) can change a player's rating, name or email, remove a profile photo, make someone an admin or a player, and reset a password. A reset puts the password back to the starting one; the player sets a new password the next time they sign in.",
      },
    ],
  },
];
