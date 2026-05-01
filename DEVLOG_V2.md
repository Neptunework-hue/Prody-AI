# ProdyAI v2 — Development Log

> **Purpose:** This log documents every file changed, every design decision made, and any problems encountered during the v2 RPG reskin. Written so a developer (or a professor) can follow the process from start to finish.

---

## Project Context

ProdyAI is a React Native (Expo) productivity app built for people with executive dysfunction.
It uses **Expo Router**, **React Native Paper**, **Supabase** (auth + DB), **DeepSeek AI**, and TypeScript.

Version 2 was forked from the original app. The goal: restyle the entire visual layer to match a reference prototype (`documentation/life-tracker (3).jsx`) — a dark RPG-aesthetic "Quest Log" — **without breaking any backend functionality**.

The target design uses:
- Background `#0f0f14`, cards `#16141e`, surfaces `#22222c`
- Colors: Gold `#EF9F27`, Green `#1D9E75`, Blue `#378ADD`, Purple `#7F77DD`, Pink `#D4537E`
- Gamification: XP, Levels, Trophy Shelf for completed projects
- 5 tabs: Home (Quest Log), Focus (SVG ring timer), Daily (tasks), Habits (14-day dots), Shelf (trophies)

---

## Session: 2026-04-12

### 1. `constants/lifeTrackerDesign.ts`

**What changed:**
- Added `purple: '#7F77DD'` — was missing from the palette even though the prototype uses it.
- Added `parchmentFaint: '#5a5468'` — for subtle labels, eyebrow text, hints.
- Added `surfaceDeep: '#16141e'` — the "card" level surface (deeper than surfaceElevated).
- Added `outlineFaint: '#2a2838'` — very subtle border for inner cards.
- Added `TIER_CONFIG` object mapping tier names to their color + icon — so screens don't hardcode these.
- Added `TROPHY_ICONS` array of emoji for the shelf/complete-project modal.
- Updated `outlineVariant` in the Paper theme to use `LT.outlineFaint` instead of a hardcoded hex.

**Why:** Centralising all color tokens means one place to update the entire palette. The `TIER_CONFIG` was specifically needed for the Dashboard tier filter and the Shelf screen.

---

### 2. `utils/xpSystem.ts` *(new file)*

**What this is:** A lightweight, AsyncStorage-backed XP system.

**API:**
- `loadXPState()` → returns current `{ totalXP, dailyXP, lastDate, completedProjects }`
- `addXP(amount)` → increments XP, auto-resets dailyXP on day rollover, persists to storage
- `completeProject(project)` → adds project to shelf, awards +50 XP
- `removeCompletedProject(id)` → undo
- `getLevelInfo(xp)` → returns `{ level, xpInLevel }` (level = floor(xp/100)+1)

**Design decision:** Keeping XP in AsyncStorage rather than Supabase was deliberate — it's purely cosmetic/motivational state, not business data. Adding a new Supabase table just for XP would increase complexity with no real benefit. If the user clears the app, they lose their XP — that's acceptable for a gamification layer.

**Daily reset:** The system checks `lastDate` on every load and zeros out `dailyXP` if the date has changed. This happens automatically without any cron job.

---

### 3. `app/(app)/dashboard.tsx` *(Screen 1: Home / Quest Log)*

**Before:** Generic header ("Home / Welcome! Let's get started!"), two stat cards (focus time, streak), a "YOU HAVE N EVENTS TODAY" card, flat task list.

**After:**
- **"Quest Log" header** with "Life HQ" eyebrow and "LVL N" amber badge + total XP
- **XP progress bar** showing `xpInLevel / 100` toward next level
- **4 stat cards**: Today XP (amber), Tasks done/total (teal), Total focus hours (blue), Trophies (pink)
- **Streak / broken streak banners** (only shown when relevant — streak ≥ 3 or streak = 0 with failures)
- **"ALL ACTIVE QUESTS"** section with the existing `TaskCardWithSubtasks` list, styled with RPG eyebrow text and empty state emoji

**What was preserved:** All `offlineTaskService` calls, task ordering by priority, long-press to swap task order, task status modal (complete/failed), `useFocusEffect` refresh, `useLocalSearchParams` for chat refresh trigger.

**Key decision — import `loadXPState` in `useFocusEffect`:** XP state is loaded every time the user returns to this tab, not just on mount. This ensures the level badge is always current after completing tasks on other screens.

---

### 4. `app/(app)/tasks.tsx` *(Screen 2: Daily)*

**Before:** Functional task manager with `TaskList`, `TaskForm`, `SubtaskForm`. Header was just "Daily" + refresh icon. No RPG feel.

