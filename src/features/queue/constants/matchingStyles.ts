import type { MatchingStyle } from "@/features/queue/utils/matchingEngine";

export type MatchingStyleAccent = "emerald" | "purple" | "sky" | "amber" | "slate";

export interface MatchingStyleMeta {
  id: MatchingStyle;
  label: string;
  badge?: string;
  badgeTone?: "volt" | "purple" | "sky" | "amber" | "outline";
  tag: string;
  /** Concise description used in Admin session creation/editing pickers. */
  adminSummary: string;
  /** Detailed explanation shown in /guide. */
  guideDescription: string;
  strategy: string;
  bestFor: string;
  accent: MatchingStyleAccent;
  /** Where this style appears in the Admin session creation modal. */
  adminTier: "primary" | "more" | "engine_only";
}

/**
 * Single source of truth for all MatchingStyle metadata across
 * matchingEngine validation, Admin session pickers, and /guide.
 *
 * Adding a new value to `MatchingStyle` requires adding an entry here.
 */
export const MATCHING_STYLE_REGISTRY: Record<MatchingStyle, MatchingStyleMeta> = {
  balanced: {
    id: "balanced",
    label: "Balanced",
    badge: "RECOMMENDED",
    badgeTone: "volt",
    tag: "Algorithm Pairing",
    adminSummary: "Balances teams by rating. Avoids repeat matchups when possible.",
    guideDescription:
      "Sorts the 4 called players by skill rating: Team A (#1 Best + #4 Lowest) vs Team B (#2 + #3 Middle).",
    strategy: "Equalizes combined team DUPR.",
    bestFor: "Competitive matches without blowouts.",
    accent: "emerald",
    adminTier: "primary",
  },
  social_mixer: {
    id: "social_mixer",
    label: "Social Mix",
    badge: "CASUAL / SOCIAL",
    badgeTone: "purple",
    tag: "Shuffle",
    adminSummary: "Avoids repeat partners and opponents. Doesn't use ratings.",
    guideDescription:
      "Shuffles called players to minimize repeat partners and opponents across games, disregarding ratings.",
    strategy: "Maximizes player mingling and new interactions.",
    bestFor: "Team building and welcome sessions.",
    accent: "purple",
    adminTier: "primary",
  },
  skill_separated: {
    id: "skill_separated",
    label: "Skill Separated",
    badge: "TIER BASED",
    badgeTone: "sky",
    tag: "Skill Tiers",
    adminSummary: "Keeps similar skill levels together. May leave a court waiting.",
    guideDescription:
      "Groups similar skill levels together (e.g. Advanced vs Advanced, Beginner vs Beginner).",
    strategy: "High vs High and Beginner vs Beginner.",
    bestFor: "High-paced competitive sessions.",
    accent: "sky",
    adminTier: "primary",
  },
  winners_losers: {
    id: "winners_losers",
    label: "Winners / Losers",
    badge: "CHALLENGE",
    badgeTone: "amber",
    tag: "Split Winners",
    adminSummary: "Winners play winners. Losers play losers.",
    guideDescription:
      "The winning pair stays on court, splits into opponents, and takes on 2 incoming challengers from the waiting queue.",
    strategy: "Winner stays and splits with challengers.",
    bestFor: "Challenge ladders and court streaks.",
    accent: "amber",
    adminTier: "primary",
  },
  skill_courts: {
    id: "skill_courts",
    label: "Skill Courts",
    badge: "COURT TIERS",
    badgeTone: "sky",
    tag: "Dedicated Courts",
    adminSummary: "Give each skill group its own courts and queue.",
    guideDescription:
      "Assigns dedicated courts by skill tier so players naturally rotate within their skill bracket.",
    strategy: "Separates court pools by rating tier.",
    bestFor: "Multi-court nights with wide skill ranges.",
    accent: "sky",
    adminTier: "more",
  },
  mixed_doubles: {
    id: "mixed_doubles",
    label: "Mixed Doubles",
    badge: "MIXED",
    badgeTone: "purple",
    tag: "Gender Balanced",
    adminSummary: "Every team has one male and one female player.",
    guideDescription:
      "Pairs teams for mixed doubles play and shuffles matchups to keep games varied.",
    strategy: "Balances mixed doubles pairings across courts.",
    bestFor: "Mixed doubles socials and themed events.",
    accent: "purple",
    adminTier: "more",
  },
  king_queen: {
    id: "king_queen",
    label: "King/Queen of the Court",
    badge: "KING OF COURT",
    badgeTone: "amber",
    tag: "Court Ladder",
    adminSummary: "Winners move up. Losers move down.",
    guideDescription:
      "Winning pairs hold or move up toward the top court while challengers rotate in and split pairings.",
    strategy: "Winners advance and split against incoming challengers.",
    bestFor: "High-energy ladder nights and court streaks.",
    accent: "amber",
    adminTier: "more",
  },
  club_wars: {
    id: "club_wars",
    label: "Club Wars",
    badge: "BETA",
    badgeTone: "purple",
    tag: "Team vs Team",
    adminSummary: "Two groups compete. Every match is one group vs the other.",
    guideDescription:
      "Pits two groups or departments against each other so every court match counts toward group bragging rights.",
    strategy: "Shuffles matchups between opposing groups.",
    bestFor: "Departmental rivalries and company tournaments.",
    accent: "purple",
    adminTier: "more",
  },
  fifo: {
    id: "fifo",
    label: "Classic FIFO Rack",
    badge: "CLASSIC",
    badgeTone: "outline",
    tag: "4-On / 4-Off",
    adminSummary: "Strict first-in, first-out paddle rack order.",
    guideDescription:
      "Strict queue order. The first 2 waiting players face off against the next 2 waiting players in line.",
    strategy: "Pure first-in, first-out rotation.",
    bestFor: "Maximum court throughput and large turnouts.",
    accent: "slate",
    adminTier: "engine_only",
  },
  winners_stay: {
    id: "winners_stay",
    label: "Winners Stay",
    badge: "STREAK",
    badgeTone: "amber",
    tag: "Hold Court",
    adminSummary: "Winning players remain on court against the next challengers.",
    guideDescription:
      "Alias of Winners / Losers rotation where the previous winners stay on court and split against incoming challengers.",
    strategy: "Winners remain on court; challengers rotate in.",
    bestFor: "Continuous challenger rotation.",
    accent: "amber",
    adminTier: "engine_only",
  },
};

export const ALL_MATCHING_STYLES = Object.keys(MATCHING_STYLE_REGISTRY) as MatchingStyle[];

export const ADMIN_PRIMARY_MATCHING_STYLES = Object.values(MATCHING_STYLE_REGISTRY).filter(
  (m) => m.adminTier === "primary"
);

export const ADMIN_MORE_MATCHING_STYLES = Object.values(MATCHING_STYLE_REGISTRY).filter(
  (m) => m.adminTier === "more"
);

export const ADMIN_SELECT_MATCHING_STYLES = [
  ...ADMIN_PRIMARY_MATCHING_STYLES,
  ...ADMIN_MORE_MATCHING_STYLES,
];

export const GUIDE_MATCHING_STYLES = Object.values(MATCHING_STYLE_REGISTRY);
