# Pickleball Desk: "Clubhouse" redesign

Date: 2026-10-21
Status: design approved in chat (visual companion); awaiting spec review
Applies to: `tablet/` only. The online web app is out of scope.

## Purpose

Make the tablet app feel modern, calm and professionally finished, with a distinctive look that
isn't a template. Every screen should share one visual language, read clearly at arm's length on a
landscape tablet, and keep all of today's behaviour.

Success means:

- **One look.** Every screen uses the same tokens and components.
- **Light and dark.** Light is the default, and dark is a toggle on Home.
- **Readable and usable.** Text meets WCAG AA contrast in both themes, and every touch target is at
  least 44 px.
- **Nothing regresses.** All existing tests still pass and every flow works as before.

## Decisions made with the user

- Direction: **Clubhouse.** A light, warm "well-run club" feel: cream paper, deep club-green ink,
  gentle depth.
- Type: **Fraunces** (serif) for titles, court names, big scores and date tiles. **Geist** for
  everything else, and **Geist Mono** for numbers. All are bundled offline via `@fontsource`.
- Dark mode: an **in-app toggle** (sun/moon button on Home). Light is the default, and the choice is
  remembered.
- Approach: a **token-based design system plus a small component kit**, then rebuild each screen on
  it. The engine, storage and IO modules are not changed.

## 1. Design tokens

Tokens are defined as CSS variables in `tablet/src/styles.css` and exposed to Tailwind through
`@theme inline`. Light is set on `:root`, and dark is set on `:root[data-theme="dark"]`.

| Token | Light | Dark | Used for |
|---|---|---|---|
| `--bg` | `#f6f3ec` | `#111714` | page background |
| `--surface` | `#fffdf8` | `#19211d` | cards, rows, sheets |
| `--sunken` | `#efeadf` | `#151c18` | side panels, chips, wells |
| `--line` | `#e4ded1` | `#26302b` | borders, dividers |
| `--ink` | `#1d2421` | `#ece6d8` | main text |
| `--muted` | `#6f695c` | `#97a097` | secondary text (AA on `--bg` and `--surface`) |
| `--primary` | `#1f3b2f` | `#a9d1b4` | the one primary action, hero card |
| `--on-primary` | `#f6f3ec` | `#10241a` | text on primary |
| `--t1` / `--t1-bg` | `#2f6b4f` / `#d6e6d5` | `#8fcca5` / `#1f3a2c` | Team 1 |
| `--t2` / `--t2-bg` | `#2f5a7a` / `#d8e4ec` | `#93c2e0` / `#1d3242` | Team 2 |
| `--court` / `--court-line` | `#e3ebdf` / `#ffffff` | `#1c2a22` / `#3b4d42` | court surface and lines |
| `--clay` / `--clay-bg` | `#b4572f` / `#f5e3d8` | `#e39a74` / `#3a261d` | warnings: closing, backup nudge, errors |
| `--ball` | `#d4e938` | `#d4e938` | brand mark only |

Other scales:

- **Radii:** 10 (chips, small buttons), 12 (buttons, rows), 16–18 (cards), 20 (sheets).
- **Shadow:** light is `0 1px 2px #3b2f1a12, 0 8px 22px #3b2f1a10`; dark is
  `0 1px 0 #ffffff08 inset, 0 10px 26px #00000055`.
- **Spacing:** a 4 px base. Screens use 20–24 px gutters, and cards use 14–18 px padding.
- **Type scale (px):**
  - screen title 24 (Fraunces 600)
  - section title 18–20 (Fraunces)
  - body 15
  - meta 13
  - label 11 (uppercase, letter-spacing .05em)
  - scores 44 (Fraunces)

## 2. Component kit (`tablet/src/components/ui/`)

The kit replaces today's `components/ui.tsx`. Each component is one file:

- **`Button`:** variants `primary`, `quiet` (surface + line) and `ghost`, plus `danger` in clay.
  Sizes are md and lg. It shows a pressed scale of 0.98 and a focus ring.