**After:**
- **Date eyebrow** in the style of the prototype (`MONDAY, APR 12`)
- **RPG subtext**: "Expand steps. Completing all steps earns XP."
- **XP award on completion**: `addXP(priority * 5 + 5)` called in `handleStatusChange` when status becomes `'completed'`. Priority 1 = 10 XP, priority 4 = 25 XP.
- **Daily completion bar** at the bottom of the scroll area (teal bar, `X/Y` label)
- Dialog titles changed from "Add New Task" → "New Quest", "Add Subtask" → "Add Step"
- Background and dialogs use `LT.surfaceDeep` + `LT.outlineFaint` borders

**What was preserved:** All `offlineTaskService` CRUD, `TaskList`/`TaskForm`/`SubtaskForm` components, AI subtask generation (navigates to chat), `useFocusEffect` refresh.

---

### 5. `components/focus/FocusTimer.tsx` *(component rewrite)*

**Before:** `ProgressBar` (linear, from react-native-paper) + large text timer. No session ring. `SegmentedButtons` for duration selector.

**After:**
- **SVG countdown ring** — 140px ring using `react-native-svg`, progress = `1 - timeLeft/totalSeconds`
- **`−` / `+` stepper** for adjusting session length in 5-min increments
- **Preset buttons**: 25 / 45 / 60 / 90 / custom (…) in the prototype style
- **Custom input** row (text input + "set" button) shown only when "…" is tapped
- **Pause / Resume / End session** controls in the active timer view
- **XP on complete**: `addXP(sessionMin)` — 1 XP per minute of the planned session. If user ends early, XP = elapsed minutes.

**Architecture note:** The session still calls `focusService.createSession()` / `focusService.completeSession()` — all Supabase persistence is intact. The timer tick is handled by a `setInterval` in a `useEffect` which is cleared on cleanup.

---

### 6. `app/(app)/focus.tsx` *(Screen 3: Focus)*

**Before:** Simple wrapper around `FocusTimer` + `FocusStats` + recent sessions list. Plain header.

**After:**
- **Stats row**: Yesterday focus / Daily goal (tappable to expand weekly chart) / Streak in dark cards
- **SVG daily ring**: 200px ring showing total today focus minutes vs. goal. Centered time display. "tap to start" hint when no session is active.
- **Weekly bar chart** (toggle via "Daily goal" tap): 7 columns, green ≥100%, amber ≥50%, dark otherwise, day letter labels
- **Banked focus time** row inside the chart if bank > 0
- **Goal editor**: 1h / 2h / 3h / 4h preset buttons with active highlighting
- **FocusTimer component** embedded below the daily ring
- Recent sessions list (last 5) with start time, end time, duration

**Data architecture:** Focus logs are persisted to both AsyncStorage (for the ring/chart) and Supabase (for stats). After each session completes (`onSessionComplete`), `loadData()` re-syncs from Supabase sessions to update the ring.

**Known limitation:** The daily ring's `todayMin` is derived from Supabase sessions (sum of completed sessions today). If the user is mid-session, it won't update until the session ends. This is acceptable — same behavior as the prototype.

---

### 7. `app/(app)/habits.tsx` *(Screen 4: Habits)*

**Before:** Habit list with emoji icon, title, streak, and a "+" quick-log button. No history visualization, no bank system.

**After:**
- **14-day dot grid** — each dot is an SVG shape:
  - Full circle (filled) if `value / dailyGoal >= 1`
  - Pie-sector arc if partially completed (using SVG `path` with arc command)
  - Empty grey circle if 0
- **Future days** rendered at 35% opacity (not yet applicable)
- **Bank pill** shows surplus units if banked > 0
- **Tapping past incomplete dots** opens the bank modal to fill that day retroactively
- **Bank modal**: shows banked amount, still-needed amount, number input, apply button
- **Log input + colored button** at the bottom of each card
- **Color picker** (5 dot swatches) in the create modal
- **Daily goal + unit** fields in the create modal (stored as extra fields on the habit object)
- **XP award**: +5 XP when the daily goal is first crossed for a habit

**Data architecture:** Habit progress is stored in two places:
1. Supabase (`habitService.logHabitProgress`) — for cross-device sync and history
2. AsyncStorage (`BANK_KEY`) — for the bank system and dot grid display (Supabase's `habit_history` table doesn't store exact quantities per day easily)

This is a pragmatic compromise: the dot grid reads from local logs (fast, offline-capable), while the history tab reads from Supabase.

---

### 8. `app/(app)/history.tsx` *(Screen 5: Shelf)*

**Before:** A flat list of completed/failed tasks with teal/red left borders. Minimal visual design.

