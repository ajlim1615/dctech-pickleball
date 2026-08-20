/**
 * Sliding Window In-Memory Rate Limiter
 * Provides DDoS, brute-force, and abusive request throttling.
 */

interface RateLimitRecord {
  timestamps: number[];
  blockedUntil?: number;
}

const store = new Map<string, RateLimitRecord>();

// Cleanup stale entries every 5 minutes to maintain optimal memory usage
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of store.entries()) {
      record.timestamps = record.timestamps.filter((ts) => now - ts < 600000);
      if (record.timestamps.length === 0 && (!record.blockedUntil || record.blockedUntil < now)) {
        store.delete(key);
      }
    }
  }, 300000);
}

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  blockDurationMs?: number;
}

export const RATE_LIMIT_CONFIGS = {
  // 5 attempts per minute, 5-minute block on brute force
  AUTH_STRICT: { maxRequests: 5, windowMs: 60 * 1000, blockDurationMs: 5 * 60 * 1000 },
  // 15 queue requests per minute
  QUEUE_ACTIONS: { maxRequests: 15, windowMs: 60 * 1000 },
  // 20 score submissions per minute
  MATCH_ACTIONS: { maxRequests: 20, windowMs: 60 * 1000 },
  // 30 admin actions per minute
  ADMIN_ACTIONS: { maxRequests: 30, windowMs: 60 * 1000 },
  // 120 general requests per minute
  STANDARD_API: { maxRequests: 120, windowMs: 60 * 1000 },
} as const;

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetMs: number;
  retryAfterSeconds?: number;
  error?: string;
}

/**
 * Check and record a rate limit attempt for a specific key (e.g. IP + Action, Email + Action)
 */
export function checkRateLimit(
  identifier: string,
  action: string,
  config: RateLimitConfig = RATE_LIMIT_CONFIGS.STANDARD_API
): RateLimitResult {
  const key = `${action}:${identifier.toLowerCase().trim()}`;
  const now = Date.now();

  let record = store.get(key);
  if (!record) {
    record = { timestamps: [] };
    store.set(key, record);
  }

  // Check if currently blocked
  if (record.blockedUntil && record.blockedUntil > now) {
    const retryAfter = Math.ceil((record.blockedUntil - now) / 1000);
    return {
      success: false,
      remaining: 0,
      resetMs: record.blockedUntil - now,
      retryAfterSeconds: retryAfter,
      error: `Too many attempts. Temporarily locked. Please try again in ${retryAfter} seconds.`,
    };
  }

  // Filter timestamps within the sliding window
  record.timestamps = record.timestamps.filter((ts) => now - ts < config.windowMs);

  if (record.timestamps.length >= config.maxRequests) {
    if (config.blockDurationMs) {
      record.blockedUntil = now + config.blockDurationMs;
    }
    const oldestTimestamp = record.timestamps[0] || now;
    const resetMs = Math.max(0, config.windowMs - (now - oldestTimestamp));
    const retryAfter = Math.ceil(resetMs / 1000);

    return {
      success: false,
      remaining: 0,
      resetMs,
      retryAfterSeconds: retryAfter,
      error: `Rate limit exceeded for ${action}. Please wait ${retryAfter} seconds before retrying.`,
    };
  }

  // Record this attempt
  record.timestamps.push(now);

  return {
    success: true,
    remaining: config.maxRequests - record.timestamps.length,
    resetMs: config.windowMs,
  };
}

/**
 * Helper to reset rate limits for a key (e.g. after successful authentication)
 */
export function resetRateLimit(identifier: string, action: string) {
  const key = `${action}:${identifier.toLowerCase().trim()}`;
  store.delete(key);
}