- **`IconButton`:** 44 px square, with an `aria-label`.
- **`Card`:** surface, line, radius 18 and shadow.
- **`Pill`:** status tones `neutral`, `live` (green with a dot), `warn` (clay) and `info`.
- **`Avatar`:** initials from the name, tinted by team or neutral.
- **`Chip` / `ChipGroup`:** a selectable choice set, used for skill, targets and modes.
- **`Toggle`:** a switch.
- **`Stepper`:** − value + controls.
- **`TextField`:** a labelled input.
- **`SearchField`:** a text field with a search icon.
- **`Sheet`:** a bottom sheet with a grab handle and scrim. It rises in 220 ms and closes on a scrim
  tap or Escape. It replaces the centred `Modal` for forms, pickers and results.
- **`Menu`:** a small anchored popover list, used for the court ⋯ and roster ⋯ menus.
- **`ConfirmSheet`:** the confirm dialog rebuilt on `Sheet`.
- **`EmptyState`:** an icon, title and one line of help.
- **`Toast` / `UndoToast`:** a dark pill; the undo version has a 10 s countdown bar.
- **`ScreenHeader`:** a back button, a Fraunces title, optional meta, and an actions slot.
- **`BrandMark`:** the volt ball plus the "Pickleball Desk" wordmark.

Motion uses the `motion` package (`motion/react`), the same library the web app uses:

- **Sheet in and out:** 220 ms.
- **Queue rows:** `layout` animation when the line re-orders, 200 ms.
- **New game on a court:** fades onto the court, 180 ms.
- **Toasts:** slide up.
- **Press feedback:** on buttons.
- **Rejected score:** a short shake on the Save button.

All motion is disabled when `prefers-reduced-motion: reduce` is set (`MotionConfig reducedMotion="user"`).

## 3. Theme

- `lib/theme.ts`:
  - `type Theme = "light" | "dark"`
  - `loadTheme(): Promise<Theme>`, reading `meta.theme` and defaulting to `"light"`
  - `saveTheme(theme)`
  - `applyTheme(theme)`, which sets `document.documentElement.dataset.theme` and the `color-scheme`
- `App` applies the saved theme before first paint, so a dark user never sees a light flash. The
  root renders nothing until the theme is applied.
- Home has a sun/moon `IconButton` that flips the theme and saves it.
- The Android status bar and splash background follow the theme where Capacitor allows. Otherwise
  they stay `--bg` light. This is cosmetic.

## 4. Screens

### Live board (approved mockup: `liveboard.html`)

**Header**

- The title is in Fraunces.
- The meta line shows the mode, the scoring rule and live counts: `N playing · N in line · N games`.
- Actions run quiet to loud: `Results` (ghost), `Check in` (quiet), `End session` (ghost).

**Court card**

- **Header:** the court name in Fraunces, then a status `Pill`:
  - `N min`, live
  - `Up next`
  - `Needs N more`
  - `Closing after this game`, warn
  - `Closed`
- **⋯ `Menu`:** Close court or Reopen, and Swap a player (only while a game is running).
- **Court surface:** court lines, kitchens and a centre net line. Players show as an `Avatar` plus
  their name, in team colours. Open spots are dashed pills.
- **One full-width action:**
  - `Finish game`, primary
  - `Start game`, primary
  - `Waiting for players`, quiet and disabled
- Tapping a player name still swaps that player (in a suggestion, or in a running game).

**Queue panel (right, sunken)**

- `In line` with its count.
- Each row shows the place in line, the name, and games played (`2 games`).
- **Tapping a row expands an action tray:** ↑ Up, ↓ Down, Break and Gone home. Only one tray is
  open at a time.
- **Sections below:**
  - `On court`, for break-after-game and going-home-after-game requests
  - `On a break`, with `Back in line`
  - `Gone home`, a collapsed list with its count

**Undo**

- `UndoToast` at the bottom centre, with a countdown bar.

### Home (mockup: `screens.html`)

- **Header:** the `BrandMark`, then Roster (with count), Backup, and the theme toggle.
- **Live session card:** a primary-coloured hero card showing:
  - "Live now · started 7:05 pm"
  - the title in Fraunces
  - courts · playing · games
  - an `Open live board →` button
- **When no session is running:** a surface hero with the "No session running" copy and a primary
  `New session` button.
- **Backup nudge:** a clay banner, shown under the same rule as today.
- **Past sessions:** a card list with a date tile (day in Fraunces, then the month), the title,
  `Mode · N games · top: Name W–L`, and a chevron.

