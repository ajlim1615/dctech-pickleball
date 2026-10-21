# Pickleball Desk "Clubhouse" Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle every tablet screen in the approved Clubhouse look (light by default, dark toggle) on a token system and a small component kit, without changing behaviour.

**Architecture:**
- CSS variables (light on `:root`, dark on `[data-theme="dark"]`) feed Tailwind via `@theme inline`.
- `tokens.ts` mirrors the values, so a contrast test can check them.
- A component kit in `tablet/src/components/ui/` replaces `components/ui.tsx`.
- Screens are rebuilt on the kit.
- New display logic lives in pure, tested modules in `tablet/src/lib/`.
- `engine/`, `db/` and `io/` are not touched.

**Tech Stack:**
- React 19 and Tailwind 4 (existing)
- `motion` (new, `motion/react`)
- `@fontsource-variable/fraunces` (new), plus Geist and Geist Mono (existing)
- Vitest (root config)

**Spec:** `docs/superpowers/specs/2026-10-21-tablet-clubhouse-redesign-design.md`. The approved mockups are `.superpowers/brainstorm/518-1792574178/content/liveboard.html` and `screens.html`.

## Global Constraints

- **Token values:** exactly as in the spec §1 table, both themes. `--muted` light is `#6f695c`.
- **Fonts:**
  - Fraunces 600 for screen titles, court names, big scores and date tiles.
  - Geist for everything else.
  - Geist Mono with `tabular-nums` for every number.
  - Everything is bundled offline; no network fonts.
- **Theme:** light by default; stored in `meta.theme`; applied before first paint; toggled from Home.
- **Touch targets:** ≥ 44 px on everything tappable.
- **Accessibility:** a visible focus ring; `aria-label` on icon buttons; sheets have `role="dialog"` and `aria-label`.
- **Motion:**
  - Durations: Sheet 220 ms, queue reorder 200 ms, court game fade 180 ms.
  - Everything is disabled under `prefers-reduced-motion` via `<MotionConfig reducedMotion="user">`.
- **Behaviour:** no behaviour change. Engine, db and io files are untouched, and all 481 existing tests must stay green.
- **Copy:** sentence case. No new user-facing features beyond the spec.
- **Layout:** no horizontal scroll at 1024×768 or wider. At 768 px wide, the live board's queue panel stacks under the courts.

## Review Focus

- **Long names and big sessions.** With a 24-character name, 8 courts and 30 in line, names truncate with an ellipsis. Courts wrap, the queue scrolls inside its panel, and nothing overflows. This is a browser check in Task 7, plus an `initials` test for long and odd names in Task 2.
- **The queue tray and a row that changes under it.** When a row with an open tray starts a game or is removed, the tray closes and no action applies to a stale row. Task 7 adds the `trayFor(openEntryId, line)` helper test.
- **A theme read that fails or is garbage.** If `meta.theme` is missing, unreadable or an unknown string, the app shows light and doesn't crash. A test in Task 1.
- **Reduced motion.** With the OS "reduce motion" on, sheets and rows appear instantly. This is a browser check in Task 8 that emulates `prefers-reduced-motion`.
- **Dismissing a sheet mid-entry.** Escape or a scrim tap closes Finish game, Check in and Player form without saving anything. This is a browser check in Task 7, and the `Sheet` has no implicit submit.

---

## File Structure

`tablet/src/`:

**New in `lib/`:**

| File | Purpose |
|---|---|
| `lib/tokens.ts` | light and dark token values, the source for the contrast test |
| `lib/contrast.ts` | `contrastRatio(hexA, hexB)` |
| `lib/theme.ts` | load, save and apply the theme |
| `lib/initials.ts` | |
| `lib/boardStats.ts` | |
| `lib/courtStatus.ts` | extended with `courtPill` |
| `lib/sessionHighlights.ts` | |
| `lib/queueTray.ts` | |

**New component kit in `components/ui/`:**

