# Pickleball Desk — offline Android tablet app

Date: 2026-10-21
Status: design approved in chat; awaiting spec review

## Purpose

One admin runs open play from an Android tablet at the venue with no internet. No logins, no player
accounts, no server. The app queues players onto courts, records results, and keeps a record the admin
can export. It is a separate tool from the online system and never talks to Supabase.

Success means an admin can run a whole evening with Wi-Fi off, and nothing is lost if the tablet sleeps,
the app is closed, or the battery dies.

## Decisions made with the user

- Delivery: a real Android app (signed APK), not a home-screen web app.
- Online link: none. Standalone, with Excel export and a full backup file.
- Players: a saved roster that persists between sessions, each with a DUPR-style skill (2.0–5.0, 0.5 steps).
- Matchmaking: the same 10 modes as the online system, chosen per session.
- Results: the same per-session "Track scores" toggle as the web app (scores, or winner only).
- Tablet: Android only.

## 1. Build and install

- New folder `tablet/` in this repo: a Vite + React + TypeScript app styled with Tailwind 4, wrapped with
  Capacitor for Android. Its web assets are bundled inside the APK, so it needs no web address and no
  internet, including on first launch.
- It imports the shared rule code from `src/features/**/utils` through a path alias. It must not import
  Supabase, Next.js, server actions or anything under `src/lib/supabase`.
- Storage: IndexedDB inside the app's private WebView storage (via Dexie). Android does not evict this; it
  is removed only by "Clear data" or uninstall.
- App name "Pickleball Desk", app id `com.pickleball.desk`, the existing pickleball icon, landscape-first,
  screen kept awake while a session is live.
- Release: a signed APK built on this PC (Android Studio, SDK and JDK 21 are installed). The signing
  keystore is created once, stored outside git (path recorded in `tablet/README.md`, keystore and
  passwords in a git-ignored `tablet/android/keystore.properties`), and the user is told to back it up.
  Every update must use the same key so it installs over the old version and keeps the data.
- Install: the user copies the APK to the tablet (USB, Drive, chat) and allows installs from that source.

## 2. Data and screens

### Stored data (Dexie tables)

- `players`: id, name, skill (2.0–5.0), note?, archived, createdAt.
- `sessions`: id, title, date, courts (array of { id, name, closed }), matchingStyle, trackScores,
  targetScore, winBy2, status (`setup` | `live` | `ended`), startedAt?, endedAt?.
- `queueEntries`: id, sessionId, playerId, position, status (`waiting` | `playing` | `on_break` | `left`),
  joinedAt, gamesPlayed.
- `games`: id, sessionId, courtId, teamA [id, id], teamB [id, id], scoreA?, scoreB?, winner (`A` | `B` | null),
  startedAt, endedAt?, correctedAt?.
- `meta`: lastBackupAt.

No accounts, RSVPs, rating history or activity feed.

### Screens

1. **Home**: the live session if any, New session, past sessions, links to Roster and Backup, and a
   "Last backup: N days ago" line when the last backup is over 14 days old.
2. **Roster**: search, add, edit name and skill, archive or unarchive. Delete only for players with no
   games (asks first).
3. **New session**: title, date, number of courts and their names, matchmaking mode, Track scores,
   target score, win-by-2. Same defaults as the web app. Start makes it live.
4. **Live board**: court cards (top-down court look) and the queue.
   - Check in players from the roster, or Add walk-in (name + skill, saved to the roster).
   - A free court shows the four that matchmaking suggests. Start game confirms; tapping a name swaps in
     someone else from the waiting line.
   - Finish game: tap Team 1 or Team 2 wins, or enter scores validated by the scoring rule. Players are
     re-queued and the court refills automatically, as in the web console.
   - Queue actions: move up/down, take a break and come back, gone home, close/reopen a court.
   - Fix result on any game in the session.
   - End session (asks first).
5. **Session summary**: leaderboard (wins, losses, points for/against), all games, Export to Excel.

## 3. Shared rules and safety

### Code sharing

- `src/features/queue/utils/matchingEngine.ts`: replace the `Profile` import with a minimal
  `MatchPlayer` type (`id`, display name fields, `skill_rating`) that `Profile` already satisfies. No
  behaviour change.
- Extract the pod selection now inline in `callNextUp` (`src/features/queue/api/queueActions.ts`):
  winners-stay / king-of-the-court handling, skill-separated anchoring, FIFO and bonded-pair protection,
  into a pure `selectPod` in `src/features/queue/utils/podSelection.ts`. `callNextUp` calls it, so online
  behaviour is unchanged, and the tablet uses the same function. Add tests for it.
- Reused as-is: `scoring.ts`, `requeue.ts`, `sessionLeaderboard.ts`.
- Tablet-only logic lives in `tablet/src/engine/` as pure functions over session state:
  `suggestGame`, `startGame`, `finishGame`, `correctResult`, `refillCourts`, `moveInQueue`, `setBreak`,
  `markLeft`, `undo`. Screens call these and save the result; they hold no rules themselves.

### Safety

- Each action is one Dexie transaction: finishing a game writes the result, re-queues the players and
  refills the court together or not at all.
- Undo bar for about 10 seconds after finishing a game, removing someone, or ending a break. It restores
  the snapshot taken before the action.
- Confirmations only for End session, Delete player and Restore backup.
- A court never starts with fewer than four; it shows "Waiting for players".
- A player who is playing is never suggested for another court.
- Reopening the app returns to the live board exactly as it was.

## 4. Export, backup, testing

- **Export**: `Pickleball – <title> – <date>.xlsx` with sheets Leaderboard and Games, built with the
  repo's `xlsx` library, written with Capacitor Filesystem and handed to the Android share sheet.
- **Backup**: one JSON file (`pickleball-desk-backup-YYYY-MM-DD.json`) holding every table plus a format
  version, shared the same way. **Restore** validates the file (zod), warns that it replaces all data,
  then replaces it in one transaction. `lastBackupAt` updates on save.
- **Tests (Vitest)**: `selectPod` and `matchingEngine` across all 10 modes; every `tablet/src/engine`
  function (finish and re-queue, refill, breaks, leaving, fix result, undo); export rows; backup
  round-trip and rejection of a bad file. Existing online tests must still pass.
- **Manual check**: run the tablet app in the built-in browser at tablet size and play one evening
  (roster → session → several games on 3 courts → fix a result → end → export). Build the signed APK and
  install it on an Android emulator. The user tests on the real tablet with a short checklist.

## Out of scope

Syncing with the online system, ratings that change over time, player phones or accounts, bonded
doubles pairs on the tablet, iPad, Play Store.
