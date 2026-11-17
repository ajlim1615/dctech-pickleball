# Employee Directory vs. Casual Guest Walk-In Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restrict the Admin → Players tab to **Add Employee** only, and restrict **Guest / Non-Employee** walk-ins (no login, queue-only) to **Casual** sessions (`!isRanked`), keeping guests out of the Employee Directory, Company Rankings, and Ranked sessions.

**Architecture:** Add an explicit `is_guest boolean not null default false` column on `public.profiles` so guests are never confused with unregistered employees who have no email. Guests get a non-login placeholder auth account (`guest: true`, random 24-byte password) so all `queue_entries` and `match_players` foreign keys work seamlessly without login access. Enforce on the server that `is_guest = true` players can only be created for and added to Casual (`!isRanked`) sessions.

**Tech Stack:** Next.js 16 (App Router, Server Actions), React 19, TypeScript, Tailwind CSS, Supabase (PostgreSQL), Zod, Vitest.

## Global Constraints

- Admin → Players (`AdminDashboard.tsx`) may only create **Employee** accounts (`isGuest: false`).
- Guests (`is_guest = true`) must never receive a usable login password (`createPlayerAccount` uses a random 24-byte password and `guest: true`).
- `createWalkInPlayer({ isGuest: true })`, `bulkAddPlayersToQueue`, and `checkInToSession` must reject `is_guest = true` profiles when targeting a Ranked session (or when `sessionId` is missing for guest creation).
- Company-wide Rankings (`/rankings`) and Admin Employee Directory (`PlayerDirectory`) exclude `is_guest = true` profiles; per-session `SessionLeaderboard` in Casual sessions continues to include everyone who played.
- All changes must pass `npx tsc --noEmit` and `npm test` (`vitest run`).

## Review Focus

- **Unregistered Employee without email:** Adding an employee without an email in Admin → Players must set `is_guest = false` so they still appear in the Employee Directory and Ranked sessions.
- **Direct server action call with `isGuest: true` and no `sessionId` (or a Ranked `sessionId`):** `createWalkInPlayer` must reject it with a clear error.
- **Existing guest queued/checked-in to a Ranked session:** `bulkAddPlayersToQueue` and `checkInToSession` must reject `is_guest = true` profiles when the session is Ranked.
- **UI state reset on Ranked vs. Casual sessions:** `walkInIsGuest` in `SessionDetailView.tsx` must default to `false` when `sessionMeta.isRanked` is `true` and `!sessionMeta.isRanked` when Casual.
- **Legacy guest rows:** Backfill `is_guest = true` for existing `guest_%@dctechmicro.local` profiles in the migration so existing guests are classified accurately.

---

### Task 1: `profiles.is_guest` Migration, Types & Helper (TDD)

**Files:**
- Create: `supabase/migrations/20261117090000_profile_is_guest.sql`
- Modify: `src/types/database.types.ts`
- Modify: `src/features/players/server/createPlayer.ts`
- Modify: `src/features/admin/utils/playerDirectory.ts`
- Create: `src/features/admin/utils/playerDirectory.test.ts`

**Interfaces:**
- Produces:
  - `Profile["is_guest"]` (`boolean`)
  - `isGuestProfile(profile: { is_guest?: boolean | null; email?: string | null }): boolean`
  - `createPlayerAccount({ fullName, displayName, email?, rating, isGuest? })`

- [ ] **Step 1: Create `supabase/migrations/20261117090000_profile_is_guest.sql`**

Add `is_guest boolean not null default false` to `public.profiles` and backfill existing `guest_%@dctechmicro.local` rows to `is_guest = true`.

- [ ] **Step 2: Update `src/types/database.types.ts` (`profiles.Row/Insert/Update`) with `is_guest?: boolean` / `is_guest: boolean`**

- [ ] **Step 3: Write failing tests for `isGuestProfile` in `src/features/admin/utils/playerDirectory.test.ts`**

- [ ] **Step 4: Run test to verify it fails**

Run: `npx vitest run src/features/admin/utils/playerDirectory.test.ts`

- [ ] **Step 5: Implement `isGuestProfile` in `src/features/admin/utils/playerDirectory.ts` and update `createPlayerAccount` in `src/features/players/server/createPlayer.ts`**

`createPlayerAccount` accepts `isGuest?: boolean` and writes `is_guest: Boolean(params.isGuest)` to `profiles`.

- [ ] **Step 6: Run test & typecheck, then commit**

Run: `npx vitest run src/features/admin/utils/playerDirectory.test.ts` and `npx tsc --noEmit`
```bash
git add supabase/migrations/20261117090000_profile_is_guest.sql src/types/database.types.ts src/features/players/server/createPlayer.ts src/features/admin/utils/playerDirectory.ts src/features/admin/utils/playerDirectory.test.ts
git commit -m "feat: add profiles.is_guest column and helper"
```

