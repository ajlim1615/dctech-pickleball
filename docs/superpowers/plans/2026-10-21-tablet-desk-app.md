# Pickleball Desk (offline Android tablet app) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A signed Android APK that lets one admin run open play offline: roster, sessions, matchmaking onto courts, results, export and backup.

**Architecture:** A Vite + React app in `tablet/`, wrapped with Capacitor. Rules live in pure functions: shared ones in `src/features/**/utils` (made Supabase-free) and tablet-only ones in `tablet/src/engine/`, which transform an immutable `SessionState`. Screens call the engine, then persist the result to IndexedDB (Dexie) in one transaction.

**Tech Stack:** Vite 7, React 19, TypeScript 5, Tailwind 4, Dexie 4, Capacitor 7 (core, android, filesystem, share, `@capacitor-community/keep-awake`), xlsx (already in the repo), zod 4, lucide-react, Vitest 4 (root config) with `fake-indexeddb`.

**Spec:** `docs/superpowers/specs/2026-10-21-tablet-desk-app-design.md`

## Global Constraints

- The tablet app must not import Supabase, Next.js, server actions or anything under `src/lib/supabase`. It may import only from `src/features/**/utils`.
- App name "Pickleball Desk", app id `com.pickleball.desk`, landscape-first, screen kept awake while a session is live.
- Skill is 2.0–5.0 in 0.5 steps; default 3.0.
- Scoring defaults match the web app: target 11, win-by-2 on, Track scores on.
- All 10 matching styles from `MatchingStyle`; default `balanced`.
- A court never starts with fewer than 4 players. A playing player is never put on a second court.
- Every engine action that changes state is persisted in one Dexie transaction.
- Undo is offered for about 10 seconds after finish game, gone home, and end of a break.
- Confirmations only for End session, Delete player and Restore backup.
- Backup reminder when the last backup is over 14 days old.
- Export file name: `Pickleball – <title> – <yyyy-MM-dd>.xlsx`, sheets `Leaderboard` and `Games`. Backup file name: `pickleball-desk-backup-<yyyy-MM-dd>.json`.
- The signing keystore and its passwords never go in git.
- UI conventions from the web app: Geist sans, sentence case, `font-mono tabular-nums` only for numbers, 44px touch targets, volt `#d4e938` for the one primary action per area, emerald for Team 1, sky for Team 2.
- The existing online test suite and `next build` must keep passing.

## Review Focus

- **Restore of a corrupt, foreign or newer-version file.** It must be rejected with a message, and the existing data left untouched. Test in Task 6.
- **Fix result that flips the winner on a winners-stay court.** It must not change who is waiting or playing, only the game record and the leaderboard. Test in Task 3.
- **A player marked gone home or on a break while their game is in progress.** They stay in that game. When it finishes they are not re-queued (gone home) or wait out the break (break). Test in Task 4.
- **Closing a court that has a game running.** The game keeps going, and the court is not refilled after it finishes. Test in Task 4.
- **The app is killed between engine and save.** On reopen, the state is the last saved state, never a half-applied one. This is covered by the single transaction in `saveSessionState`. Test in Task 5 that a failed write leaves the previous rows intact.

---

## File Structure

Root (shared, changed):

- `src/features/queue/utils/matchingEngine.ts`: generic over `MatchPlayer` instead of `Profile`.
- `src/features/queue/utils/podSelection.ts` (new): `selectPod` and `buildTeams`, extracted from `callNextUp`.
- `src/features/queue/api/queueActions.ts`: `callNextUp` calls the extracted functions.
- `tsconfig.json`, `eslint.config.mjs`: ignore `tablet/`.
- `vitest.config.ts`: also resolves tablet test imports.

`tablet/` (new):