### Roster

- **Header:** the title, the count, and a primary `Add player` button.
- **Filters:** a `SearchField` plus `All` / `Archived` chips.
- **Rows:** an `Avatar`, the name, the note as a second line, a skill badge (mono), and a ⋯ `Menu`
  with Edit, Archive or Unarchive, and Delete.
- Add and Edit open in a `Sheet`, using `PlayerForm` restyled with skill `ChipGroup`.

### New session

- **Grouped cards:**
  - **The night:** title, date.
  - **Courts:** a `Stepper` from 1–8, then editable court names.
  - **Scoring:** Track scores, Play to 11/15/21, Win by 2.
  - **Matchmaking:** the four most-used modes as chips (Balanced, Social mix, Skill separated,
    Winners stay), plus `+6 more`, which reveals the rest. A one-line hint describes the selected
    mode.
- **Sticky footer:** reads back `N courts · Mode · rule` next to a primary `Start session` button.

### Finish game and Fix result (`Sheet`)

- **Title:** the court name and the rule.
- **Two team panels:** tinted `--t1-bg` / `--t2-bg`, each with team names, a big Fraunces score and
  − / + controls.
- **Actions:** `Team 1 won`, `Team 2 won`, and a primary `Save A – B`.
- **When the score can't end a game:** the Save button shakes and the reason shows inline.
- **Win/loss-only sessions:** two large team buttons.

### Check in and swap pickers (`Sheet`)

- A `SearchField`, then a two-column grid of selectable player tiles (avatar, name, skill), plus
  `Add walk-in`.
- Multi-select shows a count on the primary button.

### Summary

- **Header:** the title, meta (date, mode, games), `Back to live board` when the session is live, and
  a primary `Export to Excel` button.
- **Left:** podium cards for the top three (place, name in Fraunces, W–L and diff), then a table for
  the rest.
- **Right:** the game list, newest first. The winner's team is in team colour, a "fixed" marker shows
  where a result was changed, and each game has a `Fix` button.

### Backup

- Two cards: Save a backup (with the last backup time) and Restore, both restyled. Restore confirms
  through a `ConfirmSheet`.

## 5. New derived data (pure, unit-tested)

New modules in `tablet/src/lib/`:

- **`initials(name): string`** — `"Ana Cruz"` → `"AC"`, `"Cher"` → `"CH"`, and empty → `"?"`.
- **`boardStats(state): { playing; inLine; games }`** — `playing` and `inLine` come from queue
  statuses, and `games` counts finished games.
- **`courtStatus(court, game, suggestion)`** — extends today's `courtControls` with the `Pill` label
  and tone (live minutes, Up next, Needs N more, Closing after this game, Closed).
- **`sessionHighlights(state): { games; top?: { name; won; lost } }`** — used by Home's past-session
  rows. It reads the existing `sessionLeaderboard`.
- **`theme.ts`** — load, save, and the default.

## 6. Accessibility and quality bar

- **Contrast:** all text/background pairs in both themes meet WCAG AA (4.5:1 body, 3:1 large text and
  icons). The token table is checked with a small contrast test.
- **Touch targets:** ≥ 44 px.
- **Focus:** visible focus rings on everything interactive.
- **Labels:** icon buttons have `aria-label`, and sheets have `role="dialog"` plus `aria-label`.
- **Motion:** respects reduced motion.
- **No horizontal scroll:** at 1024×768 and wider, landscape. Layouts still work at 768 px wide
  (portrait), with the queue panel stacking under the courts.

## 7. Testing

- **Unit tests (Vitest)** for every module in section 5, plus a contrast test over the token pairs.
- **Existing tests:** all 481 keep passing. The engine, db and io modules are untouched.
- **Browser run (built-in browser, 1280×800), in both themes:**
  - home
  - roster add, edit, archive and delete
  - new session
  - check in with a walk-in
  - start, finish, an invalid score that shakes, undo, fix result
  - break and gone home
  - close and reopen a court
  - end the session and view the summary
  - backup screen
  - a theme switch that persists across reload
  - a 768 px portrait check
  - no console errors
- **Release:** a release APK is rebuilt and signed with the existing key.

## Out of scope

- the web app
- new features
- changes to matchmaking or scoring rules
- iPad
- haptics
- sound