- `Button.tsx`, `IconButton.tsx`, `Card.tsx`, `Pill.tsx`, `Avatar.tsx`, `Chip.tsx`, `Toggle.tsx`, `Stepper.tsx`, `TextField.tsx`, `SearchField.tsx`
- `Sheet.tsx`, `Menu.tsx`, `ConfirmSheet.tsx`, `EmptyState.tsx`, `Toast.tsx`, `UndoToast.tsx`, `ScreenHeader.tsx`, `BrandMark.tsx`
- `index.ts`, which re-exports the kit

**Deleted:**

- `components/ui.tsx`, `components/ConfirmDialog.tsx`, `components/UndoBar.tsx`

**Rewritten on the kit:**

- `components/CourtCard.tsx`, `PlayerForm.tsx`, `PlayerPicker.tsx`, `ResultSheet.tsx`
- `screens/*.tsx`
- `App.tsx`
- `styles.css`

New: `components/QueuePanel.tsx`, the live-board queue.

---

### Task 1: Tokens, fonts and theme

**Files:**
- Create: `tablet/src/lib/tokens.ts`, `tablet/src/lib/contrast.ts`, `tablet/src/lib/theme.ts`
- Modify: `tablet/src/styles.css` (replace the dark-only tokens), `tablet/src/main.tsx`, `tablet/package.json` (add `motion` and `@fontsource-variable/fraunces`)
- Test: `tablet/src/lib/tokens.test.ts`, `tablet/src/lib/theme.test.ts`

**Interfaces:**
- Produces:
  - `TOKENS: Record<"light" | "dark", Record<TokenName, string>>`, where `TokenName` is the spec's names without `--`: `bg`, `surface`, `sunken`, `line`, `ink`, `muted`, `primary`, `on-primary`, `t1`, `t1-bg`, `t2`, `t2-bg`, `court`, `court-line`, `clay`, `clay-bg`, `ball`.
  - `contrastRatio(a: string, b: string): number`, using the WCAG relative-luminance formula.
  - `type Theme = "light" | "dark"`
  - `parseTheme(raw: unknown): Theme`, which returns `"light"` unless `raw === "dark"`.
  - `loadTheme(): Promise<Theme>`, which uses `getMeta("theme")` and catches errors, returning `"light"`.
  - `saveTheme(t: Theme): Promise<void>`
  - `applyTheme(t: Theme): void`, which sets `document.documentElement.dataset.theme` and `style.colorScheme`.
  - Tailwind colour utilities: `bg-bg`, `bg-surface`, `bg-sunken`, `border-line`, `text-ink`, `text-muted`, `bg-primary`, `text-on-primary`, `text-t1`, `bg-t1-bg`, `text-t2`, `bg-t2-bg`, `bg-court`, `border-court-line`, `text-clay`, `bg-clay-bg`, `bg-ball`.
  - Font utilities: `font-serif` (Fraunces Variable), `font-sans` (Geist Variable), `font-mono` (Geist Mono Variable).
  - The CSS variable `--shadow` for each theme, and the utility `shadow-card` (`box-shadow: var(--shadow)`).

- [ ] **Step 1: Write the failing tests**

  In `tokens.test.ts`:
  - `body text meets AA in both themes`: for each theme, `contrastRatio(ink, bg)`, `(ink, surface)`, `(ink, sunken)`, `(muted, bg)`, `(muted, surface)`, `(on-primary, primary)`, `(t1, t1-bg)`, `(t2, t2-bg)` and `(clay, clay-bg)` are each `>= 4.5`.
  - `team names stay readable on the court`: `(t1, court)` and `(t2, court)` are `>= 3`.
  - `styles.css defines every token value`: read `tablet/src/styles.css` with `fs`. For each theme and token, expect the file to contain `--<name>: <value>`, ignoring case.
  - `contrastRatio of black on white is 21`: `toBeCloseTo(21, 1)`.

  In `theme.test.ts`:
  - `parseTheme defaults to light for missing or unknown values`: `parseTheme(undefined)`, `("")`, `("blue")` and `(42)` all give `"light"`, and `parseTheme("dark")` gives `"dark"`.
  - `loadTheme falls back to light when storage throws`: use `vi.mock("../db/repo", ...)` with `getMeta` rejecting, then expect `await loadTheme()` to be `"light"`.