- `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `capacitor.config.ts`, `README.md`, `android/` (generated).
- `src/main.tsx`, `src/App.tsx` (screen switcher), `src/styles.css`.
- `src/engine/types.ts`: `DeskPlayer`, `DeskSession`, `DeskQueueEntry`, `DeskGame`, `SessionState`, `EngineCtx`.
- `src/engine/game.ts`: check-in, suggest, start, finish, correct and refill.
- `src/engine/queue.ts`: move, break, gone home, swap, close court and end.
- `src/engine/leaderboard.ts`: adapter to `computeSessionLeaderboard`.
- `src/db/db.ts`: Dexie schema.
- `src/db/repo.ts`: load and save `SessionState`, roster CRUD, and the undo snapshot.
- `src/io/export.ts`: workbook rows and file.
- `src/io/backup.ts`: serialize, parse and restore.
- `src/io/native.ts`: Capacitor share and keep-awake wrappers with web fallbacks.
- `src/screens/Home.tsx`, `Roster.tsx`, `NewSession.tsx`, `LiveBoard.tsx`, `Summary.tsx`, `Backup.tsx`.
- `src/components/CourtCard.tsx`, `QueueList.tsx`, `PlayerPicker.tsx`, `ResultSheet.tsx`, `UndoBar.tsx`, `ConfirmDialog.tsx`.
- Tests next to their modules: `*.test.ts`.

---

### Task 1: Make matchmaking shareable (`MatchPlayer`, `selectPod`, `buildTeams`)

**Files:**
- Modify: `src/features/queue/utils/matchingEngine.ts`
- Create: `src/features/queue/utils/podSelection.ts`
- Modify: `src/features/queue/api/queueActions.ts` (`callNextUp`, about lines 520–720)
- Test: `src/features/queue/podSelection.test.ts`

**Interfaces:**
- Produces:
  - In `matchingEngine.ts`:
    - `export interface MatchPlayer { id: string; skill_rating?: number | null; full_name?: string | null; display_name?: string | null }`
    - `createMatchupFromPod<P extends MatchPlayer>(players: P[], style?, previousWinners?: P[], opts?): TeamMatchup<P>`
    - `previewMatchupFromPod<P extends MatchPlayer>(...)`
    - `TeamMatchup<P extends MatchPlayer = MatchPlayer>`
  - In `podSelection.ts`:
    - `export interface PodEntry<P extends MatchPlayer> { id: string; player_id: string; group_id?: string | null; player: P }`
    - `export function selectPod<E extends PodEntry<MatchPlayer>>(waiting: E[], style: MatchingStyle, previousWinnerIds: string[], count?: number): { challengers: E[]; stayingWinners: E[] } | { error: string; needed: number; available: number }`
      - `waiting` is in queue order.
      - `count` defaults to 4.
    - `export function buildTeams<P extends MatchPlayer>(challengers: PodEntry<P>[], stayingWinners: PodEntry<P>[], style: MatchingStyle, random?: () => number): { teamA: string[]; teamB: string[] }`

- [ ] **Step 1: Write failing tests** in `podSelection.test.ts`, using players built with `{ id, skill_rating }` only.
  - `selectPod fifo takes first four`: 6 waiting → challenger ids `[w1..w4]`, `stayingWinners` `[]`.
  - `selectPod winners_stay keeps both previous winners and calls two challengers`: waiting `[w1, w2, A, B, w3]`, previousWinnerIds `[A, B]` → challengers `[w1, w2]`, stayingWinners `[A, B]`.
  - `selectPod winners_stay falls back to four when a winner left`: only A of `[A, B]` waiting → 4 challengers.
  - `selectPod skill_separated anchors first in line and picks closest skill`: anchor 4.0, others `[2.0, 3.9, 4.1, 2.5, 4.0]` → challengers anchor + the three closest to 4.0.
  - `selectPod keeps a bonded pair together`: 4th entry has group `g`, partner at index 5 → partner replaces the first solo.
  - `selectPod reports shortage`: 3 waiting → `{ error, needed: 4, available: 3 }`.
  - `buildTeams puts a bonded pair on one team`.
  - `buildTeams splits staying winners`: teamA and teamB each contain exactly one winner.
- [ ] **Step 2: Run** `npx vitest run src/features/queue/podSelection.test.ts`. Expected: FAIL, module not found.
- [ ] **Step 3: Implement.**
  - Swap `Profile` for the generic `MatchPlayer` in `matchingEngine.ts`.
  - Move the selection block (winners-stay detection, skill-separated anchoring, bonded-pair protection) and the team block (paired group, then `createMatchupFromPod`, then 2- or 3-player fallbacks) from `callNextUp` into `selectPod` and `buildTeams`, unchanged in behaviour.
  - `callNextUp` maps its rows to `PodEntry` (`player: e.player as Profile`) and calls both. Its error message for a shortage stays `Need ${needed} waiting players to start a game (only ${available} in queue).`
- [ ] **Step 4: Run** `npx vitest run` and `npx tsc --noEmit`. Expected: all tests pass, including the existing `matchingEngine` and `matchupPreview` tests, and no type errors.
- [ ] **Step 5: Commit** with `refactor(queue): extract pure pod selection shared with the tablet app`.

### Task 2: Scaffold the tablet app and Android project

**Files:**
- Create: `tablet/package.json`, `tablet/vite.config.ts`, `tablet/tsconfig.json`, `tablet/index.html`, `tablet/capacitor.config.ts`, `tablet/src/main.tsx`, `tablet/src/App.tsx`, `tablet/src/styles.css`, `tablet/.gitignore`, `tablet/README.md`
- Generate: `tablet/android/` (via `npx cap add android`)
- Modify: root `tsconfig.json` (`"exclude": ["node_modules", "tablet"]`), `eslint.config.mjs` (`globalIgnores` gains `"tablet/**"`), `vitest.config.ts`
- Test: `tablet/src/shared-imports.test.ts`

**Interfaces:**
- Produces:
  - The alias `@` → `../src` in `tablet/vite.config.ts` and `tablet/tsconfig.json`, so tablet code imports shared rules as `@/features/...`.
  - The scripts `dev`, `build` (`tsc -b && vite build`), `cap:sync` (`cap sync android`) and `apk:debug` (`cd android && gradlew assembleDebug`).

- [ ] **Step 1: Create the Vite React TS app and install dependencies.**
  - Create the app in `tablet/` by hand. No template that pulls extra files.
  - Install `react`, `react-dom`, `dexie`, `zod`, `xlsx`, `lucide-react`, `clsx`, `geist`, `@capacitor/core`, `@capacitor/filesystem`, `@capacitor/share` and `@capacitor-community/keep-awake`.
  - Dev dependencies: `vite`, `@vitejs/plugin-react`, `tailwindcss`, `@tailwindcss/vite`, `typescript`, `@capacitor/cli`, `@capacitor/android` and `fake-indexeddb`.
- [ ] **Step 2: Copy the theme.**
  - `styles.css` imports Tailwind and copies the colour tokens (`--court-lime` and the team colours) from `src/app/globals.css`.
  - Load the Geist font from the `geist` npm package so it works offline.
- [ ] **Step 3: Write the failing test** `tablet/src/shared-imports.test.ts`. It imports `getWinner` from `@/features/matches/utils/scoring` and `selectPod` from `@/features/queue/utils/podSelection`, and asserts `getWinner(11, 9, { targetPoints: 11, winByTwo: true })` is `"A"`.
- [ ] **Step 4: Run** `npx vitest run tablet/src/shared-imports.test.ts` from the repo root. Expected: PASS. The root `@` alias already resolves. This test guards that shared rules stay importable without Supabase.
- [ ] **Step 5: Configure Capacitor.**
  - `capacitor.config.ts`: `appId: "com.pickleball.desk"`, `appName: "Pickleball Desk"`, `webDir: "dist"`.
  - Run `npm run build && npx cap add android`.
  - In `android/app/src/main/AndroidManifest.xml`, set `android:screenOrientation="sensorLandscape"` on the main activity.
  - Copy `public/icon-512.png` as the launcher icon, using Android Studio's Image Asset tool or by replacing the `mipmap-*` PNGs.
- [ ] **Step 6: Verify.**
  - `npm run build` in `tablet/` exits 0.
  - `npm run apk:debug` produces `android/app/build/outputs/apk/debug/app-debug.apk`.
  - Root `npx tsc --noEmit` and `npm run lint` show no new errors.
- [ ] **Step 7: Commit** with `feat(tablet): scaffold Vite + Capacitor Android app`.
  - `tablet/.gitignore` covers `node_modules`, `dist`, `android/app/build`, `android/.gradle`, `android/keystore.properties` and `*.jks`.

### Task 3: Engine types and the game cycle

**Files:**
- Create: `tablet/src/engine/types.ts`, `tablet/src/engine/game.ts`, `tablet/src/engine/leaderboard.ts`
- Test: `tablet/src/engine/game.test.ts`

**Interfaces:**
- Produces (`types.ts`):
  - `DeskPlayer { id; name; skill: number; note?: string; archived: boolean; createdAt: string }`. It is adapted to `MatchPlayer` as `{ id, skill_rating: skill, display_name: name }` by `toMatchPlayer(p)`.
  - `DeskCourt { id; name; closed: boolean }`
  - `DeskSession { id; title; date; courts: DeskCourt[]; matchingStyle: MatchingStyle; trackScores: boolean; targetScore: number; winBy2: boolean; status: "setup" | "live" | "ended"; startedAt?; endedAt? }`
  - `DeskQueueEntry { id; sessionId; playerId; position: number; status: "waiting" | "playing" | "on_break" | "left"; joinedAt; gamesPlayed: number; leaveAfterGame?: boolean; breakAfterGame?: boolean }`
  - `DeskGame { id; sessionId; courtId; teamA: [string, string]; teamB: [string, string]; scoreA?: number; scoreB?: number; winner: "A" | "B" | null; startedAt; endedAt?; correctedAt? }`
  - `SessionState { session: DeskSession; queue: DeskQueueEntry[]; games: DeskGame[]; players: Record<string, DeskPlayer> }`
  - `EngineCtx { now: string; newId: () => string; random?: () => number }`
  - `GameResult = { winner: "A" | "B" } | { scoreA: number; scoreB: number }`
  - `EngineError = { error: string }`
- Produces (`game.ts`; each returns a new `SessionState`, or `EngineError` where noted):
  - `checkIn(state, playerIds: string[], ctx)` appends waiting entries at the back and skips anyone already waiting or playing. A `left` entry becomes waiting at the back.
  - `suggestGame(state, courtId, random?)` returns `{ teamA: string[]; teamB: string[] } | { waitingFor: number }`.
    - It uses `selectPod` and `buildTeams`, with previous winners taken from the last finished game on that court.
  - `startGame(state, courtId, teams, ctx)`, or `EngineError` if the court is busy or closed, or any player isn't waiting.
  - `finishGame(state, gameId, result: GameResult, ctx)`, or `EngineError` for a score `getWinner` rejects.
    - It records the result (`resultOnlyScore` when `trackScores` is false) and increments `gamesPlayed`.
    - It re-queues via `selectPlayersToRequeue`: a player with `leaveAfterGame` becomes `left`, and one with `breakAfterGame` becomes `on_break`.
    - Then it runs `refillCourts`.
  - `correctResult(state, gameId, result, ctx)` changes only that game and sets `correctedAt`.
  - `refillCourts(state, ctx)` starts the suggested game on every open, free court that has at least 4 waiting.
- Produces (`leaderboard.ts`): `sessionLeaderboard(state): SessionRankedPlayer[]`, adapting games to the `computeSessionLeaderboard` match shape (`status: "completed"`, `team_a_score`, `winning_team: "team_a" | "team_b"`, `players: [{ team, player }]`).

- [ ] **Step 1: Write failing tests** in `game.test.ts`. Use a fixture builder for a 2-court live session with 9 players, plus `ctx` with a counter-based `newId` and `random: seededRandom("t")`.
  - `checkIn twice does not duplicate`.
  - `suggestGame with 3 waiting returns waitingFor 1`.
  - `startGame refuses a player already playing`.
  - `finishGame win-by-2 rejects 11-10`.
  - `finishGame first-to-11 accepts 11-10`.
  - `finishGame with trackScores off stores 1-0`.
  - `finishGame re-queues the four at the back and refills the court`: the court has a new game, made of the next 4 in line.
  - `finishGame winners_stay keeps both winners on the court`.
  - `refillCourts never puts one player on two courts`: 8 waiting, 2 free courts, 8 distinct ids.
  - `correctResult flips the winner without changing queue or courts` (Review Focus). Queue and active games are deep-equal before and after.
  - `sessionLeaderboard counts wins and losses after a correction`.
- [ ] **Step 2: Run** `npx vitest run tablet/src/engine/game.test.ts`. Expected: FAIL, module not found.
- [ ] **Step 3: Implement** `types.ts`, `game.ts` and `leaderboard.ts` per the Interfaces. Positions are integers; new entries take `max(position) + 1`.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** with `feat(tablet): game cycle engine`.

### Task 4: Engine queue actions

**Files:**
- Create: `tablet/src/engine/queue.ts`
- Test: `tablet/src/engine/queue.test.ts`

**Interfaces:**
- Consumes: the types and `refillCourts` from Task 3.
- Produces. Each returns `SessionState | EngineError`:
  - `moveInQueue(state, entryId, toIndex: number)`: reorders the waiting entries only.
  - `setBreak(state, playerId, onBreak: boolean, ctx)`. A playing player gets `breakAfterGame`. Ending a break puts them at the back of the line and runs `refillCourts`.
  - `markLeft(state, playerId, ctx)`. A playing player gets `leaveAfterGame`; anyone else becomes `left`.
  - `swapPlayerInGame(state, gameId, outId, inId, ctx)`. Only for an unfinished game, and only with a waiting `inId`. `outId` returns to the front of the line.
  - `setCourtClosed(state, courtId, closed: boolean, ctx)`. Closing never touches a running game. Reopening runs `refillCourts`.
  - `endSession(state, ctx)`. Status becomes `ended` and unfinished games are kept with `winner: null`.

- [ ] **Step 1: Write failing tests:**
  - `moveInQueue moves a waiting player to index 0`.
  - `setBreak on a playing player defers until their game finishes` (Review Focus). After `finishGame` they are `on_break`, not waiting.
  - `markLeft on a playing player keeps them in the game and does not re-queue them` (Review Focus).
  - `ending a break puts the player at the back and fills a free court`.
  - `swapPlayerInGame refuses a finished game`.
  - `swap returns the swapped-out player to the front`.
  - `closing a court with a game running keeps the game and skips refill after it finishes` (Review Focus).
  - `endSession keeps unfinished games without a winner`.
- [ ] **Step 2: Run** `npx vitest run tablet/src/engine/queue.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `queue.ts`. Make `finishGame` in `game.ts` honour `breakAfterGame` and `leaveAfterGame`, and make `refillCourts` skip closed courts.
- [ ] **Step 4: Run** `npx vitest run tablet/src/engine`. Expected: PASS.
- [ ] **Step 5: Commit** with `feat(tablet): queue actions engine`.

