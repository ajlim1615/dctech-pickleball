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
      "Feet must stay behind baseline until ball is struck.",
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
      "Volleying the 2nd or 3rd shot is an immediate fault!",
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
      "Yes, you can enter the kitchen: You CAN step in anytime IF the ball bounces first.",
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
    title: "Check In to a Session",
    description:
      "Open Sessions, pick today's active event, and check in to add yourself to the attendance roster and view live session standings.",
    href: "/sessions",
    ctaLabel: "Open Sessions",
    accent: "emerald",
  },
  {
    step: "02",
    title: "Join Queue & Partner Mode",
    description:
      "Head to Queue and tap Join Open-Play Queue as a Solo Player or pair up with a Coworker to stay on the same doubles team.",
    href: "/queue",
    ctaLabel: "Open Queue",
    accent: "lime",
  },
  {
    step: "03",
    title: "Live Court Call-Up",
    description:
      "Watch your queue position and estimated wait time. When a court opens, you'll get a live call-up alert with your assigned court.",
    href: "/queue",
    ctaLabel: "Check Position",
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
      "Browse scheduled, live, and completed sessions, check in, view session-specific leaderboards, and share final podium cards.",
    href: "/sessions",
    ctaLabel: "Browse Sessions",
    iconName: "calendar",
  },
  {
    title: "Company Leaderboard & Ratings",
    description:
      "Official scores recorded in ranked sessions automatically adjust your DUPR skill rating and update the Gold, Silver, and Bronze podium.",
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
      "Update your profile details and inspect your personal match log and DUPR rating progression over time.",
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
    'When joining with "+ Coworker", the engine guarantees you stay on the same doubles team against 2 challengers.',
  strategy: "Preserves premade doubles pairs.",
  bestFor: "Coworkers training for doubles tournaments.",
};

export interface FaqItem {
  question: string;
  answer: string;
}

export const PLAYER_FAQS: FaqItem[] = [
  {
    question: "What if I am called to a court but need a minute (tying shoes / arriving)?",
    answer:
      "Ask an organizer or click the Bump / Play Next button on your paddle card in the Queue screen. It shifts you down so ready players play immediately and you take the court in the next rotation.",
  },
  {
    question: "Can I pair up with a specific colleague for Doubles?",
    answer:
      'Yes! In the Queue screen, choose "+ Coworker" and pick their name from the employee list. You will be assigned to the same team when called.',
  },
  {
    question: "How are match scores recorded and how does DUPR adjust?",
    answer:
      "To guarantee fairness and integrity across the company, all official match scores are recorded by tournament administrators or staff umpires. Winning against higher-rated opponents boosts your DUPR rating on the leaderboard (when the session is configured as Ranked).",
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
      "Stationed staff manage live match flow, scoring, and timeouts from the dedicated Court Monitor view (/courts/[id]/monitor).",
    href: "/",
    ctaLabel: "Open Live Courts",
    items: [
      {
        label: "Access Umpire Mode",
        detail: "Open your assigned court from Live Courts or Admin and launch Monitor mode.",
      },
      {
        label: "Live Scoring & Side-Out",
        detail:
          "Increment Team A / Team B points in real time; public scoreboards update immediately via live subscriptions.",
      },
      {
        label: "60-Second Timeout Timer",
        detail: "Trigger the built-in countdown timer when a team calls a timeout.",
      },
      {
        label: "Call Next Up & Finalize",
        detail:
          "Record the final score (or winning team in result-only sessions) to update rankings, then call the next 4 waiting players from the queue.",
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
        label: "Rented Courts & Overrides",
        detail:
          "Set the active rented court count and toggle individual courts between Available, Occupied, Maintenance, or Reserved.",
      },
      {
        label: "Staff Assignment",
        detail: "Assign or unassign staff umpires to specific courts.",
      },
      {
        label: "Live Queue Tools",
        detail:
          "Bulk-add checked-in players, bump positions, swap two queued players, substitute a player, auto-fill all open courts, or reset the session queue.",
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
        label: "DUPR Ratings, Roles & Status",
        detail:
          "Edit player details, manually adjust DUPR ratings, toggle active status, or promote/demote player, staff, and admin roles.",
      },
    ],
  },
];