- [ ] **Step 2: Run the tests.**

  Run: `npx vitest run tablet/src/lib/tokens.test.ts tablet/src/lib/theme.test.ts` from the repo root.
  Expected: FAIL, module not found.

- [ ] **Step 3: Implement.**
  - Write `tokens.ts` with the spec values and `contrast.ts`.
  - Write `theme.ts` with the signatures above.
  - Rewrite `styles.css`:
    - Import Tailwind, Fraunces, Geist and Geist Mono.
    - Put the light vars on `:root` and the dark vars on `:root[data-theme="dark"]`, each with `--shadow`.
    - Add `@theme inline` mapping `--color-*` and `--font-*` as listed.
    - Base `body` uses `bg`/`ink` and the sans font.
    - Add `:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px }`.
    - If a light token fails AA, adjust its value in both `tokens.ts` and the CSS, and ledger it as a ruling. This applies to `muted` and `clay` especially.
  - In `main.tsx`, `await loadTheme()`, then `applyTheme`, then render. The render waits for the theme, so there is no flash.
  - Install the new packages: `npm i motion @fontsource-variable/fraunces` in `tablet/`.

- [ ] **Step 4: Run the tests again.** Use the same command. Expected: PASS.

- [ ] **Step 5: Commit.**

  ```bash
  git add tablet/src/lib/tokens.ts tablet/src/lib/contrast.ts tablet/src/lib/theme.ts tablet/src/lib/*.test.ts tablet/src/styles.css tablet/src/main.tsx tablet/package.json tablet/package-lock.json
  git commit -m "feat(tablet): Clubhouse tokens, fonts and theme"
  ```

  The screens will look half-styled until Task 3. That's expected, and the build must still pass (`npm run build` in `tablet/`). Old classes like `bg-card` and `text-volt` must keep compiling: add aliases `--color-card: var(--surface)`, `--color-volt: var(--primary)`, `--color-team1: var(--t1)`, `--color-team2: var(--t2)` and `--color-amber: var(--clay)`. Task 8 removes them.

### Task 2: Display helpers

**Files:**
- Create: `tablet/src/lib/initials.ts`, `boardStats.ts`, `sessionHighlights.ts`
- Modify: `tablet/src/lib/courtStatus.ts`
- Test: `initials.test.ts`, `boardStats.test.ts`, `sessionHighlights.test.ts`, and extend `courtStatus.test.ts`

**Interfaces:**
- Consumes: `SessionState`, `DeskCourt`, `DeskGame`, `Teams` and `sessionLeaderboard` (existing).
- Produces:
  - `initials(name: string): string`
  - `boardStats(state: SessionState): { playing: number; inLine: number; games: number }`
  - `type PillTone = "neutral" | "live" | "warn"`
  - `courtPill(court: DeskCourt, game: DeskGame | undefined, suggestion: Teams | { waitingFor: number } | undefined, nowMs: number): { label: string; tone: PillTone; minutes?: number }`
  - `sessionHighlights(state: SessionState): { games: number; top?: { name: string; won: number; lost: number } }`
  - `courtControls` stays as is.

- [ ] **Step 1: Write the failing tests.**
  - **`initials`:**
    - `"Ana Cruz"` → `"AC"`
    - `"  maria  de la cruz "` → `"MC"` (first and last word)
    - `"Cher"` → `"CH"`
    - `"Ñoño Ibáñez"` → `"ÑI"`
    - `""` → `"?"`
    - a 40-character single word → 2 characters
  - **`boardStats`:** use the engine fixtures. Check in 6 players, start one game, then finish it, and the refill starts another. Expect `{ playing: 4, inLine: 2, games: 1 }`. On-break and left players count in neither `playing` nor `inLine`.
  - **`courtPill`:**
    - an open court with a game started 12 min before `nowMs` → `{ label: "12 min", tone: "live", minutes: 12 }`
    - a closed court with a game → `{ label: "Closing after this game", tone: "warn" }`
    - a closed court with no game → `{ label: "Closed", tone: "neutral" }`
    - a suggestion with teams → `{ label: "Up next", tone: "neutral" }`
    - `{ waitingFor: 2 }` → `{ label: "Needs 2 more", tone: "neutral" }`
  - **`sessionHighlights`:**
    - no finished games → `{ games: 0 }`, with no `top`
    - after p1 and p2 win two games → `top` is `{ name: "Player 1", won: 2, lost: 0 }`, and `games` is 2
