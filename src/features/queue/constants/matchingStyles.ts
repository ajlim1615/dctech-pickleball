import type { MatchingStyle } from "@/features/queue/matchmaking";

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
    adminSummary: "Balances teams by rating. Avoids repeat partners and opponents when possible.",
    guideDescription:
      "Picks four from the first six in line (the first person is always included) and splits them into the most even teams by rating, preferring people who haven't partnered or played each other this session.",
    strategy: "Evens out team ratings and avoids repeats.",
    bestFor: "Competitive matches without blowouts.",
    accent: "emerald",
    adminTier: "primary",
  },
  social_mixer: {
    id: "social_mixer",
    label: "Social Mix",
    badge: "CASUAL / SOCIAL",
    badgeTone: "purple",
    tag: "Avoids Repeats",
    adminSummary: "Avoids repeat partners and opponents. Doesn't use ratings.",
    guideDescription:
      "Picks four from the first six in line and avoids repeat partners and opponents. Ratings are ignored, and equally good options are chosen at random.",
    strategy: "Maximizes player mingling and new interactions.",
    bestFor: "Team building and welcome sessions.",
    accent: "purple",
    adminTier: "primary",
  },
  skill_separated: {
    id: "skill_separated",
    label: "Skill Separated",
    badge: "RATING BASED",
    badgeTone: "sky",
    tag: "Closest Skill",
    adminSummary: "Keeps similar skill levels together. May leave a court waiting.",
    guideDescription:
      "Pairs the first person in line with the next closest-rated players from the first ten waiting, so everyone on court is within the session's rating gap.",
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
    tag: "By Last Result",
    adminSummary: "Winners play winners. Losers play losers.",
    guideDescription:
      "Groups people by their last result: winners with winners and losers with losers. Newcomers fit either, and the engine reaches a little down the line to find a matching group.",
    strategy: "Winners play winners, losers play losers.",
    bestFor: "Keeping games close in level after a few rounds.",
    accent: "amber",
    adminTier: "primary",
  },
  skill_courts: {
    id: "skill_courts",
    label: "Skill Courts",
    badge: "COURT TIERS",
    badgeTone: "sky",
    tag: "Dedicated Courts",
    adminSummary: "Works like Skill Separated for now. Courts by skill level coming soon.",
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
    adminSummary: "Shuffled teams for now. One man and one woman per team coming soon.",
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
    adminSummary: "Winners move up a court. Losers rejoin the line.",
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
    adminSummary: "Shuffled teams for now. Group vs group coming soon.",
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