### Task 5: Storage and undo

**Files:**
- Create: `tablet/src/db/db.ts`, `tablet/src/db/repo.ts`
- Test: `tablet/src/db/repo.test.ts` (starts with `import "fake-indexeddb/auto"`)

**Interfaces:**
- Produces:
  - `db.ts`: Dexie database `pickleball-desk` (version 1) with these stores:
    - `players: "id, name, archived"`
    - `sessions: "id, status, date"`
    - `queueEntries: "id, sessionId, playerId"`
    - `games: "id, sessionId, courtId"`
    - `meta: "key"`
  - `repo.ts`:
    - `loadSessionState(sessionId): Promise<SessionState>`
    - `saveSessionState(next: SessionState): Promise<void>`. One `rw` transaction over sessions, queueEntries and games. It replaces that session's rows, and players added as walk-ins.
    - `getLiveSession(): Promise<DeskSession | undefined>`
    - `listSessions(): Promise<DeskSession[]>`, newest first.
    - `listPlayers({ includeArchived }): Promise<DeskPlayer[]>`
    - `upsertPlayer(p: DeskPlayer)`
    - `deletePlayer(id): Promise<EngineError | void>`, refused when the player has any game.
    - `createSession(s: DeskSession)`
    - `getMeta(key)` and `setMeta(key, value)`
    - `class UndoStack { push(label: string, before: SessionState): void; peek(): { label; before; at: number } | undefined; take(): SessionState | undefined }`. In memory only; it holds one entry, and `peek` returns undefined after 10 s.