- [ ] **Step 2: Run the tests.** Run `npx vitest run tablet/src/lib`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement** the four functions. `sessionHighlights` takes `sessionLeaderboard(state)[0]` when it has `games_played > 0`.
- [ ] **Step 4: Run the tests again.** Expected: PASS.
- [ ] **Step 5: Commit** with `feat(tablet): display helpers for the redesign`.

### Task 3: Component kit

**Files:**
- Create: `tablet/src/components/ui/*.tsx` and `index.ts`, as listed in File Structure.
- Modify: every import of `../components/ui` and `./ui`, which now go to `../components/ui` (the folder index).
- Delete: `components/ui.tsx`, `components/ConfirmDialog.tsx`, `components/UndoBar.tsx`. Their uses move to `ConfirmSheet` and `UndoToast`.
- Modify: `App.tsx`. Wrap the app in `<MotionConfig reducedMotion="user">`, and replace `Toaster` with the new `Toast` host.

**Interfaces** (the props every later task uses):
- `Button({ variant?: "primary"|"quiet"|"ghost"|"danger"; size?: "md"|"lg"; ...button props })`
  - md is `min-h-11 rounded-xl px-4 text-sm`; lg is `min-h-14 text-base`.
  - Pressed state is `active:scale-[0.98]` with a 120 ms transition.
- `IconButton({ label: string; ...button props })`: 44×44, `aria-label={label}`, `title={label}`.
- `Card({ className?, children })`: `bg-surface border-line rounded-[18px] shadow-card`.
- `Pill({ tone: PillTone | "info"; children })`: `live` shows a dot.
- `Avatar({ name: string; tone?: "t1"|"t2"|"neutral"; size?: 26|30 })`
- `Chip({ selected: boolean; onClick; children })`
- `ChipGroup<T>({ options: T[]; value: T; onChange; format? })`: replaces `Chips`.
- `Toggle({ checked; onChange; label })`
- `Stepper({ value; onChange; min; max; label })`: big Fraunces value.
- `TextField({ label; ...input props })`
- `SearchField({ value; onChange; placeholder })`
- `Sheet({ title: string; onClose: () => void; children; footer?: ReactNode })`
  - A bottom sheet over a scrim, with `role="dialog"` and `aria-label={title}`.
  - Escape and a scrim tap call `onClose`.
  - It rises via motion `y: "100%"→0` in 220 ms.
  - The content scrolls inside, up to 85vh.
- `Menu({ trigger: ReactNode; items: { label: string; onSelect: () => void; tone?: "danger" }[] })`: an anchored popover that closes on outside tap or Escape.
- `ConfirmSheet({ title; body; confirmLabel; danger?; onConfirm; onCancel })`
- `EmptyState({ title; body; action? })`
- `toast(message: string)` plus `<ToastHost/>`: a dark pill that slides up and lasts 4 s.
- `UndoToast({ label; onUndo; onExpire; startedAt: number })`
  - It has a countdown bar animated from 100% to 0 over the remaining part of 10 s.
  - Keying it on `startedAt` restarts the timer. This fixes the deferred "same-label" minor.
- `ScreenHeader({ title; meta?: ReactNode; onBack?; actions? })`: 64 px tall, Fraunces 24 title.
- `BrandMark()`: a 26 px volt ball (radial gradient on `bg-ball`) plus "Pickleball Desk" in Fraunces 18.

