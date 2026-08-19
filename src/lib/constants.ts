export const APP_NAME = "DCTECH | Pickleball";
export const COMPANY_NAME = "DCTECH";
export const APP_DESCRIPTION = "Internal DCTECH Employee Pickleball Platform";

export const DEFAULT_COURT_COUNT = 4;
export const DEFAULT_SKILL_RATING = 3.0;

export const COURT_STATUS = {
  AVAILABLE: "available",
  OCCUPIED: "occupied",
  MAINTENANCE: "maintenance",
  RESERVED: "reserved",
} as const;

export const QUEUE_STATUS = {
  WAITING: "waiting",
  CALLED: "called",
  PLAYING: "playing",
  LEFT: "left",
} as const;

export const MATCH_STATUS = {
  PENDING: "pending",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
  ABANDONED: "abandoned",
} as const;

export const MATCH_FORMAT = {
  SINGLES: "singles",
  DOUBLES: "doubles",
} as const;

export const USER_ROLE = {
  PLAYER: "player",
  ADMIN: "admin",
} as const;