- [ ] **Step 1: Write failing tests:**
  - `save then load round-trips a session state`.
  - `deletePlayer refuses a player with games`.
  - `getLiveSession returns the live one`.
  - `a failed save leaves the previous rows intact` (Review Focus). Make the transaction throw midway, for example by passing a game with an invalid key, then assert the loaded state equals the previous one.
  - `UndoStack expires after 10 s` (use `vi.useFakeTimers`).
- [ ] **Step 2: Run** `npx vitest run tablet/src/db`. Expected: FAIL.
- [ ] **Step 3: Implement** `db.ts` and `repo.ts`.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** with `feat(tablet): local storage and undo`.

### Task 6: Export and backup

**Files:**
- Create: `tablet/src/io/export.ts`, `tablet/src/io/backup.ts`, `tablet/src/io/native.ts`
- Test: `tablet/src/io/export.test.ts`, `tablet/src/io/backup.test.ts`

**Interfaces:**
- Produces:
  - `export.ts`:
    - `exportRows(state): { leaderboard: (string | number)[][]; games: (string | number)[][] }`
      - Leaderboard header: `Rank, Player, Played, Won, Lost, Points for, Points against, Diff`. When `trackScores` is false, the three points columns are left out.
      - Games header: `#, Court, Team 1, Team 2, Score, Winner, Started, Ended`. Score shows `formatMatchScore`, or `Win/loss only`.
    - `exportFileName(session): string`
    - `buildWorkbook(state): Uint8Array`
  - `backup.ts`:
    - `BACKUP_FORMAT = 1`
    - `serializeBackup(): Promise<string>`, with `{ format, app: "pickleball-desk", exportedAt, players, sessions, queueEntries, games }`.
    - `parseBackup(text): { ok: true; data } | { ok: false; reason: string }`, validated with a zod schema. It rejects another `app`, a `format` greater than `BACKUP_FORMAT`, and invalid JSON.
    - `restoreBackup(data): Promise<void>`. One transaction that clears and refills all tables.
    - `backupFileName(date)`
  - `native.ts`:
    - `shareFile(name, bytes | text, mime)`. It writes to `Directory.Cache` with Filesystem, then calls `Share.share({ url })`. On web it falls back to a download link.
    - `keepAwake(on: boolean)`. A no-op on web.

