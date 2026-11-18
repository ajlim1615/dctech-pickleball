# Court Control QA Re-test Prompt (Post-Fix Verification)

Use this prompt to verify the `fix/court-control-qa` release once deployed to `https://dctech-pickleball.vercel.app/sessions`.

---

Test the court control fixes in the pickleball app at `https://dctech-pickleball.vercel.app/sessions` using browser tools. Reference test script: `Court control test run-through.md` (steps **1.7, 2.1–2.3, 3.1–3.8, 4.1, 4.3, 5.6** and the **responsiveness audit**).

## Safety
- This app uses the **LIVE database**. Everything you create must be clearly dummy data prefixed with `"ZZ Test"`. Never edit, end, or add players to any session, player, or court setting that you did not create in this run.
- Courts are shared by all sessions. Before starting, check `https://dctech-pickleball.vercel.app/sessions`: if **any** non-`"ZZ Test"` session is live, **STOP** and tell me. Only one `"ZZ Test"` session may be live at a time — end it before finishing.
- Do not type passwords. If a login page appears, stop and ask me to sign in as an admin in the browser, then continue.
- Use two tabs on the same admin login for two-admin checks: **Tab A = Admin A**, **Tab B = Admin B**.

## Setup
1. Create a session named `"ZZ Test – Retest – <today's date and time>"`: **2 courts**, matching style **Balanced**, **CASUAL / not ranked**, **scores tracked ON**, **partners allowed ON**.
2. Start it. In "Who's going", use `+ Walk-in / Guest` to add 10 dummy guests:
   - `"ZZ Test Retest Very Long Name 01"`
   - `"ZZ Test Retest 02"` … `"ZZ Test Retest 10"`
   Pick ONLY these 10 guests as here, then start.
3. Open the session URL in both **Tab A** (`1280×800`) and **Tab B** (`1280×800`). Confirm all 10 are waiting in the Queue and both `Up Next 1 (Auto)` and `Up Next 2 (Auto)` appear with real names.

## Steps to Re-test
For each step: perform it, screenshot, compare against Expected, and record any browser console errors or failed network requests.

- **1.7 Add match:** Tap `+ Add match` and pick a waiting player. Expected: both existing `Auto` cards stay intact and a 3rd card (`Up Next 3`) appears with 1 player, 3 empty slots, and `"Fill every slot to send"`. Delete `Up Next 3` afterwards.
- **2.1 Start Up Next:** On Tab A, tap `Start Up Next 1` on Court 1. Expected: those 4 players start on Court 1; `Up Next 1` vanishes cleanly on **both Tab A and Tab B** within ~2 s (no ghost `"Player"` placeholders); remaining/new card shows real names.
- **2.2 Choose Players:** On Tab B, tap `Choose Players` on Court 2, pick 4 players including at least 1 who is currently in the remaining Up Next card, deselect one and pick another, then tap `Fill Court`. Expected: those exact teams start on Court 2 and the picked players vanish cleanly from Up Next on both tabs (no `"Player"` placeholders).
- **2.3 Fill open courts:** Save results on both courts (Quick win → Submit result) so both are open, wait ~4 s to verify previous `"Game started."` / `"Saved..."` success banners clear automatically, then tap `Fill open courts`. Expected: both courts start and the bar displays `"Started 2 courts"` (clears after ~4 s).
- **3.1–3.8 Live-court mid-game actions (on Court 1 at score 3–2):**
  - **3.1 Replace:** Replace a player with someone from Queue → score unchanged, replaced player at back of Queue, Undo toast appears.
  - **3.2 Undo:** Tap `Undo` within 10 s → original player back on court, replacement back at their previous Queue position (not the end).
  - **3.3 Undo expires:** Do another Replace (remember who left and who came in for **4.3**!) and wait > 10 s → Undo toast disappears.
  - **3.4 Auto-pick:** Tap a different player → `Replace player` → `Auto-pick best match` → waiting player swaps in automatically.
  - **3.5 Switch teams:** Swap a Team 1 player with a Team 2 player → sides swap, score unchanged.
  - **3.6 Remove (`×`):** Tap `×` next to a player → player goes to Queue #1, `+ Tap to add player` appears, score controls lock, `"Fill the empty slot to save a result."` appears.
  - **3.7 Fill the slot:** Tap `+ Tap to add player` and pick someone (or Auto-pick) → slot fills and score controls unlock.
  - **3.8 No-show:** Tap a player → `Mark as no-show` → next waiting player comes in, no-show appears **on a break** (not waiting).
- **4.1 Nothing starts by itself:** Finish Court 1 (Quick win → Submit result). Expected: Court 1 stays `Open` with `Start Up Next` and real player names (no `"Player"` flash); nothing starts automatically.
- **4.3 Win/loss goes to who finished:** After Court 1's result is saved, check Session Standings and Match Logs. Expected: the player who finished on court got the win/loss; the player replaced out in **3.3** did not. *(Guests aren't rated and have no standalone profile pages; check Session Standings / Match Logs.)*
- **5.6 Same player, two places (persistent error check):** With both courts open (or Court 1 open + Up Next ready), race Tab A (`Start Up Next 1`) against Tab B (`Choose Players` with an overlapping player → `Fill Court`). Expected: one succeeds, the other shows a clear error banner with a dismiss `×` button that stays visible past 4 s until dismissed; no player is on two courts.

## Responsiveness (while 1 court is live with `"ZZ Test Retest Very Long Name 01"` on Team 2, 1 court is open, and Up Next has a card)
Check at **`375×812` (phone)**, **`768×1024` (tablet)**, and **`1280×800` (desktop)**:
- Open & screenshot: **Live court**, **Player action sheet**, **Replace list**, **Choose Players** (with 1 player picked so its `×` shows), **Up Next card**, and **Undo toast**.
- Verify:
  - `0 px` horizontal page scroll; Team 2 label, truncated long name, score, and `+`/`-` fit cleanly inside the live court card on all 3 sizes.
  - Every pop-up backdrop covers 100% of the viewport width and the card is centered with reachable footer buttons.
  - Every interactive button/control on the court, sheets, Up Next, console bar, and Undo toast measures `>= 44 px` tall (`>= 44×44 px` for icon-only buttons).
  - Undo toast clears the mobile bottom navigation bar and does not hide a required button.

## Known Gaps (do not report)
- **5.1–5.2 (partners):** not testable with walk-in guests (needs two real accounts joining as a pair).
- **Undo on second device:** Undo toast only appears on the device that made the change.
- **Re-undo after Undo:** right after clicking Undo, the toast can offer Undo again; tapping it says it is too late.
- **Court monitor (Umpire view) & home-page board:** follow-ups from the first release.
- **Deleting an Auto card** regenerates it immediately; edit it instead.
- **Removing the last player** from a court ends that game as abandoned without confirmation.

## Cleanup
- End `"ZZ Test – Retest – ..."` (`End session` → confirm) and check `/sessions` to confirm **0 sessions are live**.
- Leave guest players in place, and list the dummy session URL and all 10 guest names in the report.

## Report
- Step table: `step · pass/fail · what you saw (one line) · screenshot name`.
- Responsiveness table: `screen · phone · tablet · desktop` (`ok` / `problem + one line`).
- For each failure: steps to reproduce, expected vs actual, console/network errors.
- List the dummy session and guest players created.