---

### Task 2: Server-Side Casual-Only Guards

**Files:**
- Modify: `src/features/admin/api/adminActions.ts`
- Modify: `src/features/queue/api/queueActions.ts`
- Modify: `src/features/sessions/api/sessionActions.ts`

**Interfaces:**
- Consumes: `parseSessionMetadata` from `@/lib/utils`, `isGuestProfile` from `@/features/admin/utils/playerDirectory`.
- Produces:
  - `createWalkInPlayer(params: { fullName: string; email?: string; isGuest?: boolean; skillRating?: number; sessionId?: string })`

- [ ] **Step 1: Guard `createWalkInPlayer` in `adminActions.ts`**

When `params.isGuest` is `true`: require `params.sessionId`, fetch `sessions.description`, and return `{ error: "Guest / non-employee players can only be added to Casual sessions." }` if the session does not exist or `parseSessionMetadata(session.description).isRanked` is `true`. Pass `isGuest: Boolean(params.isGuest)` to `createPlayerAccount`.

- [ ] **Step 2: Guard `bulkAddPlayersToQueue` (`queueActions.ts`) and `checkInToSession` (`sessionActions.ts`)**

When the target session is Ranked (`parseSessionMetadata(session.description).isRanked`), reject any `playerId` whose profile has `is_guest = true`.

- [ ] **Step 3: Run typecheck & commit**

Run: `npx tsc --noEmit`
```bash
git add src/features/admin/api/adminActions.ts src/features/queue/api/queueActions.ts src/features/sessions/api/sessionActions.ts
git commit -m "feat: enforce casual-only guest rules in server actions"
```

---

### Task 3: Admin → Players Tab = Add Employee Only (+ Filter Guests from Directory & Company Rankings)

**Files:**
- Modify: `src/features/admin/components/AdminDashboard.tsx`
- Modify: `src/features/admin/components/PlayerDirectory.tsx`
- Modify: `src/features/rankings/api/rankingActions.ts`

**Interfaces:**
- Consumes: `isGuestProfile` from `@/features/admin/utils/playerDirectory`.

- [ ] **Step 1: Update Admin → Players modal & button in `AdminDashboard.tsx`**

- Change button label from `"Add walk-in"` to `"Add employee"`.
- Change modal title/subtitle to `"Add Employee"` (`"Add an unregistered DCTECH employee to the directory."`).
- Remove the `Player Type` `<select>` (`guest` vs `employee`); always submit `isGuest: false`.

- [ ] **Step 2: Filter guests out of `PlayerDirectory.tsx` and `getLeaderboard` (`rankingActions.ts`)**

Filter `!isGuestProfile(p)` in `PlayerDirectory` and `getLeaderboard` so non-employee casual guests do not appear in the Employee Directory or Company Rankings.

- [ ] **Step 3: Run typecheck & tests, then commit**

Run: `npx tsc --noEmit` and `npm test`
```bash
git add src/features/admin/components/AdminDashboard.tsx src/features/admin/components/PlayerDirectory.tsx src/features/rankings/api/rankingActions.ts
git commit -m "feat: make Admin Players tab Add Employee only and exclude guests from rankings"
```

---

### Task 4: Session Detail Modal — Non-Employee Walk-Ins Only in Casual Sessions

**Files:**
- Modify: `src/features/sessions/components/SessionDetailView.tsx`

**Interfaces:**
- Consumes: `isGuestProfile` from `@/features/admin/utils/playerDirectory`, `createWalkInPlayer` from `@/features/admin/api/adminActions`.

- [ ] **Step 1: Update `SessionDetailView.tsx` Walk-In & Roster tabs**

- Default `walkInIsGuest` to `!sessionMeta.isRanked` (and reset when opening the modal).
- Pass `sessionId: session.id` and `isGuest: !sessionMeta.isRanked && walkInIsGuest` to `createWalkInPlayer`.
- In the `Walk-in` tab:
  - When `sessionMeta.isRanked` is `true`: show only the unregistered DCTECH Employee form (no Guest / Non-Employee option) with a clear note that non-employees can only be added in Casual sessions.
  - When `sessionMeta.isRanked` is `false`: allow choosing **Guest / Non-Employee (no login)** or **DCTECH Employee**.
- In the `Roster` tab: when `sessionMeta.isRanked` is `true`, filter out `isGuestProfile(emp)`.

- [ ] **Step 2: Run full verification & commit**

Run: `npx tsc --noEmit` and `npm test`
```bash
git add src/features/sessions/components/SessionDetailView.tsx
git commit -m "feat: restrict non-employee walk-ins to casual sessions"
```