- [ ] **Step 1: Write failing tests:**
  - `exportRows drops points columns when scores are off`.
  - `exportRows lists games in order with team names`.
  - `exportFileName is "Pickleball – Tuesday open play – 2026-10-21.xlsx"`.
  - `backup round-trips through serialize, parse and restore`.
  - `parseBackup rejects invalid JSON, another app, and a newer format` (Review Focus). Each case returns `ok: false` with a reason.
  - `a rejected restore leaves existing data untouched`.
- [ ] **Step 2: Run** `npx vitest run tablet/src/io`. Expected: FAIL.
- [ ] **Step 3: Implement** the three modules.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** with `feat(tablet): Excel export and backup/restore`.

### Task 7: Home, Roster, New session and Backup screens

**Files:**
- Create: `tablet/src/App.tsx` (screen state: `{ name: "home" | "roster" | "new" | "live" | "summary" | "backup"; sessionId? }`), `tablet/src/screens/Home.tsx`, `Roster.tsx`, `NewSession.tsx`, `Backup.tsx`, `tablet/src/components/ConfirmDialog.tsx`

**Interfaces:**
- Consumes: `repo.ts` (Task 5), `backup.ts` and `native.ts` (Task 6).

- [ ] **Step 1: Build the screens.**
  - **App.** On launch, `getLiveSession()` decides between opening the live board and Home.
  - **Home.**
    - Shows a resume card for the live session, a volt **New session** button, and past sessions (tap one to open its summary).
    - Has Roster and Backup links.
    - Shows a "Last backup: N days ago" line when the last backup is over 14 days old or missing.
  - **Roster.**
    - Search by name and a "Show archived" toggle.
    - Add or edit a player: name plus skill chips from 2.0 to 5.0 in 0.5 steps.
    - Archive or unarchive, and Delete, which asks first and shows the refusal message from `deletePlayer`.
  - **New session.**
    - Title (default `Open play – <weekday>`), date, and a 1–8 court stepper with editable names.
    - A matchmaking select listing all 10 styles with the web app's labels.
    - Track scores, target score (11, 15 or 21), and win-by-2 (hidden when scores are off).
    - **Start** creates the session as live and opens the live board.
  - **Backup.** Save backup (calls `setMeta("lastBackupAt")`) and Restore, with a file input, `parseBackup`, the confirm dialog, then `restoreBackup`.
