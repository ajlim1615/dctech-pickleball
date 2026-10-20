# Session Activity Log, "Why Am I Waiting?" Card, and Admin Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record every important session action so players can see what happened and why they're waiting, and admins get a full audit trail with names.

**Architecture:** One `session_events` table written best-effort by the existing server actions through a small server-only helper. Players read a public feed (actor shown only as a role: self / an admin / automatic) with realtime updates. Admins read the same events with actor names through a security-definer RPC. Feed text and the wait estimate are pure, tested functions.

**Tech Stack:** Next.js 16 (App Router, server actions — read `node_modules/next/dist/docs/` before writing Next code, per AGENTS.md), Supabase (Postgres, RLS, column grants, realtime), Tailwind, Vitest.

**Spec:** The "Decisions" section below (agreed in conversation on 2026-10-20).

## Decisions (the spec)

1. **What's logged** (closed list, `type` column): `session_started`, `session_ended`, `checked_in`, `checked_out`, `joined_queue`, `left_queue`, `players_added`, `break_started`, `break_ended`, `moved_in_queue`, `removed_from_queue`, `players_swapped`, `game_started`, `game_result`, `result_corrected`, `no_show_swapped`, `court_closed`, `court_reopened`.
2. **Players see the whole session feed.** When an admin did it, players see "An admin"; a player's own action shows their name; automatic actions (auto-fill, re-queue) show no actor.
3. **Admins** see the same feed on the session page, plus an **Activity** tab on the Admin page across sessions, filterable by session and event type, showing the acting admin's name and before/after for corrections.
4. **"Why am I waiting?"** on the player's queue status: position, groups ahead, courts in play, average game length this session, estimated minutes, and the last 5 events that affected that player.
5. Logging never breaks an action: if writing an event fails, the action still succeeds.
6. Player-facing copy: sentence case, plain verbs, times in PHT via `formatPHTTime`.

## Global Constraints

- Actor identity must not be readable by non-admins: the `actor_id` column is not granted to `authenticated` for SELECT; admins get names only via `get_admin_audit` (checks `public.is_admin()`).
- A player can insert only `actor_role = 'self'` events whose `subject_ids = array[auth.uid()]`; every other event requires `public.is_admin()`.
- Never use `.in("status", [... "on_break"])` in queue filters (see `queueActions.ts`).
- Realtime channel names get a random suffix (pattern in `useLiveQueue.ts`).
- UI: no all-caps labels, monospace only for numbers (`font-mono tabular-nums`), touch targets ≥ 44px, light and dark mode.
- Migrations are applied to the live project (`fuofachkihszubrcrkww`) only after the user approves, via the Supabase connector.

## Review Focus

