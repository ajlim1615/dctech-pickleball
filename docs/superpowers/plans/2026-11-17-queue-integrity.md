# Queue, Court and Session Integrity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The database guarantees one place in line per player, one live game per court, one live game per player, and that closing a session touches only that session — and every game-state change happens in one transaction.

**Architecture:** Four `security definer` procedures (`start_match`, `swap_match_player`, `finish_match`, `close_session`) become the only writers of game state; each locks the session row first and returns `{error: code}` for expected failures. Two partial unique indexes back them up. The server actions keep the decisions (matchmaking, ratings, validation, events) and call the procedures; queue inserts go through one duplicate-safe helper; status lists and error codes each live in one TS module.

**Tech Stack:** Next.js 16 Server Actions, TypeScript, Supabase Postgres (plpgsql, RLS), Supabase MCP (`execute_sql`, `apply_migration`, `list_migrations`), Vitest.

**Spec:** `docs/superpowers/specs/2026-11-17-queue-integrity-design.md`

## Global Constraints

- Supabase project id `fuofachkihszubrcrkww`. Local dev talks to this (production) database.
- **SQL test runs:** one `execute_sql` query = `supabase/tests/_fixtures.sql` + every migration of this plan not yet applied (in version order) + the test file. No `BEGIN`/`COMMIT`. Each test ends with `raise exception 'ALL TESTS PASSED'`, which rolls everything back. Pass = that error text; anything else = fail.
- Migration versions: `20261117120000`, `…130000`, `…140000`, `…150000` (production's latest recorded is `20261117110808`). Never run `supabase db push` on this project.
- **Since Task 5:** all four are on production as `20261117140735`/`140738`/`140742`/`140746` (files renamed to match). A test run is now fixtures + test file only.
- `apply_migration` on production needs the user's explicit OK in chat first.
- Every procedure: `language plpgsql security definer set search_path = ''`, fully qualified names, first statement `if not public.is_admin() then return json_build_object('error','not_admin'); end if;`, then lock the session row `for update`; `revoke execute … from public, anon; grant execute … to authenticated;`; a header comment saying it must be called with the signed-in user's client (not the service key).
- Expected failures return `json_build_object('error', '<code>')` with a code from `GAME_STATE_ERRORS`; only bugs `raise`.
- Active queue entry = `status <> 'left'`. "In line, off court" = `waiting`, `called`, `on_break`.
- No app code writes `courts.status = 'occupied'`, `courts.status = 'available'` for freeing, or `courts.current_match_id` after this plan.
- Every task ends green on `npx tsc --noEmit` and `npm test`.
- Branch `fix/queue-integrity`. Don't push (blocked in auto mode); give the user the command.
- No visual changes; keep existing user-facing copy where the table in Task 6 reuses it.

## Review Focus

- **Double-tap Join, or check-in + Join at once:** one active entry; the second call succeeds quietly. → Task 1 test 1, Task 6 `insertQueueEntries` tests.
- **Two admins press Call next on the same court:** one game, the other sees "already has a game", nobody stranded `playing`. → Task 1 tests 3 and 5b.
- **A player rejoins the line while their game is being saved:** the save still succeeds and they hold exactly one active entry. → Task 3 test 4.
- **Cancelling a future session while another is live:** the live session's courts, games and line are untouched. → Task 4 test 1.
- **Starting a session while the previous one still has a game in progress:** that game is abandoned and its line emptied (no orphans). → Task 4 test 2 + Task 10 wiring.

---

### Task 1: Test fixtures, indexes and `start_match`

**Files:**
- Create: `supabase/tests/_fixtures.sql`
- Create: `supabase/migrations/20261117120000_game_state_start_match.sql`
- Create: `supabase/tests/start_match.test.sql`
- Create: `supabase/rollback/20261117_game_state_down.sql`
- Modify: `src/types/database.types.ts` (`Functions`, next to `record_match_result` ~line 505)

**Interfaces:**
- Produces (fixtures, `pg_temp`, live for one query):
  - `pg_temp.itest_user(p_role text default 'player') returns uuid` — inserts into `auth.users` (`id`, `email 'itest-<id>@example.test'`, `aud`/`role 'authenticated'`); the existing trigger creates the profile; sets `profiles.role` when not `player`. If `auth.users` rejects the insert, add the columns its error names.
  - `pg_temp.itest_as(p_user uuid) returns void` — `set_config('request.jwt.claims', {"sub": p_user, "role": "authenticated"}, true)`.
  - `pg_temp.itest_session(p_admin uuid, p_status text default 'active') returns uuid`
  - `pg_temp.itest_court(p_name text, p_sort int) returns uuid` — status `available`.
  - `pg_temp.itest_line(p_session uuid, p_players uuid[]) returns void` — `waiting` entries 1 s apart in array order (first = front) and `checked_in` rows.
- Produces: indexes `queue_entries_one_active_per_player on queue_entries (session_id, player_id) where status <> 'left'` and `matches_one_live_per_court on matches (court_id) where status = 'in_progress'`.
- Produces: `public.start_match(p_session_id uuid, p_court_id uuid, p_team_a uuid[], p_team_b uuid[], p_from_queue boolean) returns json` → `{"match_id"}` | `{"error": not_admin | bad_teams | not_found | session_not_active | court_closed | court_busy | player_busy | line_changed}`.
- Produces TS type `start_match: { Args: { p_session_id: string; p_court_id: string; p_team_a: string[]; p_team_b: string[]; p_from_queue: boolean }; Returns: Json }`.

- [ ] **Step 1: Write `_fixtures.sql` and the failing test** — `supabase/tests/start_match.test.sql`:

```sql
do $$
declare a uuid; p uuid[]; s uuid; c1 uuid; c2 uuid; r json; n int;
begin
  a := pg_temp.itest_user('admin');
  select array_agg(pg_temp.itest_user()) into p from generate_series(1, 6);
  perform pg_temp.itest_as(a);
  s := pg_temp.itest_session(a);
  c1 := pg_temp.itest_court('itest A', 901);
  c2 := pg_temp.itest_court('itest B', 902);
  perform pg_temp.itest_line(s, p);

  -- 1. one active entry per player per session
  begin
    insert into public.queue_entries (session_id, player_id, status) values (s, p[1], 'on_break');
    raise exception 'FAIL 1: duplicate active entry allowed';
  exception when unique_violation then null; end;

  -- 2. start from the line
  r := public.start_match(s, c1, array[p[1], p[2]], array[p[3], p[4]], true);
  if r->>'match_id' is null then raise exception 'FAIL 2: %', r; end if;
  select count(*) into n from public.queue_entries where session_id = s and status = 'playing' and target_court_id = c1;
  if n <> 4 then raise exception 'FAIL 2b: playing = %', n; end if;
  if (select current_match_id from public.courts where id = c1) is distinct from (r->>'match_id')::uuid
     or (select status from public.courts where id = c1) <> 'occupied' then raise exception 'FAIL 2c'; end if;
  if (select count(*) from public.match_players where match_id = (r->>'match_id')::uuid and team = 'team_a') <> 2
     then raise exception 'FAIL 2d'; end if;

  -- 3. same court again (busy is read from matches, so clearing the court mirror doesn't hide it)
  update public.courts set status = 'available', current_match_id = null where id = c1;
  r := public.start_match(s, c1, array[p[5]], array[p[6]], true);
  if r->>'error' is distinct from 'court_busy' then raise exception 'FAIL 3: %', r; end if;

  -- 4. manual match with a player already on court
  r := public.start_match(s, c2, array[p[1]], array[p[5]], false);
  if r->>'error' is distinct from 'player_busy' then raise exception 'FAIL 4: %', r; end if;

  -- 5. from the line, everyone must still be waiting; nothing is half-claimed
  update public.queue_entries set status = 'on_break' where session_id = s and player_id = p[5];
  r := public.start_match(s, c2, array[p[5]], array[p[6]], true);
  if r->>'error' is distinct from 'line_changed' then raise exception 'FAIL 5: %', r; end if;
  if (select status from public.queue_entries where session_id = s and player_id = p[6] and status <> 'left') <> 'waiting'
     then raise exception 'FAIL 5b: partial claim kept'; end if;

  -- 6. closed court
  update public.courts set status = 'maintenance' where id = c2;
  r := public.start_match(s, c2, array[p[5]], array[p[6]], false);
  if r->>'error' is distinct from 'court_closed' then raise exception 'FAIL 6: %', r; end if;
  update public.courts set status = 'available' where id = c2;

  -- 7. bad teams
  r := public.start_match(s, c2, array[p[5]], array[p[5]], false);
  if r->>'error' is distinct from 'bad_teams' then raise exception 'FAIL 7: %', r; end if;
  r := public.start_match(s, c2, array[p[5], p[6]], array[p[2]], false);
  if r->>'error' is distinct from 'bad_teams' then raise exception 'FAIL 7b: %', r; end if;

  -- 8. manual match claims waiting and on_break entries; singles format
  r := public.start_match(s, c2, array[p[5]], array[p[6]], false);
  if r->>'match_id' is null then raise exception 'FAIL 8: %', r; end if;
  if exists (select 1 from public.queue_entries where session_id = s and player_id in (p[5], p[6]) and status not in ('playing', 'left'))
     then raise exception 'FAIL 8b'; end if;
  if (select format from public.matches where id = (r->>'match_id')::uuid) <> 'singles' then raise exception 'FAIL 8c'; end if;

  -- 9. one live game per court, even written directly
  begin
    insert into public.matches (session_id, court_id, status) values (s, c1, 'in_progress');
    raise exception 'FAIL 9: second live game allowed';
  exception when unique_violation then null; end;

  -- 10. session must be live
  update public.sessions set status = 'scheduled' where id = s;
  r := public.start_match(s, c2, array[p[1]], array[p[2]], false);
  if r->>'error' is distinct from 'session_not_active' then raise exception 'FAIL 10: %', r; end if;

  -- 11. admins only
  perform pg_temp.itest_as(p[1]);
  r := public.start_match(s, c2, array[p[1]], array[p[2]], false);
  if r->>'error' is distinct from 'not_admin' then raise exception 'FAIL 11: %', r; end if;

  raise exception 'ALL TESTS PASSED';
end $$;
```

- [ ] **Step 2: Run to see it fail** — `execute_sql`: fixtures + test. Expected: `FAIL 1: duplicate active entry allowed`.

- [ ] **Step 3: Write the migration** `20261117120000_game_state_start_match.sql`:
  1. One-time cleanup: active entries with an earlier active entry for the same (session, player) → `left` (keep earliest `joined_at`, then lowest `id`); `in_progress` matches with a newer `in_progress` match on the same court → `abandoned`, `ended_at = now()`; courts `occupied` or with `current_match_id` whose match isn't `in_progress` → `available`, `current_match_id = null`.
  2. The two indexes.
  3. `start_match`, in this order: admin → `bad_teams` (sizes equal, 1 or 2 each, no id on both sides or twice) → lock session (`not_found` / `session_not_active`) → court row (`not_found`; `maintenance`/`reserved` → `court_closed`) → `exists in_progress match on p_court_id` → `court_busy` → any player in an `in_progress` match → `player_busy` → **check before writing** (an error return does not roll back earlier updates): when `p_from_queue`, every player needs an entry `status = 'waiting'` in this session, else `line_changed`; when not, entries in `('waiting','called','on_break')` are claimed and players without an active entry are allowed → claim (`playing`, `called_at = now()`, `target_court_id`) → insert match (`in_progress`, 0–0, `started_at now()`, `format` `doubles` if 2 per side else `singles`) → `match_players` → court mirror `occupied` + `current_match_id` → `{"match_id"}`.
  4. Grants. Add the TS type.

  Down script `supabase/rollback/20261117_game_state_down.sql` (grows in Tasks 2–4): drop the procedures, drop both indexes, re-grant `record_match_result` to `authenticated`.

- [ ] **Step 4: Run again** — fixtures + migration + test. Expected: `ALL TESTS PASSED`; then `select to_regproc('public.start_match')` → `null`.

- [ ] **Step 5: Commit**

```bash
git checkout -b fix/queue-integrity
git add supabase/tests supabase/migrations/20261117120000_game_state_start_match.sql supabase/rollback src/types/database.types.ts docs/superpowers
git commit -m "feat(db): start_match and one-active-entry / one-live-game indexes"
```

---

### Task 2: `swap_match_player`

**Files:**
- Create: `supabase/migrations/20261117130000_game_state_swap_player.sql`, `supabase/tests/swap_match_player.test.sql`
- Modify: `src/types/database.types.ts`, `supabase/rollback/20261117_game_state_down.sql`

**Interfaces:**
- Consumes: fixtures, `start_match`.
- Produces: `public.swap_match_player(p_match_id uuid, p_out uuid, p_window_minutes integer) returns json` → `{"replacement_id": uuid}` | `{"error": not_admin | not_found | game_not_live | swap_window_closed | not_in_game | no_replacement}`. The window comes from TS `NO_SHOW_WINDOW_MINUTES` (single source).

- [ ] **Step 1: Failing test** — fixture: admin, 6 players, line `p[1..6]`, game on court A with `p[1..4]` from the line. Assertions:
  1. `swap_match_player(m, p[1], 5)` → `replacement_id = p[5]`; `match_players` of `m` contains `p[5]`, not `p[1]`; `p[5]` entry `playing` with `target_court_id = court A`; `p[1]` entry `on_break` with `joined_at` later than `p[6]`'s and `target_court_id is null`.
  2. Again with `p[2]` but `p[6]` set to `on_break` first → `no_replacement`, and `p[2]` still in the game.
  3. With `p[3]` after setting `matches.team_a_score = 1` → `swap_window_closed`; after resetting to 0 and setting `started_at = now() - interval '6 minutes'` → `swap_window_closed`.
  4. With a player not in the game → `not_in_game`.
  5. On a `completed` match → `game_not_live`.
  6. As a player → `not_admin`.

- [ ] **Step 2: Run to see it fail** — fixtures + Task 1 migration + test → `function public.swap_match_player(...) does not exist`.
- [ ] **Step 3: Write the migration** — admin → read match's session (`not_found`) → lock session → lock match (`game_not_live` unless `in_progress`) → window (any score ≠ 0, or `started_at` older than `p_window_minutes`) → `not_in_game` → replacement = first `waiting` entry in this session by `joined_at, id` whose player isn't in this match and whose email isn't `admin@dctechmicro.com` (`no_replacement` if none) → claim it → swap the `match_players` row → no-show's `playing` entry → `on_break`, `joined_at = now()`, `target_court_id = null`. Grants, TS type, down script.
- [ ] **Step 4: Run again** → `ALL TESTS PASSED`.
- [ ] **Step 5: Commit** — `git commit -m "feat(db): swap_match_player swaps a no-show in one transaction"`

---

### Task 3: `finish_match`

**Files:**
- Create: `supabase/migrations/20261117140000_game_state_finish_match.sql`, `supabase/tests/finish_match.test.sql`
- Modify: `src/types/database.types.ts`, `supabase/rollback/20261117_game_state_down.sql`

**Interfaces:**
- Consumes: `record_match_result` (unchanged body), fixtures, `start_match`.
- Produces: `public.finish_match(p_match_id uuid, p_team_a_score integer, p_team_b_score integer, p_winning_team public.winning_team, p_ranked boolean, p_rating_changes jsonb, p_rules_version integer, p_min_rating numeric, p_max_rating numeric) returns json` → `{"success": true, "requeued": int, "session_id": uuid, "court_id": uuid|null}` | `{"error": not_admin | not_found | already_saved}`. Same arguments as `record_match_result`.
- Produces: `execute` on `record_match_result` revoked from `authenticated`.

- [ ] **Step 1: Failing test** — fixture: admin, 8 players, line `p[1..8]`; `p[1]` and `p[2]` share a `group_id` (set it on their entries); game with team A `[p1,p2]`, team B `[p3,p4]` (casual: `p_ranked false`, `'[]'::jsonb`). Before saving: `p[4]` checked out (`session_checkins.status = 'checked_out'`). Assertions:
  1. `finish_match(m, 11, 5, 'team_a', false, '[]', 2, 1, 7)` → `success`, `requeued = 3`; match `completed`; court A `available`, `current_match_id null`.
  2. New `waiting` entries for `p1, p2, p3` (not `p4`), all `joined_at` later than `p[8]`'s, ordered `p1 < p2 < p3`, distinct; `p1` and `p2` share a non-null `group_id`.
  3. Second call → `already_saved`.
  4. Rejoin race: start a game with `p[5..8]`; before finishing, give `p[5]` a `waiting` entry by setting their `playing` entry to `left` and inserting a fresh `waiting` one; `finish_match` → `success`; `p[5]` has exactly one active entry.
  5. Session no longer `active` (set `completed` before finishing another game) → `success`, `requeued = 0`.
  6. As a player → `not_admin`.
  7. `has_function_privilege('authenticated', 'public.record_match_result(uuid,integer,integer,public.winning_team,boolean,jsonb,integer,numeric,numeric)', 'execute')` is false.

- [ ] **Step 2: Run to see it fail** — fixtures + Tasks 1–2 migrations + test → `function public.finish_match(...) does not exist`.
- [ ] **Step 3: Write the migration** — admin → read match (`not_found`) → lock session → lock match (`already_saved` unless `in_progress`) → `perform`/call `record_match_result` with the same arguments; if it returns an `error`, `raise` (it can't, after the checks above) → when the session is `active`: for each match player still `checked_in`, in `team` then `match_players.created_at, id` order, insert a `waiting` entry with `joined_at = clock_timestamp()`-based values 1 ms apart, `group_id` = their latest entry's `group_id` only if both partners are rejoining, using `on conflict (session_id, player_id) where status <> 'left' do nothing` → return counts. Revoke `record_match_result` from `authenticated`. Grants, TS type, down script.
- [ ] **Step 4: Run again** → `ALL TESTS PASSED`.
- [ ] **Step 5: Commit** — `git commit -m "feat(db): finish_match saves a result and requeues players in one transaction"`

---

### Task 4: `close_session`

**Files:**
- Create: `supabase/migrations/20261117150000_game_state_close_session.sql`, `supabase/tests/close_session.test.sql`
- Modify: `src/types/database.types.ts`, `supabase/rollback/20261117_game_state_down.sql`

**Interfaces:**
- Produces: `public.close_session(p_session_id uuid, p_status public.session_status) returns json` → `{"success": true, "abandoned": int}` | `{"error": not_admin | bad_status | not_found}`.

- [ ] **Step 1: Failing test** — fixture: admin, 4 players, live session `L` with a game on court A (`m`), scheduled session `F`.
  1. `close_session(F, 'cancelled')` → success; `F` cancelled; court A still `occupied` with `current_match_id = m`; `m` still `in_progress`.
  2. `close_session(L, 'completed')` → `abandoned = 1`; `m` `abandoned` with `ended_at`; court A `available`, null; no entry of `L` with `status <> 'left'`; `L` completed.
  3. `close_session(L, 'active')` → `bad_status`.
  4. As a player → `not_admin`.
- [ ] **Step 2: Run to see it fail** — fixtures + Tasks 1–3 migrations + test → `function public.close_session(...) does not exist`.
- [ ] **Step 3: Write the migration** — admin → `bad_status` unless `completed`/`cancelled` → lock session (`not_found`) → free courts mirroring this session's `in_progress` matches → abandon those matches (count) → this session's active entries → `left` → session status + `updated_at`. Grants, TS type, down script.
- [ ] **Step 4: Run again** → `ALL TESTS PASSED`.
- [ ] **Step 5: Commit** — `git commit -m "feat(db): close_session closes only its own games, courts and line"`

---

### Task 5: Apply to production

The app needs these procedures before its wiring can be checked in the local preview. **Correction (final review):** this is not purely additive — `game_state_finish_match` revokes `record_match_result` from `authenticated`, so the previously deployed app cannot save results until this branch is deployed. Apply and deploy together.

- [ ] **Step 1: Check for violations** — `execute_sql`: count (session, player) groups with more than one `status <> 'left'` entry, and courts with more than one `in_progress` match. Report any rows to the user (the migration's cleanup resolves them).
- [ ] **Step 2: Ask the user to approve** applying the four migrations to production.
- [ ] **Step 3: Apply** with `apply_migration` in version order, names `game_state_start_match`, `game_state_swap_player`, `game_state_finish_match`, `game_state_close_session`.
- [ ] **Step 4: Align versions** — `list_migrations`; rename each local file to `<recorded version>_<name>.sql`; update the Global Constraints test-run note (applied migrations are no longer included).
- [ ] **Step 5: Verify** — each test file with fixtures only → `ALL TESTS PASSED` ×4.
- [ ] **Step 6: Commit** — `git commit -m "chore(db): align game-state migration versions with production"`

---

### Task 6: Shared TS modules

**Files:**
- Create: `src/features/queue/constants/queueStatuses.ts`
- Create: `src/features/matches/utils/gameStateErrors.ts`
- Create: `src/features/queue/server/insertQueueEntries.ts`
- Create: `src/features/queue/utils/lineRetry.ts`
- Test: `src/features/matches/gameStateErrors.test.ts`, `src/features/queue/insertQueueEntries.test.ts`, `src/features/queue/utils/lineRetry.test.ts`

**Interfaces:**
- Produces: `LINE_STATUSES = ["waiting", "called", "on_break"] as const` (in line, off court) and `isInLine(status: string): boolean`. Active = `!== "left"`, stated in the module comment.
- Produces: `GAME_STATE_ERRORS` (readonly tuple of every code used in Tasks 1–4), `type GameStateError`, `gameStateErrorMessage(code: string | undefined): string` (logs `console.error` for codes not in the list):

| code | message |
|---|---|
| `not_admin` | `Only admins can do this.` |
| `bad_teams` | `Each team needs the same number of players (1 or 2), and no one can be on both teams.` |
| `not_found` | `That game or session no longer exists. Reload and try again.` |
| `session_not_active` | `Start the session before calling players onto courts.` |
| `court_closed` | `This court is closed. Reopen it before starting a game.` |
| `court_busy` | `This court already has a game in progress. Save its score first.` |
| `player_busy` | `One of these players is already in a game on another court.` |
| `line_changed` | `The line changed while calling players. Try again.` |
| `game_not_live` | `This game is no longer in progress.` |
| `swap_window_closed` | `` `Players can only be swapped before the first point, in the first ${NO_SHOW_WINDOW_MINUTES} minutes.` `` |
| `not_in_game` | `That player isn't in this game.` |
| `no_replacement` | `No one is waiting to swap in.` |
| `already_saved` | `This game was already saved.` |
| `bad_status` | `A session can only be ended or cancelled here.` |
| anything else | `That couldn't be saved. Nothing was changed; please try again.` |

- Produces: `type QueueEntryInsert = { session_id: string; player_id: string; status: "waiting"; group_id?: string | null; joined_at?: string; target_court_id?: string | null }` and `insertQueueEntries(client: QueueInsertClient, rows: QueueEntryInsert[]): Promise<{ inserted: number; skipped: number; error?: string }>` — `QueueInsertClient` is the minimal `{ from(table: "queue_entries"): { insert(rows: QueueEntryInsert[]): PromiseLike<{ error: { code?: string; message: string } | null }> } }`. Empty → no call; one batch; on `23505` retry row by row counting `23505`s as `skipped`; any other error returned by `message`.
- Produces: `staggeredJoinTimes(count: number, now: Date): string[]` in the same file (ISO strings `now + i ms`).
- Produces: `withLineRetry<T>(attempt: () => Promise<T>, shouldRetry: (result: T) => boolean, maxAttempts = 2): Promise<T>`.

- [ ] **Step 1: Write the failing tests**

```ts
// gameStateErrors.test.ts
it("every code the SQL returns has a message, and every message has a code in SQL", () => {
  const sql = readdirSync("supabase/migrations").map((f) => readFileSync(join("supabase/migrations", f), "utf8")).join("\n");
  const inSql = new Set([...sql.matchAll(/'error',\s*'([a-z_]+)'/g)].map((m) => m[1]));
  expect([...inSql].sort()).toEqual([...GAME_STATE_ERRORS].sort());
});
it.each([["court_busy", "This court already has a game in progress. Save its score first."],
         ["already_saved", "This game was already saved."]])("%s copy", (code, text) =>
  expect(gameStateErrorMessage(code)).toBe(text));
it("falls back for unknown codes", () =>
  expect(gameStateErrorMessage("nope")).toBe("That couldn't be saved. Nothing was changed; please try again."));

// insertQueueEntries.test.ts
const fake = (results: { error: { code?: string; message: string } | null }[]) => {
  const calls: unknown[] = [];
  return { calls, client: { from: () => ({ insert: async (rows: unknown) => { calls.push(rows); return results.shift() ?? { error: null }; } }) } };
};
const row = (player_id: string) => ({ session_id: "s", player_id, status: "waiting" as const });
it("one call when nothing clashes", async () => {
  const f = fake([{ error: null }]);
  expect(await insertQueueEntries(f.client, [row("a"), row("b")])).toEqual({ inserted: 2, skipped: 0 });
  expect(f.calls).toHaveLength(1);
});
it("row by row after a clash, skipping players already in line", async () => {
  const f = fake([{ error: { code: "23505", message: "dup" } }, { error: null }, { error: { code: "23505", message: "dup" } }]);
  expect(await insertQueueEntries(f.client, [row("a"), row("b")])).toEqual({ inserted: 1, skipped: 1 });
  expect(f.calls).toHaveLength(3);
});
it("returns other errors", async () =>
  expect(await insertQueueEntries(fake([{ error: { code: "42501", message: "denied" } }]).client, [row("a")]))
    .toEqual({ inserted: 0, skipped: 0, error: "denied" }));
it("no rows, no call", async () => {
  const f = fake([]);
  expect(await insertQueueEntries(f.client, [])).toEqual({ inserted: 0, skipped: 0 });
  expect(f.calls).toHaveLength(0);
});
it("join times 1 ms apart", () =>
  expect(staggeredJoinTimes(3, new Date("2026-11-17T10:00:00.000Z")))
    .toEqual(["2026-11-17T10:00:00.000Z", "2026-11-17T10:00:00.001Z", "2026-11-17T10:00:00.002Z"]));

// lineRetry.test.ts
it("retries once, then returns the second result", async () => {
  let n = 0;
  expect(await withLineRetry(async () => ++n, (r) => r < 5)).toBe(2);
});
it("stops as soon as no retry is needed", async () => {
  let n = 0;
  expect(await withLineRetry(async () => ++n, () => false)).toBe(1);
});
```

- [ ] **Step 2: Run to see them fail** — `npx vitest run src/features/matches/gameStateErrors.test.ts src/features/queue/insertQueueEntries.test.ts src/features/queue/utils/lineRetry.test.ts` → FAIL (modules missing).
- [ ] **Step 3: Implement the four modules.**
- [ ] **Step 4: Run again** → PASS; `npx tsc --noEmit` clean.
- [ ] **Step 5: Commit** — `git commit -m "feat(queue): shared status list, game-state error codes, safe queue inserts, line retry"`

---

### Task 7: Start and swap through the procedures

**Files:**
- Modify: `src/features/queue/api/queueActions.ts` — `callNextUp` (592–783), `swapNoShow` (903–1009)
- Modify: `src/features/matches/api/matchActions.ts` — `createMatch` (18–85)

**Interfaces:**
- Consumes: `start_match`, `swap_match_player`, `gameStateErrorMessage`, `withLineRetry`, `NO_SHOW_WINDOW_MINUTES`.
- Produces: unchanged signatures and return shapes (`callNextUp → { success, count, matchId } | { error, hold? }`; `createMatch → { success, matchId } | { error }`, `params.format` ignored; `swapNoShow → { success, replacementName } | { error }`).

- [ ] **Step 1: `callNextUp`** — keep the admin guard, session read and early "Start the session…" return, history/courts load, line read, `decide()` and hold messages. Wrap *line read → decide → `rpc("start_match", { …, p_from_queue: true })`* in `withLineRetry(…, (r) => r.code === "line_changed")`. Delete the court pre-check, claim, rollback, abandon, insert and court-link code. Errors → `gameStateErrorMessage(code)`; rpc transport errors → `gameStateErrorMessage(undefined)`. Court name is read only for the `game_started` event.
- [ ] **Step 2: `createMatch`** — same rpc with `p_from_queue: false`.
- [ ] **Step 3: `swapNoShow`** — keep the admin guard; call `rpc("swap_match_player", { p_match_id, p_out, p_window_minutes: NO_SHOW_WINDOW_MINUTES })`; read the replacement's name and the court for the event and reply. `canSwapNoShow` stays (the court card uses it to show the button); `pickReplacement`/`claimFirstAvailable` and their tests are deleted if nothing else imports them (`grep` first).
- [ ] **Step 4: Verify** — `npx tsc --noEmit`, `npm test` → pass.
- [ ] **Step 5: Verify in the app** — `preview_start`, admin, casual test session with ≥ 8 in line: Call next on Court 1 → game; again on Court 1 → "already has a game"; Maintenance court → "closed"; manual match with a Court-1 player → "already in a game on another court"; no-show swap → replacement on court, no-show on break at the back. End the session.
- [ ] **Step 6: Commit** — `git commit -m "fix(courts): start and swap games through the database so nothing is double-booked"`

---

### Task 8: Finish through `finish_match`

**Files:**
- Modify: `src/features/matches/api/matchActions.ts` — `finalizeMatch` (114–247); delete `requeueMatchPlayers` (249–313)
- Delete: `src/features/queue/utils/requeue.ts`, `src/features/queue/requeue.test.ts` (its cases now live in Task 3's SQL test)

**Interfaces:**
- Consumes: `finish_match`, `gameStateErrorMessage`.
- Produces: unchanged `finalizeMatch` return shape `{ success, autoFilled, autoFillMessage } | { error }`.

- [ ] **Step 1:** Replace the `record_match_result` rpc with `finish_match` (same arguments). Expected errors → `gameStateErrorMessage`; transport error → keep `"The game couldn't be saved. Nothing was changed; please try again."`. Use the returned `session_id`/`court_id`; autofill (`callNextUp`) runs only when the session is active, as today. Remove the `requeueMatchPlayers` call and function.
- [ ] **Step 2: Verify** — `npx tsc --noEmit`, `npm test` → pass (requeue tests removed).
- [ ] **Step 3: Verify in the app** — finish a game with autofill on: its four players appear at the back in court order and the next group is on court; with autofill off the court stays open.
- [ ] **Step 4: Commit** — `git commit -m "fix(matches): save a result and requeue its players in one transaction"`

---

### Task 9: Duplicate-safe queue writes and one status list

**Files:**
- Modify: `src/features/queue/api/queueActions.ts` — lines 42, 139, 174, 273, 332, 856; `joinQueue`, `bulkAddPlayersToQueue`
- Modify: `src/features/sessions/api/sessionActions.ts` — lines 375, 497, 552; `buildStartingLine`, `checkInToSession`
- Modify: `src/features/admin/api/adminActions.ts` — lines 288, 592
- Modify: `src/features/queue/hooks/useLiveQueue.ts` — line 8

**Interfaces:**
- Consumes: `LINE_STATUSES`, `isInLine`, `insertQueueEntries`, `staggeredJoinTimes`.

- [ ] **Step 1:** Replace every `.not("status", "in", "(playing,left)")` / `(left,playing)` with `.in("status", LINE_STATUSES)`; `useLiveQueue`'s `inLine` uses `isInLine`. `.neq("status", "left")` stays (it is the "active" definition).
- [ ] **Step 2:** `joinQueue`, `checkInToSession`: delete the `.maybeSingle()` existence checks; insert through `insertQueueEntries` (a skip is success). `bulkAddPlayersToQueue`: keep the pre-filter (it drives "already queued"), insert with `staggeredJoinTimes`, report `count: inserted`. `buildStartingLine`: insert `plan.add` through `insertQueueEntries`.
- [ ] **Step 3: Verify** — `npx tsc --noEmit`, `npm test`; `grep -rn "(playing,left)\|(left,playing)" src` → nothing.
- [ ] **Step 4: Verify in the app** — double-click Join quickly → `execute_sql` shows one active entry for that player; bulk add 3 → they appear in the picked order.
- [ ] **Step 5: Commit** — `git commit -m "fix(queue): duplicate-safe joins and one shared in-line status list"`

---

### Task 10: Close sessions through `close_session`; no app writes to court occupancy

**Files:**
- Modify: `src/features/sessions/api/sessionActions.ts` — `updateSessionStatus`
- Modify: `src/features/admin/api/adminActions.ts` — `cancelSession` (526–553)

- [ ] **Step 1:** `updateSessionStatus`: `completed`/`cancelled` → `rpc("close_session", …)`, returning `{ error: gameStateErrorMessage(code) }` before revalidating on failure. `active`: for each other `active` session, `close_session(id, "completed")` and a `session_ended` event; delete the bulk status update and the "free all courts" update. `cancelSession`: body becomes `close_session(sessionId, "cancelled")` + revalidation.
- [ ] **Step 2: Verify** — `npx tsc --noEmit`, `npm test`; `grep -rn "current_match_id: null\|status: \"occupied\"" src/features --include=*.ts` → only `setRentedCourtCount`'s new-court insert (`status: "available"` for brand-new rows is fine) and none freeing courts.
- [ ] **Step 3: Verify in the app** — with a live test session and a scheduled one: cancel the scheduled one → the live courts keep their games; end the live one → courts free, line empty, unfinished game `abandoned`; start a second session while one has a game in progress → that game `abandoned`, its line `left`.
- [ ] **Step 4: Commit** — `git commit -m "fix(sessions): end, cancel and start close only the right session"`

---

### Task 11: Small guards

**Files:**
- Modify: `src/app/(app)/courts/[id]/monitor/page.tsx` — `activeSession`
- Modify: `src/features/courts/api/courtActions.ts` — `updateCourtStatus`

- [ ] **Step 1:** Monitor page: `sessions.find((s) => s.status === "active")` with no `|| sessions[0]`.
- [ ] **Step 2:** `updateCourtStatus(courtId, status)`: `requireAdminUser()` first; accept only `available | maintenance | reserved` (else `{ error: "Courts can only be opened, closed or reserved here." }`); refuse with `gameStateErrorMessage("court_busy")` when the court has an `in_progress` match.
- [ ] **Step 3: Verify** — `npx tsc --noEmit`, `npm test`; with no live session, `/courts/<id>/monitor` Call next shows the no-active-session message.
- [ ] **Step 4: Commit** — `git commit -m "fix(courts): monitor uses only the live session; court status is admin-only and can't free a live court"`

---

### Task 12: Hand-off and deploy

- [ ] **Step 1:** `npm run lint`, `npx tsc --noEmit`, `npm test` → all pass; the four SQL tests → `ALL TESTS PASSED`.
- [ ] **Step 2:** Give the user `git push -u origin fix/queue-integrity`, offer the PR, and note in its description: migrations are already on production; deploy this branch the same day; rollback = revert the deploy, then run `supabase/rollback/20261117_game_state_down.sql` (with approval).