- [ ] **Step 2: Verify.**
  - `npm run build` in `tablet/` exits 0.
  - `npm run dev` and the built-in browser at 1280×800: add 3 players, archive 1, create a session, and confirm it opens the live board route.
- [ ] **Step 3: Commit** with `feat(tablet): home, roster, new session and backup screens`.

### Task 8: Live board and session summary

**Files:**
- Create: `tablet/src/screens/LiveBoard.tsx`, `tablet/src/screens/Summary.tsx`, `tablet/src/components/CourtCard.tsx`, `QueueList.tsx`, `PlayerPicker.tsx`, `ResultSheet.tsx`, `UndoBar.tsx`
- Modify: `tablet/src/App.tsx`

**Interfaces:**
- Consumes: the engine (Tasks 3–4), `repo.ts` and `UndoStack` (Task 5), and `export.ts` and `native.ts` (Task 6).
- All mutations go through one helper in `LiveBoard`: `apply(label, fn: (s) => SessionState | EngineError, undoable)`. It runs the engine, shows `error` as a toast, pushes `before` onto `UndoStack` when undoable, then calls `saveSessionState` and sets state.

- [ ] **Step 1: Build the live board.**
  - **Layout.** Courts sit in a grid on the left. The queue (waiting, then on a break) is on the right.
  - **Header.** Session title, mode, a **Check in** button, and an **End session** button that asks first.
  - **Court card.** Modelled on `src/features/courts/components/CourtCard.tsx`: a top-down court, with Team 1 in emerald and Team 2 in sky.
    - **Free court:** shows the `suggestGame` four with a volt **Start game** button. Tap a name to swap it via `PlayerPicker`. With fewer than 4 waiting, it shows "Waiting for N more players".
    - **Busy court:** a **Finish** button opens `ResultSheet` (Team 1 wins, Team 2 wins, or score entry when `trackScores` is on, with `quickWinScore` buttons). It also has a swap-a-player menu.
    - **Closed court:** greyed out, with Reopen.
  - **Queue row actions:** move up, move down, break or back, and gone home.
  - **Check in:** `PlayerPicker` with roster search and **Add walk-in** (name and skill, which also upserts the roster).
  - **Undo.** `UndoBar` shows for 10 s after finish game, gone home and end break. Undo restores and saves the snapshot.
  - **Screen awake.** `keepAwake(true)` on mount while the session is live, `false` on unmount or end.