1. **A player forging an event about someone else** (calling the API directly with `actor_role: 'admin'` or another player's id): insert must be refused → verified in Task 1 Step 6 with SQL as a non-admin.
2. **Logging failing** (table missing before the migration, RLS refusal, network): the action still returns success → test in Task 2 (`logSessionEvent` resolves without throwing when the insert errors).
3. **Events whose players were since deleted or renamed** (walk-in guests): the feed shows "A player", never crashes → test in Task 3 (`describeEvent` with an unknown id).
4. **Wait estimate with zero courts in play or no finished games yet**: no division by zero, a sensible default (12 min per game) → tests in Task 3 (`estimateWait` with `courtsInPlay: 0`, `avgGameMinutes: null`).
5. **On-break players and the viewer's own position**: the position and groups-ahead count ignore on-break entries (same rule as the queue panel) → test in Task 3.

---

## File Structure

| File | Responsibility |
|---|---|
| `supabase/migrations/20261020030000_session_events.sql` | table, grants, RLS, realtime, `get_admin_audit` |
| `src/types/database.types.ts`, `src/types/index.ts` | `session_events` row type, `SessionEventType`, RPC type |
| `src/features/activity/server/logEvent.ts` | server-only `logSessionEvent` (best-effort insert) |
| `src/features/activity/utils/describeEvent.ts` | pure: event → one line of feed text |
| `src/features/activity/utils/waitEstimate.ts` | pure: wait estimate + events affecting a player |
| `src/features/activity/api/activityActions.ts` | `getSessionFeed`, `getAdminAudit`, `getAverageGameMinutes` |
| `src/features/activity/hooks/useLiveFeed.ts` | realtime subscription to new events |
| `src/features/activity/components/ActivityFeed.tsx`, `WaitCard.tsx`, `AdminAuditView.tsx` | UI |
| existing actions (`queueActions.ts`, `sessionActions.ts`, `matchActions.ts`, `adminActions.ts`) | call `logSessionEvent` |

---

### Task 1: Events table and admin audit RPC

**Files:**
- Create: `supabase/migrations/20261020030000_session_events.sql`
- Modify: `src/types/database.types.ts`, `src/types/index.ts`

**Interfaces:**
- Produces:
  - Table `public.session_events (id uuid pk default gen_random_uuid(), session_id uuid references sessions on delete cascade, type text not null check (type in (<Decision 1 list>)), actor_id uuid references profiles on delete set null, actor_role text not null check (actor_role in ('self','admin','system')), subject_ids uuid[] not null default '{}', court_id uuid references courts on delete set null, match_id uuid references matches on delete set null, details jsonb not null default '{}', created_at timestamptz not null default now())`; indexes on `(session_id, created_at desc)` and `(created_at desc)`.
  - Grants: `revoke all on session_events from anon, authenticated; grant select (id, session_id, type, actor_role, subject_ids, court_id, match_id, details, created_at) on session_events to authenticated; grant insert on session_events to authenticated;`
  - RLS: select `to authenticated using (true)`; insert `with check (actor_id = auth.uid() and ((actor_role = 'self' and subject_ids = array[auth.uid()]) or public.is_admin()))`. No update/delete policies.
  - `alter publication supabase_realtime add table public.session_events;`
  - `public.get_admin_audit(p_session_id uuid default null, p_types text[] default null, p_limit int default 200) returns table (id uuid, session_id uuid, session_title text, type text, actor_name text, actor_role text, subject_ids uuid[], court_id uuid, match_id uuid, details jsonb, created_at timestamptz)` — `security definer`, `set search_path = public`, returns nothing unless `is_admin()`; execute revoked from `public, anon`, granted to `authenticated`.
  - TS: `SessionEventType` union (Decision 1), `SessionEvent` row type without `actor_id`, `AdminAuditEvent` (RPC row).

- [ ] **Step 1: Write the migration** exactly as the Interfaces block says.
- [ ] **Step 2: Add the types**; run `npx tsc --noEmit -p .` → no errors.
- [ ] **Step 3: Commit** `feat(activity): session_events table and admin audit RPC (migration not applied)`.
- [ ] **Step 4 (needs the user's OK): Apply** the migration with the Supabase connector `apply_migration` (name `session_events`).
- [ ] **Step 5: Verify** with `execute_sql`: table exists, RLS on, `has_column_privilege('authenticated','public.session_events','actor_id','select')` is false, `has_function_privilege('anon','public.get_admin_audit(uuid,text[],integer)','execute')` is false, table is in `pg_publication_tables` for `supabase_realtime`.
- [ ] **Step 6: Verify forging is refused** (Review Focus 1): in one `execute_sql` transaction that ends in `rollback`, `set local role authenticated; set local request.jwt.claims = '{"sub":"<a non-admin profile id>"}';` then try inserting an `actor_role='admin'` event and a `self` event naming another player → both fail with an RLS error; a `self` event about themself succeeds. Run `get_advisors` (security) → no new warnings about `session_events` or `get_admin_audit`.

### Task 2: Server-side event logging

**Files:**
- Create: `src/features/activity/server/logEvent.ts`
- Test: `src/features/activity/logEvent.test.ts`
- Modify: `queueActions.ts`, `sessionActions.ts`, `matchActions.ts`, `adminActions.ts`

**Interfaces:**
- Consumes: `SessionEventType` (Task 1).
- Produces: `logSessionEvent(supabase: SupabaseLike, event: { sessionId: string | null; type: SessionEventType; actorId: string; actorRole: "self" | "admin" | "system"; subjectIds?: string[]; courtId?: string | null; matchId?: string | null; details?: Record<string, unknown> }): Promise<void>` where `SupabaseLike` is `{ from(table: "session_events"): { insert(row: object): PromiseLike<{ error: { message: string } | null }> } }` (so it's testable with a fake). Never throws; logs failures with `console.error`. Not in a `"use server"` file (must not be callable from the browser).

- [ ] **Step 1: Write the failing tests**: `"inserts one row with the mapped columns"` (fake records the row: `session_id`, `type`, `actor_id`, `actor_role`, `subject_ids` default `[]`, `details` default `{}`); `"resolves when the insert returns an error"`; `"resolves when the insert throws"` (Review Focus 2).
- [ ] **Step 2: Run** `npx vitest run src/features/activity/logEvent.test.ts` → FAIL (module missing).
- [ ] **Step 3: Implement `logSessionEvent`.**
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Call it from each action** after its main write succeeds (`actorRole` = `"self"` when the caller acts on their own entry, `"admin"` for admin actions, `"system"` for automatic follow-ups inside an admin action):

| Action | Event(s) | subjectIds | details |
|---|---|---|---|
| `updateSessionStatus` → active / completed | `session_started` / `session_ended` | — | — |
| `checkInToSession` / `checkOutOfSession` | `checked_in` / `checked_out` | player | — |
| `joinQueue` / `leaveQueue` | `joined_queue` / `left_queue` | player (+ partner/guest) | `{ with?: name }` |
| `bulkAddPlayersToQueue` | `players_added` | added ids | `{ count }` |
| `setQueueBreak` | `break_started` / `break_ended` | player | — |
| `bumpPlayerInQueue` | `moved_in_queue` | player | `{ positions }` |
| `adminRemovePlayerFromQueue` | `removed_from_queue` | player | `{ checkedOut: boolean }` |
| `swapQueuePlayers` / `substituteQueuePlayer` | `players_swapped` | both players | — |
| `callNextUp` | `game_started` | 4 players | `{ courtName, teamA: ids, teamB: ids }`, `actorRole` `"system"` when called from `finalizeMatch` auto-fill |
| `finalizeMatch` | `game_result` | 4 players | `{ courtName, scoreA, scoreB, winner }` |
| `correctMatchResult` | `result_corrected` | 4 players | `{ from: {a,b}, to: {a,b} }` |
| `swapNoShow` | `no_show_swapped` | no-show, replacement | `{ courtName, out: id, in: id }` |
| `toggleCourtStatus` → maintenance/reserved / available | `court_closed` / `court_reopened` | — | `{ courtName }`; `sessionId` = active session or null |

- [ ] **Step 6: Run** `npx tsc --noEmit -p .` and `npx vitest run --dir src` → pass.
- [ ] **Step 7: Commit** `feat(activity): log session events from server actions`.

### Task 3: Feed text and wait estimate (pure)

**Files:**
- Create: `src/features/activity/utils/describeEvent.ts`, `src/features/activity/utils/waitEstimate.ts`
- Test: `src/features/activity/describeEvent.test.ts`, `src/features/activity/waitEstimate.test.ts`

**Interfaces:**
- Consumes: `SessionEvent`, `AdminAuditEvent` (Task 1).
- Produces:
  - `describeEvent(event: SessionEvent & { actor_name?: string | null }, names: Record<string, string>, viewerId?: string): string` — names players from `names` ("you" when it's the viewer; "A player" when unknown); actor is "An admin" for `actor_role='admin'` unless `actor_name` is given (admin audit), omitted for `system`.
  - `estimateWait(input: { position: number | null; courtsInPlay: number; avgGameMinutes: number | null }): { groupsAhead: number; minutes: number; nextGame: boolean }` — `groupsAhead = max(0, ceil(position/4) - 1)`; `minutes = ceil(groupsAhead / max(1, courtsInPlay)) * (avgGameMinutes ?? 12)`; `nextGame = groupsAhead === 0`.
  - `eventsAffecting(events: SessionEvent[], playerId: string, limit = 5): SessionEvent[]` — newest first, types `moved_in_queue | removed_from_queue | no_show_swapped | players_swapped | break_started | break_ended | game_started | game_result | result_corrected`.

- [ ] **Step 1: Write the failing tests** (exact strings):
  - `describeEvent` `moved_in_queue` by admin with `positions: -4` for player Mark, viewer Mark → `"An admin moved you back 4 places"`; same with `actor_name: "Ana"` → `"Ana moved you back 4 places"`.
  - `no_show_swapped` → `"Rico Tan didn't show on Court 2; Ana Lim took the spot"`.
  - `result_corrected` → `"An admin corrected a result on Court 1 from 11-9 to 9-11"`.
  - `break_started` by self, viewer someone else → `"Joy Ramos took a break"`.
  - `game_started` with `actor_role: "system"` → `"Court 3: Maria Santos & Jun Reyes vs Carlo Dizon & Bea Villanueva"`.
  - unknown subject id → contains `"A player"` (Review Focus 3).
  - `estimateWait({position:3,courtsInPlay:4,avgGameMinutes:14})` → `{groupsAhead:0,minutes:0,nextGame:true}`; `({position:7,courtsInPlay:4,avgGameMinutes:14})` → `{groupsAhead:1,minutes:14,nextGame:false}`; `({position:13,courtsInPlay:2,avgGameMinutes:10})` → `{groupsAhead:3,minutes:20}`; `courtsInPlay:0` and `avgGameMinutes:null` → uses 1 court and 12 min (Review Focus 4).
  - `eventsAffecting` returns only the player's events, newest first, at most 5.
- [ ] **Step 2: Run** `npx vitest run src/features/activity` → FAIL.
- [ ] **Step 3: Implement** both modules.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(activity): feed text and wait estimate`.

### Task 4: Read actions and live feed hook

**Files:**
- Create: `src/features/activity/api/activityActions.ts`, `src/features/activity/hooks/useLiveFeed.ts`

**Interfaces:**
- Produces:
  - `getSessionFeed(sessionId: string, limit = 50): Promise<SessionEvent[]>` (explicit column list, newest first; `[]` on error).
  - `getAverageGameMinutes(sessionId: string): Promise<number | null>` (mean of `ended_at - started_at` of the session's completed matches, rounded; `null` when none).
  - `getAdminAudit(filters: { sessionId?: string; types?: SessionEventType[]; limit?: number }): Promise<AdminAuditEvent[]>` — `requireAdminUser()` first; calls `get_admin_audit`.
  - `useLiveFeed(sessionId: string, initial: SessionEvent[]): SessionEvent[]` — prepends inserted rows for this session (realtime, random channel suffix, stable empty default like `useLiveQueue`).

- [ ] **Step 1: Implement** the three actions and the hook.
- [ ] **Step 2: Run** `npx tsc --noEmit -p .` → no errors.
- [ ] **Step 3: Commit** `feat(activity): feed and audit read actions, live feed hook`.

### Task 5: Player-facing UI

**Files:**
- Create: `src/features/activity/components/ActivityFeed.tsx`, `src/features/activity/components/WaitCard.tsx`
- Modify: `src/app/(app)/sessions/[id]/page.tsx`, `SessionDetailView.tsx`, `SessionQueueLiveBoard.tsx`

**Interfaces:**
- Consumes: Tasks 3–4.
- Produces: `ActivityFeed({ sessionId, initialEvents, names, viewerId })`; `WaitCard({ position, courtsInPlay, avgGameMinutes, events, names, viewerId })`.

- [ ] **Step 1: `ActivityFeed`** — section "Activity" under the courts/queue on the session page: newest first, time on the left (`formatPHTTime`), one line from `describeEvent`; shows 15 with "Show more"; empty state "Nothing has happened yet."; live via `useLiveFeed`.
- [ ] **Step 2: `WaitCard`** — inside the queue panel's "in line" status: a "Why the wait?" toggle opening: "You're #7. 1 group ahead of you, 4 courts in play, games are averaging 14 min, so about 14 min." (or "You're in the next game."), then up to 5 `eventsAffecting` lines.
- [ ] **Step 3: Load data** on the session page: `getSessionFeed`, `getAverageGameMinutes`, and a `names` map from checked-in players + employees.
- [ ] **Step 4: Run** `npx tsc --noEmit -p .`, `npx vitest run --dir src` → pass.
- [ ] **Step 5: Verify visually** with a temporary mock page under `src/app/(auth)/auth/` at 375px and 1366px, light and dark; delete it afterwards.
- [ ] **Step 6: Commit** `feat(ui): session activity feed and why-the-wait card`.

### Task 6: Admin audit view

**Files:**
- Create: `src/features/activity/components/AdminAuditView.tsx`
- Modify: `src/features/admin/components/AdminDashboard.tsx`, `src/app/(app)/admin/page.tsx`

**Interfaces:**
- Consumes: `getAdminAudit`, `describeEvent` with `actor_name`.

- [ ] **Step 1: Add an "Activity" tab** to the Admin page (after "Rules & guide"): filters "Session" (select, default the live or latest session) and "Show" (All / Games & results / Queue changes / Corrections & swaps); list rows "time · description · by <actor name>"; corrections show before → after from `details`.
- [ ] **Step 2: Run** `npx tsc --noEmit -p .`, `npx vitest run --dir src`, `npx next build` → pass.
- [ ] **Step 3: Verify visually** (same temporary-page method), delete the page.
- [ ] **Step 4: Commit** `feat(ui): admin activity audit tab`.

---

**After all tasks:** whole-branch review by a fresh reviewer; then, with the user, run a real session and confirm through `execute_sql` that events were written for each action.
