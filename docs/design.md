# Life Tracker — Full Design Breakdown

## The Core Concept

The app is built around a single metaphor: *your life as an RPG quest log*. Everything — projects, tasks, habits, focus time — feeds into one unified progression system (XP + levels). This framing does something practical: it turns abstract goals like "finish my capstone" into something with visible momentum and rewards.

---

## Data Architecture

The entire app lives in *one state object*. There's no backend, no database — everything is stored in window.storage (Claude's artifact persistence layer) as a single JSON blob under a key like "life-tracker-v5". Every user action calls a save() function that overwrites that blob.

The state object has these top-level fields:

- totalXP / dailyXP — cumulative and today's earned XP
- lastDate — used to detect when the day has rolled over and reset daily tasks
- projects — array of active and paused quests with progress percentages
- completedProjects — permanently archived completed quests (the trophy shelf)
- dailyTasks — today's to-do items, each linked to a project and carrying an XP reward
- habits — the habit definitions (name, goal, unit, color)
- habitLogs — a flat key-value map: "habitId_YYYY-MM-DD" → logged value, plus "habitId_bank" for surplus
- focusLogs — same pattern: "YYYY-MM-DD" → minutes logged that day
- pipeline — backlog items not yet active

The choice of a flat key-value map for habitLogs instead of nested objects was deliberate — it makes lookups for any given day trivially simple (habitLogs["reading_2026-03-25"]) without traversal.

---

## The Five Tabs

*Home* is the command center. It shows all active projects as cards with progress bars, tier filter buttons, deadline pills that change color as urgency increases (gray → amber → red), and a paused section below. The pipeline also previews here with an "activate →" button that moves an item from the backlog into active projects.

*Focus* is a Pomodoro-style deep work tracker. It has two layers: a large ring showing how much of your daily goal you've completed (filled with green as you log minutes), and a smaller countdown ring for the active session itself. The session timer counts down in real time using setInterval inside a useEffect. When a session ends — either naturally or manually — the elapsed minutes are added to focusLogs[today]. If you exceed your daily goal, the overflow goes into a "banked" pool. The weekly bar chart expands when you tap the daily goal card.

*Daily* is your task board. Each task can have sub-steps. Completing all steps auto-marks the task done, fires a flash animation (+20 XP), adds to your XP total, and updates the linked project's progress percentage. The step-level checkboxes use toggleStep() which recalculates completion on every click. Tasks with no steps have a direct click-to-complete checkbox instead.

*Habits* is the most visually rich tab. Each habit shows 14 day-dots rendered as SVG pie slices — the filled arc represents the ratio of logged value to daily goal. Fully completed days are solid circles. The bank mechanic is notable: if you log 80 minutes on a 30-minute reading habit, the extra 50 goes into your "bank." You can then tap any incomplete past dot and spend banked minutes to retroactively fill it. This is handled by the spendBank() function and a modal.

*Shelf* is the archive. When you mark a project complete, you pick a trophy emoji, it moves from projects to completedProjects with a completedOn date, and earns +50 XP. The shelf displays all trophies in a visual grid at the top and detailed cards below.

---

## Key React Patterns Used

*Single source of truth with optimistic updates.* setState and save() are always called together. The UI updates immediately from local state; the window.storage write happens asynchronously in the background. There's no loading state between actions.

*Daily reset via pure function.* resetDaily() takes the current state and returns a modified copy if lastDate !== today(). It resets dailyXP and un-checks all tasks and steps. This runs on every render and saves back if a reset actually occurred. No cron job, no server — just a date comparison on load.

*Derived values, not stored state.* Things like avgPct, doneTasks, focusStreak, and filteredProjects are computed fresh from state on every render. They're never stored in the blob — this keeps the data model clean and prevents stale derived values.

*Modal pattern.* The three modals (bank spend, project complete, edit percentage) are controlled by state variables that hold either null (closed) or the ID of the item being acted on. The modal JSX uses an immediately-invoked function expression ({bankModal && (() => { ... })()}) to access the derived item data without needing a separate component.

---

## Visual Design Decisions

The aesthetic is *dark RPG terminal* — #0f0f14 background, Georgia serif font (intentionally unusual for a productivity app — it gives it weight and personality), warm parchment text (#e8e0cc), and a four-color accent system:

- Amber #EF9F27 — XP, money tier, primary actions
- Teal #1D9E75 — completion, focus, professional tier
- Blue #378ADD — education tier, progress
- Pink #D4537E — habits tier, streaks

Progress bars are a custom Bar component — just two divs with a CSS transition on width. The day-dot circles are hand-drawn SVGs using trigonometry: given an angle (ratio × 360°), the code calculates arc endpoint coordinates and draws a pie-slice path. The focus rings use SVG strokeDasharray / strokeDashoffset — standard technique where the dash length equals the circumference, and the offset controls how much is "filled."

The XP flash animation is a keyframe defined inline (@keyframes fu) that floats the text upward while fading out — positioned fixed at the center of the screen, pointer-events disabled so it doesn't interfere with clicks.