- [ ] **Step 2: Build the summary.**
  - The leaderboard from `sessionLeaderboard`, with the points columns hidden when scores are off.
  - All games, each with **Fix result**, which opens `ResultSheet` and calls `correctResult`.
  - A volt **Export to Excel** button that calls `shareFile(exportFileName, buildWorkbook, xlsx mime)`.
  - Ending a session lands here.
- [ ] **Step 3: Verify in the built-in browser at 1280×800.**
  - Run one evening: 10 players, 3 courts, `balanced`, scores on.
  - Start, finish 5 games (one rejected 11-10 with win-by-2), undo one finish, swap a player, put someone on a break mid-game, mark one gone home, close and reopen a court, end, fix a result, export.
  - Reload the page mid-session and confirm the board is unchanged.
  - No console errors.
- [ ] **Step 4: Commit** with `feat(tablet): live board and session summary`.

### Task 9: Signed release APK

**Files:**
- Modify: `tablet/android/app/build.gradle` (a `signingConfigs.release` read from `keystore.properties`), `tablet/package.json` (script `apk:release`: `npm run build && cap sync android && cd android && gradlew assembleRelease`), `tablet/README.md`

- [ ] **Step 1: Create the keystore.**
  - Run `keytool -genkeypair -v -keystore %USERPROFILE%\.pickleball-desk\pickleball-desk.jks -alias desk -keyalg RSA -keysize 2048 -validity 10000`, outside the repo.
  - Write `tablet/android/keystore.properties` (git-ignored) with `storeFile`, `storePassword`, `keyAlias` and `keyPassword`.
  - Generate the passwords and never print them in chat.