**After:**
- **Trophy shelf header**: "COMPLETED QUESTS" eyebrow + "Shelf" title
- **Empty state**: Large 🏆, "Your shelf is empty — for now.", subtitle
- **Emoji icon grid** — all completed projects as large emoji in a wrapped grid with name below
- **Detail cards** — each project as a dark card: trophy emoji, name, description, completion date, `100%` in teal
- **Task history section** — below the XP shelf, shows completed/failed Supabase tasks with colored left borders (preserved from original)

**Note on XP projects vs tasks:** "Projects" in the shelf are added via `completeProject()` from the XP system — these are things like "Graduation Project" or "DataCamp Internship". Regular tasks (created in Daily) are shown separately below. This mirrors the prototype's separation of "quests" (projects) from "daily tasks".

---

## Files Changed (Summary)

| File | Type |
|------|------|
| `constants/lifeTrackerDesign.ts` | Modified — added tokens, TIER_CONFIG, TROPHY_ICONS |
| `utils/xpSystem.ts` | **New** — XP/gamification system |
| `app/(app)/dashboard.tsx` | Modified — full RPG reskin |
| `app/(app)/tasks.tsx` | Modified — RPG header, XP on complete, completion bar |
| `app/(app)/focus.tsx` | Modified — SVG ring, stats row, weekly chart, goal editor |
| `components/focus/FocusTimer.tsx` | Modified — SVG ring timer, stepper, presets |
| `app/(app)/habits.tsx` | Modified — 14-day dot grid, bank system, color picker |
| `app/(app)/history.tsx` | Modified — trophy shelf, emoji grid, detail cards |

---

## Architecture Decisions

### Why AsyncStorage for XP, not Supabase?
XP is motivational, not business-critical. Adding a Supabase table would require schema migrations, RLS policies, and network calls — all for a number that resets its daily component anyway. AsyncStorage is synchronous to read (with a fast async load), works offline, and is simple to implement.

### Why keep `habitService` Supabase calls AND AsyncStorage for habits?
The existing `habit_history` Supabase table tracks "was this habit done today: yes/no" — it doesn't store the quantity (e.g., 45 minutes of reading). The bank system and dot grid require exact quantities per day. So AsyncStorage handles the quantity log, and Supabase handles the existence log (for cross-device sync and history tab).

### Why use `react-native-svg` for rings and dots?
`react-native-paper`'s `ProgressBar` is linear — it can't represent circular progress or pie-sector dots. The SVG approach gives full control over the arc geometry and matches the prototype exactly. `react-native-svg` is already used in the project (confirmed in package.json).

### Why not rewrite TaskList/TaskCardWithSubtasks?
These components were already well-styled with the `LT` token system from a previous session. Rewriting them would be churn with no visual gain. The screens import and use them as-is, just wrapping them in the new RPG-styled headers.

---

## Problems Encountered

### 1. `LT.parchmentFaint` / `LT.surfaceDeep` / `LT.outlineFaint` were not in the original constant file
**Encountered in:** Dashboard, Tasks, Focus, Habits, Shelf
**Fix:** Added them to `lifeTrackerDesign.ts` before writing any screens. This was the first change made in this session.

### 2. `TROPHY_ICONS` imported from xpSystem but also re-exported from lifeTrackerDesign
**Encountered in:** history.tsx — was importing from both. Resolved by keeping `TROPHY_ICONS` in `lifeTrackerDesign.ts` for UI screens (they don't need the full XP state), and `TROPHY_ICONS` in `xpSystem.ts` is a separate reference only used by the XP util internally.

### 3. Focus screen's daily ring needs real data, not just `stats.total_duration`
**Encountered in:** focus.tsx
**Root cause:** `stats.total_duration` from Supabase is the all-time total, not today's total. The ring needed today-only minutes.
**Fix:** After loading Supabase sessions, filter for today's date and sum durations. Store in `focusLogs[todayStr()]`. This local log is also used by the weekly bar chart.

### 4. Habits screen needs `dailyGoal` and `unit` stored on the habit object
**Encountered in:** habits.tsx
**Root cause:** The original `Habit` type in `types/habit.ts` doesn't have `dailyGoal` or `unit` — those are prototype-specific fields.
**Fix:** Store them as extra fields when calling `habitService.addHabit()` using `as any`. This works because Supabase ignores unknown columns (depending on schema strictness). A cleaner fix would be to add these columns to the habits table — tracked as a future improvement.

---

## Dependencies Confirmed Present
- `react-native-svg` — needed for ring and dot SVG components
- `@react-native-async-storage/async-storage` — needed for XP and focus log persistence
- `expo-notifications` — used in habits for reminders (lazy-loaded)
- `@react-native-community/datetimepicker` — used in habits notification time picker