- [ ] **Step 1: Build the kit** to the props above, using the tokens from Task 1. Every component takes `className` for layout overrides.
- [ ] **Step 2: Move existing imports.** Point every existing import at the kit: `Modal`→`Sheet`, `Chips`→`ChipGroup`, `ConfirmDialog`→`ConfirmSheet`, `UndoBar`→`UndoToast`, `Toaster`→`ToastHost`. Screens keep their current layouts for now.
- [ ] **Step 3: Verify.**
  - `npx tsc -b` and `npm run build` in `tablet/` exit 0.
  - `npx vitest run tablet` passes.
  - In the browser at 1280×800, open each screen, open a sheet, and close it with Escape and with a scrim tap. There are no console errors.
- [ ] **Step 4: Commit** with `feat(tablet): Clubhouse component kit`.

### Task 4: Home, Backup and the theme toggle

**Files:** `tablet/src/screens/Home.tsx` and `tablet/src/screens/Backup.tsx`.

**Interfaces:**
- Consumes: `BrandMark`, `ScreenHeader`, `Card`, `Button`, `IconButton`, `EmptyState`, `loadTheme`, `saveTheme`, `applyTheme`, `sessionHighlights` and `boardStats`.
- To build each past session's highlights and the live counts, Home calls `loadSessionState(id)` for the live session and for each ended session (newest first, at most 20).

- [ ] **Step 1: Build Home** to spec §4 Home and the `screens.html` mockup:
  - **Header:** BrandMark, then `Roster` with a count, `Backup`, and a theme `IconButton` (☾ in light, ☀ in dark) with `label="Switch to dark"` or `"Switch to light"`.
  - **Live session:** a primary hero card showing:
    - "Live now · started h:mm am/pm"
    - the title in Fraunces
    - `N courts · N playing · N games`
    - an `Open live board →` button, styled `bg-on-primary text-primary`
  - **No live session:** a surface hero with a primary `New session` button.
  - **Backup nudge:** a clay banner using the existing `backupReminder` text, followed by "Back up now".
  - **Past sessions:**
    - Each row shows a date tile (day in Fraunces 20, month uppercase 11), the title, `Mode · N games · top: Name W–L`, and a chevron.
    - The `top:` part only shows if there is a top player.
    - With no past sessions, show an `EmptyState`.
- [ ] **Step 2: Restyle Backup.** Use two Cards with Fraunces headings, and route Restore through `ConfirmSheet`.
- [ ] **Step 3: Check in the browser.**
  - Home in light and dark: the toggle switches instantly.
  - Reload: the theme is kept, with no light flash in dark.
  - Backup: save and restore-reject (pick a non-backup file) show a toast.
- [ ] **Step 4: Commit** with `feat(tablet): Clubhouse home and backup, theme toggle`.

### Task 5: Roster and the player form

**Files:** `tablet/src/screens/Roster.tsx` and `tablet/src/components/PlayerForm.tsx`.

- [ ] **Step 1: Build Roster** to spec §4 Roster:
  - **Header:** Fraunces title, a mono count, and a primary `Add player` button.
  - **Filters:** a `SearchField`, then `All` / `Archived` chips. These replace the "Show archived" toggle: `Archived` shows only archived players.
  - **Rows:**
    - `Avatar` (neutral), the name, and the note as a muted second line.
    - A skill badge in mono with `toFixed(1)`.
    - A ⋯ `Menu` with Edit, Archive or Unarchive, and Delete (danger), which opens a `ConfirmSheet`.
  - Long names truncate.
  - With an empty roster, show an `EmptyState` with an Add player action.
- [ ] **Step 2: Rebuild `PlayerForm`** in a `Sheet`:
  - fields: Name (`TextField`, autofocus), Skill (`ChipGroup` over `SKILL_LEVELS`), Note
  - footer: Cancel (ghost) and the save button (primary, disabled when the name is blank)
  - Enter submits.
- [ ] **Step 3: Check in the browser.**
  - Add, edit, archive, unarchive and delete; delete refuses a player with games and shows a toast.
  - Search works.
  - Escape on the form saves nothing.
  - Check in both themes.
