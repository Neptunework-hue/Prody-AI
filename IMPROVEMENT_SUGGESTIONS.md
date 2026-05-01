# ProdyAI v2 — Improvement Suggestions

These are ideas for improvements beyond the current reskin. They're separated by effort level. None of them are required for the graduation presentation — they're here if you want to keep developing after.

---

## Quick Wins (1–2 hours each)

### 1. XP Flash Animation
When the user completes a task or logs a habit, show a "+N XP" floating text that fades up and disappears — just like the prototype does in the web version.
- Implementation: A small animated `Animated.Text` in a shared wrapper, triggered via a context or event emitter.
- Why it matters: This is the most visceral part of gamification. The number floating up makes the reward feel real.

### 2. Add Labels to BottomNavBar Icons
Currently the tab labels are commented out in `BottomNavBar.tsx`. Uncomment them. First-time users don't know what "Shelf" is without a label.
- File: `components/BottomNavBar.tsx` line 85

### 3. `dailyGoal` and `unit` columns in Supabase habits table
Right now these are stored as `as any` extras on the habit object. Add them properly to the Supabase `habits` table so they survive reinstalls and work across devices.
- SQL: `ALTER TABLE habits ADD COLUMN daily_goal INTEGER DEFAULT 20; ADD COLUMN unit TEXT DEFAULT 'min';`
- Then update `types/habit.ts` and `services/supabase/habitService.ts`.

### 4. Haptic feedback on XP gain
Use `expo-haptics` (already installed) to trigger a light impact when XP is earned. The focus screen does nothing tactile when a session completes.
- `Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)` on task complete.

### 5. Statistics screen → redirect to Shelf or repurpose
The `statistics.tsx` screen still exists but is not reachable from the bottom nav (the nav goes to `history` for Shelf). Either:
- Delete it, or
- Repurpose it as a "Progress Charts" screen and add it to the Sidebar menu.

---

## Medium Effort (half-day each)

### 6. Project / Quest System in the App
The prototype's Home tab shows tiered "quest cards" (projects with progress bars and deadlines). Currently v2's dashboard shows individual tasks, not project-level cards. To properly match the prototype:
- Add a `projects` table in Supabase (`id, user_id, name, tier, icon, color, description, deadline, overall_pct, active`)
- Build a `ProjectCard` component with the progress bar, tier label, deadline pill, "edit %" and "complete ✓" buttons
- Dashboard shows projects, Daily shows tasks (linked to projects via `project_id`)
- This is the biggest missing piece between v2 and the prototype.

### 7. Complete Project → Trophy Shelf flow (in-app)
Right now `completeProject()` in `xpSystem.ts` exists but there's no UI in the app to trigger it. You'd need:
- A "Complete Quest" button on a project card (see #6)
- A modal to pick a trophy emoji (the `TROPHY_ICONS` array is already in `lifeTrackerDesign.ts`)
- After confirm → call `completeProject()`, award +50 XP, remove from active list, show on Shelf

### 8. Focus Bank System
The prototype banks surplus focus minutes when the user exceeds their daily goal. The current focus screen stores this locally but never uses it (there's no "use banked minutes" feature). Full implementation would let users apply banked time to a past day with low minutes.

### 9. Animated SVG Rings
The rings in Focus and FocusTimer currently render without animation — the arc just jumps to its value. Adding a smooth animated transition requires `react-native-reanimated` or `Animated.Value` driving the `strokeDashoffset`.
- The web prototype uses `transition: stroke-dashoffset 0.8s ease` — in React Native this needs a manual animated value.

### 10. Notification for Daily Goal
When the user hasn't reached their focus goal by 8pm, send a push notification: "⚔️ Quest incomplete — 30 minutes left to hit your goal."
- `expo-notifications` is already installed in the project.

---

## Bigger Features (multi-day)

### 11. AI-assisted Task Breakdown
When creating a task in the Daily tab, offer an "Ask AI to break this down" button. The AI (DeepSeek, already connected via chat) generates step-by-step subtasks based on the title. Currently this only works from the chat screen. Building it inline in the task form would be far more useful.

### 12. Offline XP sync
Currently if you complete tasks offline, the `addXP()` call still works (it writes to AsyncStorage), but when the app comes back online it doesn't sync the XP to Supabase. If you want XP to persist across reinstalls, you need a Supabase `user_xp` table with periodic sync.

### 13. Streak Calendar (GitHub-style)
Replace or supplement the 14-day habit dot grid with a full month view — 7 columns × N rows of SVG dots. This is the classic "don't break the chain" calendar and very motivating for habit tracking.

### 14. Level-up Screen
When the user crosses a level boundary (e.g., goes from level 3 to 4), show a full-screen celebration — large level number, confetti, "Level Up!" text. React Native doesn't have built-in confetti but `react-native-confetti-cannon` works well.

### 15. Shared Progress / Social Layer
Allow users to share their Quest Log as a screenshot (using `react-native-view-shot`) or export a weekly summary. For a graduation project presentation, this is a strong demo feature.

---

## Technical Debt

- **`console.log` spam in `dashboard.tsx` (original)**: Removed in the reskin, but worth checking the entire codebase for excessive logging before any demo.
- **`as any` casts in `habits.tsx` and `statistics.tsx`**: These work but should be replaced with proper typed service methods when time allows.
- **`FocusStats` component** (`components/focus/FocusStats.tsx`) is no longer used by the new focus screen — it's dead code. Safe to delete.
- **`BreakTimer` component** (`components/focus/BreakTimer.tsx`) is also unused since the FocusTimer rewrite. Safe to delete or repurpose.
- **`history.tsx` imports `completeProject` and `removeCompletedProject`** but doesn't expose a UI to call them. Add a "remove from shelf" long-press as a hidden admin action.
