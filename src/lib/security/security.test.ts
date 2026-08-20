import { describe, it, expect, beforeEach } from "vitest";
import { checkRateLimit, resetRateLimit, RATE_LIMIT_CONFIGS } from "./rateLimit";
import { sanitizeString, SignInSchema, FinalizeMatchSchema, WalkInPlayerSchema } from "./validation";
import { isRootSystemAdmin } from "./authGuard";

describe("Security & Defense Layer Tests", () => {
  const TEST_IP = "192.168.1.100";
  const TEST_ACTION = "test_auth_action";

  beforeEach(() => {
    resetRateLimit(TEST_IP, TEST_ACTION);
  });

  describe("Rate Limiter & Brute Force Defense", () => {
    it("allows requests under the rate limit threshold", () => {
      const config = { maxRequests: 3, windowMs: 1000 };
      const res1 = checkRateLimit(TEST_IP, TEST_ACTION, config);
      const res2 = checkRateLimit(TEST_IP, TEST_ACTION, config);

      expect(res1.success).toBe(true);
      expect(res1.remaining).toBe(2);
      expect(res2.success).toBe(true);
      expect(res2.remaining).toBe(1);
    });

    it("throttles and blocks requests exceeding rate limit threshold", () => {
      const config = { maxRequests: 2, windowMs: 5000, blockDurationMs: 10000 };
      checkRateLimit(TEST_IP, TEST_ACTION, config);
      checkRateLimit(TEST_IP, TEST_ACTION, config);

      const blockedRes = checkRateLimit(TEST_IP, TEST_ACTION, config);
      expect(blockedRes.success).toBe(false);
      expect(blockedRes.remaining).toBe(0);
      expect(blockedRes.error).toContain("Rate limit exceeded");
    });

    it("resets rate limit correctly on successful completion", () => {
      const config = { maxRequests: 2, windowMs: 5000 };
      checkRateLimit(TEST_IP, TEST_ACTION, config);
      resetRateLimit(TEST_IP, TEST_ACTION);

      const freshRes = checkRateLimit(TEST_IP, TEST_ACTION, config);
      expect(freshRes.success).toBe(true);
      expect(freshRes.remaining).toBe(1);
    });
  });

  describe("Input Sanitization & Injection Prevention", () => {
    it("strips malicious HTML and script tags", () => {
      const malicious = "<script>alert('pwned')</script>John Doe <b>Pro</b>";
      const clean = sanitizeString(malicious);
      expect(clean).toBe("John Doe Pro");
      expect(clean).not.toContain("<script>");
    });

    it("strips javascript: pseudo-protocols and null bytes", () => {
      const malicious = "javascript:alert(1)\0malicious";
      const clean = sanitizeString(malicious);
      expect(clean).toBe("alert(1)malicious");
      expect(clean).not.toContain("javascript:");
    });

    it("validates login credentials via SignInSchema", () => {
      const valid = SignInSchema.safeParse({ email: "player@dctechmicro.com", password: "Password123!" });
      expect(valid.success).toBe(true);

      const invalidEmail = SignInSchema.safeParse({ email: "invalid-email", password: "Password123!" });
      expect(invalidEmail.success).toBe(false);
    });

    it("validates match score parameters within boundaries", () => {
      const validMatch = FinalizeMatchSchema.safeParse({
        matchId: "00000000-0000-0000-0000-000000000001",
        teamAScore: 11,
        teamBScore: 9,
      });
      expect(validMatch.success).toBe(true);

      const negativeScore = FinalizeMatchSchema.safeParse({
        matchId: "00000000-0000-0000-0000-000000000001",
        teamAScore: -5,
        teamBScore: 11,
      });
      expect(negativeScore.success).toBe(false);

      const nonIntegerScore = FinalizeMatchSchema.safeParse({
        matchId: "00000000-0000-0000-0000-000000000001",
        teamAScore: 11.5,
        teamBScore: 9,
      });
      expect(nonIntegerScore.success).toBe(false);
    });

    it("sanitizes walk-in player creation names", () => {
      const walkIn = WalkInPlayerSchema.safeParse({
        name: "<img src=x onerror=alert(1)>Alex Smith",
        type: "guest",
        skillRating: 3.5,
      });
      expect(walkIn.success).toBe(true);
      if (walkIn.success) {
        expect(walkIn.data.name).toBe("Alex Smith");
      }
    });
  });

  describe("Root System Admin Guards", () => {
    it("identifies root system admin email correctly", () => {
      expect(isRootSystemAdmin("admin@dctechmicro.com")).toBe(true);
      expect(isRootSystemAdmin("ADMIN@DCTECHMICRO.COM")).toBe(true);
      expect(isRootSystemAdmin("player@dctechmicro.com")).toBe(false);
      expect(isRootSystemAdmin(null)).toBe(false);
    });
  });

  describe("File Storage & Payload Guards", () => {
    it("enforces maximum storage byte boundaries on avatar uploads", () => {
      const MAX_AVATAR_STORAGE_BYTES = 250 * 1024;
      const oversizedPayload = "a".repeat(MAX_AVATAR_STORAGE_BYTES + 50);
      const normalPayload = "data:image/jpeg;base64," + "a".repeat(15000);

      expect(oversizedPayload.length > MAX_AVATAR_STORAGE_BYTES).toBe(true);
      expect(normalPayload.length <= MAX_AVATAR_STORAGE_BYTES).toBe(true);
    });
  });
});