- [ ] **Step 4: Commit** with `feat(tablet): Clubhouse roster and player form`.

### Task 6: New session

**Files:** `tablet/src/screens/NewSession.tsx`.

- [ ] **Step 1: Build it** to spec §4 New session:
  - **Grouped cards:**
    - The night: title and date.
    - Courts: a `Stepper` from 1–8, then the court name fields in a 2-column grid.
    - Scoring: the Track scores `Toggle`, `ChipGroup` 11/15/21 and the Win by 2 `Toggle`. The last two are hidden when scores are off, with the line "You'll just tap which team won."
    - Matchmaking: chips for `balanced`, `social_mixer`, `skill_separated` and `winners_stay`, plus a `+6 more` chip that reveals the remaining six in place. The hint shows the selected mode's `hint` from `MATCHING_STYLES`.
    - If the selected mode is one of the six hidden ones, they show expanded.
  - **Sticky footer:** reads back `N courts · Label · to 11, win by 2` (or `win/loss only`), next to a primary `Start session` button.
  - The start logic is unchanged.
- [ ] **Step 2: Check in the browser.**
  - Change each control; the footer readback updates.
  - Start opens the live board.
  - Check in both themes.
- [ ] **Step 3: Commit** with `feat(tablet): Clubhouse new session`.

### Task 7: Live board, court card, queue, pickers and result sheet

**Files:**
- Modify: `tablet/src/screens/LiveBoard.tsx`, `components/CourtCard.tsx`, `components/PlayerPicker.tsx`, `components/ResultSheet.tsx`
- Create: `components/QueuePanel.tsx`, `tablet/src/lib/queueTray.ts`
- Test: `tablet/src/lib/queueTray.test.ts`

**Interfaces:**
- Consumes: `boardStats`, `courtPill`, `courtControls`, `initials` (via `Avatar`), the kit, and `createBoardController` (unchanged).
- Produces: `trayFor(openEntryId: string | null, line: DeskQueueEntry[]): string | null`. It returns `openEntryId` only while that entry is still in `line`, and otherwise `null`.

- [ ] **Step 1: Write the failing test.**
  `queueTray.test.ts`: `tray closes when its row leaves the line`. With `line = [a, b]`:
  - `trayFor("b", line)` → `"b"`
  - `trayFor("b", [a])` → `null`
  - `trayFor(null, line)` → `null`