- [ ] **Step 2: Build.** Wire the release signing in `build.gradle` and run `npm run apk:release`. Expected: `android/app/build/outputs/apk/release/app-release.apk` exists. `apksigner verify --print-certs` on it shows the `desk` certificate.
- [ ] **Step 3: Check on the emulator.**
  - Start an emulator from the installed SDK and run `adb install -r app-release.apk`.
  - Launch it, confirm it opens landscape with Home, create a player, then force-stop and relaunch: the player is still there.
  - Install the same APK again with `-r` and confirm the data survives.
- [ ] **Step 4: Write the README.**
  - Build commands and where the keystore lives, with the warning that losing it blocks updates.
  - How to install on the tablet (allow installs from the source used).
  - A real-tablet checklist: install, Wi-Fi off, run a session, export, save a backup, update over the top.
- [ ] **Step 5: Commit** with `build(tablet): signed release APK`. Make sure `git status` shows no `.jks` or `keystore.properties`.

### Task 10: Final verification

- [ ] **Step 1:** Run `npx vitest run` at the root. Expected: all tests pass (the existing 103 plus the new ones).
- [ ] **Step 2:** Run `npx tsc --noEmit`, `npm run lint` and `npm run build` at the root. Expected: no new errors compared with `52989be`.
- [ ] **Step 3:** Run `npm run build` in `tablet/` and run its type check. Expected: exit 0.
- [ ] **Step 4:** Check that the tablet code doesn't import the online-only pieces. Run `rg -n "supabase|next/|use server" tablet/src`. Expected: no matches.
