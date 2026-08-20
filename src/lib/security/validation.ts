import { z } from "zod";

/**
 * XSS & SQLi String Sanitizer
 * Strips dangerous HTML tags, javascript pseudo-protocols, and null bytes.
 */
export function sanitizeString(input: unknown): string {
  if (typeof input !== "string") return "";
  return input
    .replace(/\0/g, "") // Remove null bytes
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "") // Strip script tags
    .replace(/<[^>]+>/g, "") // Strip HTML tags
    .replace(/javascript:/gi, "") // Strip javascript pseudo-protocol
    .trim();
}

// Allowed matching styles
export const MatchingStyleEnum = z.enum([
  "balanced",
  "social_mixer",
  "skill_separated",
  "winners_losers",
  "skill_courts",
  "mixed_doubles",
  "king_queen",
  "club_wars",
  "fifo",
]);

// Auth schemas
export const SignInSchema = z.object({
  email: z
    .string()
    .email("Invalid email address format.")
    .transform((val) => val.toLowerCase().trim()),
  password: z.string().min(1, "Password is required.").max(128, "Password too long."),
});

export const MagicLinkSchema = z.object({
  email: z
    .string()
    .email("Invalid email address format.")
    .transform((val) => val.toLowerCase().trim()),
});

// Match scoring validation
export const FinalizeMatchSchema = z.object({
  matchId: z.string().min(1, "Invalid match ID."),
  teamAScore: z
    .number()
    .int("Score must be an integer.")
    .min(0, "Score cannot be negative.")
    .max(99, "Score exceeds maximum allowed value."),
  teamBScore: z
    .number()
    .int("Score must be an integer.")
    .min(0, "Score cannot be negative.")
    .max(99, "Score exceeds maximum allowed value."),
  winningTeam: z.enum(["team_a", "team_b", "draw"]).optional().nullable(),
});

// Session creation validation
export const CreateSessionSchema = z.object({
  title: z
    .string()
    .min(1, "Session title is required.")
    .max(100, "Session title cannot exceed 100 characters.")
    .transform(sanitizeString),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD format."),
  startTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Invalid start time format."),
  endTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Invalid end time format."),
  maxCapacity: z.number().int().min(2).max(200).default(32),
  matchingStyle: MatchingStyleEnum.default("balanced"),
  description: z.string().max(500).optional().transform(sanitizeString),
});

// Player rating validation
export const AdjustRatingSchema = z.object({
  userId: z.string().uuid("Invalid user UUID."),
  newRating: z
    .number()
    .min(1.0, "Rating cannot be lower than 1.00")
    .max(6.0, "Rating cannot exceed 6.00"),
});

// Walk-in / Guest player validation
export const WalkInPlayerSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters.")
    .max(50, "Name cannot exceed 50 characters.")
    .transform(sanitizeString),
  type: z.enum(["guest", "employee"]).default("guest"),
  skillRating: z.number().min(1.0).max(6.0).default(3.0),
  role: z.enum(["player", "admin"]).default("player"),
});

// Queue join validation
export const JoinQueueSchema = z.object({
  sessionId: z.string().uuid("Invalid session UUID."),
  partnerId: z.string().uuid("Invalid partner UUID.").optional(),
  guestName: z.string().max(50).optional().transform(sanitizeString),
  preferredCourtId: z.string().uuid("Invalid court UUID.").optional(),
});