- [ ] **Step 2: Run the test.** Run `npx vitest run tablet/src/lib/queueTray.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement `trayFor`, then the live board**, to spec §4 Live board and `liveboard.html`.
  - **Header:**
    - The title, with meta: mode label · `describeRule` · `N playing · N in line · N games` from `boardStats`.
    - Actions: `Results` (ghost), `Check in` (quiet, with a ＋ icon), `End session` (ghost).
  - **`CourtCard`:**
    - The header shows the court name in Fraunces 20 and a `Pill` from `courtPill`, with a live tick each 30 s as today.
    - A ⋯ `Menu` holds Close court or Reopen (label from `courtControls`), plus "Swap a player" while a game runs. That item shows a hint toast "Tap the player to swap out".
    - The surface has court lines, kitchens and a centre net. Each player is shown as `Avatar` plus their name in team tone. Open spots are dashed pills.
    - One full-width action: `Finish game` or `Start game` (primary), or `Waiting for players` (quiet, disabled).
    - A new game fades in with `motion` (180 ms), keyed on the game id.
  - **`QueuePanel`:**
    - A sunken right column, 300 px wide, that scrolls inside.
    - `In line` with its count. Each row shows the number, the name (truncated) and `N game(s)`.
    - A row tap toggles a tray with ↑ Up, ↓ Down, Break and Gone home. The tray state is `openEntryId` passed through `trayFor`, and only one tray is open at a time.
    - Rows use `motion` `layout` with a 200 ms transition.
    - Below the line come sections: `On court` (with the break-after-game and going-home toggles, sorted by name), `On a break` (with Back in line), and `Gone home · N` (collapsed, tap to expand).
    - Below 1024 px wide, the panel stacks under the courts with full width.
  - **`PlayerPicker`:** a `Sheet` with a `SearchField` plus `Add walk-in`, and a 2-column grid of tiles (Avatar, name, skill). Multi-select shows "Check in N" in the footer.
  - **`ResultSheet`:** a `Sheet` titled with the court name and `describeRule`.
    - Two team panels (`bg-t1-bg` / `bg-t2-bg`), each with names, a Fraunces 44 score and − / + `IconButton`s.
    - Footer: `Team 1 won`, `Team 2 won`, and a primary `Save A – B`.
    - The win/loss-only variant shows two large team buttons.
  - **Rejected scores:** `apply` returns `null` for a rejected score; on that the sheet shakes the Save button (motion `x: [0,-6,6,-4,4,0]`, 300 ms) and shows the engine message inline. For that, `LiveBoard` passes the error to the sheet instead of only toasting it. `createBoardController`'s `onError` also still toasts.
  - **Undo:** `UndoToast` with `startedAt` taken from the controller's `peek().at`.
- [ ] **Step 4: Run the test again.** Expected: PASS. Then run `npx tsc -b`.
- [ ] **Step 5: Run the evening in the browser** at 1280×800, in both themes:
  - Check in 9 players plus a walk-in.
  - Swap in a suggestion and start 2 courts.
  - Try 11-10 with win-by-2: the Save button shakes and shows the reason.
  - Finish with "Team 1 won", then undo.
  - Break and gone home mid-game.
  - Close a court mid-game: the pill reads "Closing after this game", then reopen it.
  - Open the tray on a row, then start a game that takes that row: the tray closes.
  - Escape out of the Finish sheet: nothing is saved.
  - **Big session:** a 24-character name, 8 courts and 20+ in line. Nothing overflows horizontally.
  - **Portrait, 768×1024:** the queue stacks under the courts.
  - No console errors.
- [ ] **Step 6: Commit** with `feat(tablet): Clubhouse live board`.

### Task 8: Summary, clean-up, reduced motion and release

**Files:**
- Modify: `tablet/src/screens/Summary.tsx`, and `tablet/src/styles.css` (remove the Task 1 aliases)
- Fix any leftover old class names, found with `rg -n "volt|team1|team2|bg-card|text-amber|text-muted-foreground|text-foreground|bg-background|bg-muted|border-border" tablet/src`.

- [ ] **Step 1: Build Summary** to spec §4 Summary:
  - **Header:** title, meta (date · mode · N games), `Back to live board` when live, and a primary `Export to Excel` button.
  - **Left:** podium cards for ranks 1–3 (place, Fraunces name, `W–L · ±diff` in mono; diff only when scores are tracked), then a table for rank 4 and down. With fewer than 3 players, show fewer cards.
  - **Right:** the game list, newest first. The winner's team is in team colour, "· fixed" is shown when corrected, and each game has a `Fix` button opening `ResultSheet`.
- [ ] **Step 2: Remove the aliases.** Delete the aliases, then fix every remaining match of the `rg` command above. The command must print nothing.
- [ ] **Step 3: Run the full checks.**
  - `npx vitest run` at the root: all pass (481 plus the new tests).
  - `npx tsc --noEmit` at the root, and `npx tsc -b` plus `npm run build` in `tablet/`: exit 0.
  - In the browser, emulate reduced motion: in DevTools run `matchMedia('(prefers-reduced-motion: reduce)')`, or set `MotionConfig reducedMotion="always"` temporarily and revert. Sheets and rows must appear without animating.
  - In the browser, in both themes, at 1280×800: the summary renders, Fix result works, and Export downloads (do not click Export in the pane; the export path is unchanged and unit-tested).
- [ ] **Step 4: Rebuild the release APK.** Run `npm run apk:release` in `tablet/`. Expected: `BUILD SUCCESSFUL`, and `apksigner verify --print-certs` shows the `desk` certificate.
- [ ] **Step 5: Commit** with `feat(tablet): Clubhouse summary and clean-up`.
