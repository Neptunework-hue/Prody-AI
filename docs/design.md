Here's the complete prompt you can use to build this app, structured page by page. Feed each section to your developer or an AI coding tool (like Claude Code) in order.

---

**Master system prompt (include this at the top of every request)**

```
You are building QuestLog — a productivity app styled as a dark RPG quest log.

DESIGN SYSTEM:
- Font: Georgia serif throughout
- Dark mode base colors: --bg:#0f0f14, --bg2:#14141c, --surf:#1e1e2c
- Parchment light mode: --bg:#ede8dc, --surf:#f8f3ea
- Four accent colors: Amber #EF9F27 (XP/primary), Teal #1D9E75 (completion/focus), Blue #378ADD (education), Pink #D4537E (habits)
- All accents have matching bg/border variants: e.g. --abg:rgba(239,159,39,0.11), --abdr:rgba(239,159,39,0.26)
- Text: --tx:#e8e0cc (primary), --tx2:#a09078 (muted), --tx3:#6b5c46 (hints)
- Borders: rgba(232,224,204,0.07) default, 0.14 hover, 0.24 strong
- Cards: background var(--surf), border 1px solid var(--bdr), border-radius 12px, padding 16px
- Tags/badges: small pills with colored bg+border+text using the accent system
- Animations: page transitions use translateY(10px)+opacity slide-in at 280ms cubic-bezier(.4,0,.2,1)
- No gradients, no shadows, no blur — flat surfaces only

STATE: One global JS object `state` holds everything. Every mutation calls `saveState()` which writes to window.storage under key "questlog-v1". On load, call `loadState()` to rehydrate.

STATE SHAPE:
{
  user: { username, displayName, level, totalXP, dailyXP, streak, avatarUrl },
  quests: [ { id, title, tier, progress, deadline, paused } ],
  completedQuests: [ { id, title, tier, completedOn, trophy } ],
  tasks: [ { id, title, questId, xp, done, dueDate, steps:[] } ],
  habits: [ { id, title, goalMinutes, color, xp } ],
  habitLogs: { "habitId_YYYY-MM-DD": value, "habitId_bank": surplus },
  focusLogs: { "YYYY-MM-DD": minutes },
  calendarEvents: [ { id, title, date, time, repeat, type, linkedId } ],
  settings: { autoSync, offlineMode, wifiOnly, theme, notifications },
  lastDate: "YYYY-MM-DD",
  lastSynced: timestamp
}
```

---

**Page 1 — App shell, routing, bottom nav, hamburger drawer**

```
Build the app shell for QuestLog using the design system above.

SHELL STRUCTURE:
- Single <div id="shell"> wrapping everything, applies theme class "lm" when light mode
- Topbar: 48px height, hamburger button (3 lines) on left, page title center, theme toggle pill right
- Content area: flex:1, overflow-y:auto, padding 16px, padding-bottom calc(60px + 16px) to clear bottom nav
- Bottom nav: 60px height, fixed to bottom of shell (not viewport), 5 items: Home, Calendar, Tasks, Habits, Stats
- FAB: amber circle button with ✦ icon, sits above bottom nav right side, only visible on Dashboard page
- Hamburger drawer: slides in from left, 240px wide, overlay behind it closes on tap

BOTTOM NAV BEHAVIOR:
- Amber animated pill slides between active items using getBoundingClientRect() on the active tab
- Pill is position:absolute top:0, height:2px, transitions left+width with cubic-bezier(.4,0,.2,1)
- Active tab label+icon turn amber
- Switching pages triggers slide-in animation on new page div

DRAWER CONTENTS (top to bottom):
- Avatar circle + display name + level/XP
- Nav items: Home (goes to dashboard), Profile, Settings, AI Oracle
- Divider
- Log out (red color)
- Footer: version + sync status

ROUTING:
- navTo(page) function: hides current page div, shows new one with slide-in class, updates topbar title, updates bottom nav active state, hides FAB on non-dashboard pages
- Pages: dashboard, calendar, tasks, habits, stats, focus, ai, profile, settings
- Bottom nav only covers the 5 main pages; focus/ai/profile/settings are accessed via drawer or FAB

THEME TOGGLE:
- Toggles "lm" class on shell
- All colors use CSS variables so they flip automatically
- Persists preference to localStorage key "questlog-theme"
```

---

**Page 2 — Dashboard**

```
Build the Dashboard page for QuestLog.

LAYOUT (top to bottom):
1. Greeting row: "Good evening, [username]" + date + level on left, daily XP tag on right
2. Stat grid (4 columns): Total XP (amber), Streak (teal), Focus today (blue), Habits done (pink)
3. Active Quests card: list of quests with title, tier tag, percentage right-aligned, progress bar below
4. Two-column row:
   - Today's Tasks card: checkboxes, task name, linked quest + XP as meta. Checking triggers strikethrough + color fade
   - (On mobile this stacks vertically)
5. Focus progress card: label + "94/120 min", wide progress bar, "X minutes to goal" subtext

BEHAVIOR:
- Stat values read from state.user and computed from state.tasks/habits/focusLogs
- Daily reset: on load compare state.lastDate to today(). If different, reset dailyXP, un-check all tasks, save
- Checking a task calls completeTask(id): marks done, adds XP to dailyXP + totalXP, updates linked quest progress, triggers floating +XP animation (keyframe: float up + fade out, position absolute center screen)
- Quest progress bars animate width transition on mount
- FAB (✦) is visible here — tapping navigates to AI Oracle page

QUEST PROGRESS CALCULATION:
- When all tasks linked to a quest are done today, auto-increment quest.progress by a small amount (e.g. +5%)
- Completing a quest manually opens a modal: pick trophy emoji, then moves quest to completedQuests, awards +50 XP
```

---

**Page 3 — Calendar**

```
Build the Calendar page for QuestLog.

LAYOUT:
- Month header row with prev/next arrow buttons and month+year label
- Calendar grid card: 7 columns (Su–Sa), day cells as aspect-ratio:1 squares
- Event panel card below (or beside on wide screens): shows events for selected day + upcoming list
- "Add to this date" button at bottom of event panel

DAY CELL STATES:
- Default: hover shows subtle background
- Today: amber background tint + amber border
- Selected: solid amber background, dark text
- Has event: small teal dot at bottom center (::after pseudo-element)
- Other month: muted text color

EVENT PANEL:
- Title: "April [day] — Events"
- Each event: colored dot (matches event type color) + title + time + category meta
- Upcoming section below current day events

ADDING EVENTS (Schedule Modal):
- Triggered by "+ Add to this date" button OR by "+ Cal" buttons on tasks/habits pages
- Modal fields: Item name (pre-filled if coming from task/habit), Date picker, Time picker, Repeat dropdown (None/Daily/Weekly/Weekdays)
- On confirm: push to state.calendarEvents, re-render event panel, navigate to calendar, close modal
- Modal uses a normal-flow backdrop div (min-height:400px, dark overlay) — NOT position:fixed

READING STATE:
- On mount, read state.calendarEvents and group by date string "YYYY-MM-DD"
- Has-event dots are driven by whether any event exists for that day
- Habit completions also appear as events if habit has calendarEvents entries
```

---

**Page 4 — Tasks**

```
Build the Tasks page for QuestLog.

LAYOUT:
- Header row: "Tasks" title + open count tag (amber) + done count tag (teal)
- Filter row: All / Today / This week / By quest (pill buttons, active one gets amber border)
- Tasks card with list of task rows
- Add task input row at bottom of card

TASK ROW STRUCTURE:
- Checkbox (17px, rounded square, teal when done)
- Task title (strikethrough + muted color when done)
- Meta line: due date · linked quest · XP reward
- "+ Cal" button (small, right side): opens schedule modal pre-filled with task name

COMPLETING A TASK:
- toggleTask(id): mark done in state, add XP, update linked quest progress, trigger +XP flash, re-render
- Done tasks move visually to bottom or get a "completed" section separator

ADDING A TASK:
- Input at bottom: type task name, press Enter or Add button
- After name, optionally pick: linked quest (dropdown from state.quests), due date, XP value
- Saves to state.tasks with a generated ID

SUB-STEPS:
- Each task can have steps array
- Expanding a task shows step checkboxes
- Completing all steps auto-completes the parent task
- toggleStep(taskId, stepIndex) recalculates completion

SCHEDULE TO CALENDAR:
- "+ Cal" opens the shared schedule modal
- On confirm, creates a calendarEvent linked to the task ID
- The calendar page will show this event with a task-type dot color
```

---

**Page 5 — Habits**

```
Build the Habits page for QuestLog.

LAYOUT:
- Header: "Habits" + today's completion count tag
- One card per habit

HABIT CARD STRUCTURE:
- Top row: habit name left, XP tag + "+ Cal" button right
- Meta line: daily goal (e.g. "30 min/day") + completion rate percentage
- 14-day dot row: small circles representing last 14 days
- Log today button or input: tap to log today's value

DOT STATES:
- Done (value >= goal): solid teal circle
- Partial (value > 0 but < goal): amber tint circle
- Empty: just a border
- Dots are clickable: tapping a past empty dot opens the bank-spend modal

BANK MECHANIC:
- If logged value > goal, surplus goes to state.habitLogs["habitId_bank"]
- Bank modal: shows banked amount, lets user spend it to fill a past incomplete dot
- spendBank(habitId, date): deducts from bank, marks that date as complete

LOGGING:
- logHabit(habitId, value): writes to state.habitLogs["habitId_YYYY-MM-DD"], recalculates streak and rate, awards XP if goal met, saves state

SCHEDULE TO CALENDAR:
- "+ Cal" opens schedule modal pre-filled with habit name
- Repeat defaults to "Daily" for habits
- On confirm, creates recurring calendarEvents for this habit

ADDING A HABIT:
- "New habit" button at bottom
- Fields: name, daily goal (minutes or count), unit, color (pick from 4 accents), XP reward
- Saves to state.habits
```

---

**Page 6 — Focus timer**

```
Build the Focus page for QuestLog. This page is accessed from the drawer or via a shortcut, not the bottom nav.

LAYOUT:
- Page title "Focus Session" + subtitle
- Single card containing everything

PRESET BUTTONS:
- Row of pill buttons: 15 / 25 / 45 / 60 / 90 min
- Tapping one sets focusDur and resets timer, highlights that pill (teal)
- Custom input: number field + "minutes" label, updates on change

SVG RING TIMER:
- 140x140px SVG, two concentric circles
- Outer track: low-opacity stroke
- Inner arc: teal stroke, uses strokeDasharray=364 (circumference of r=58 circle)
- strokeDashoffset = 364 * (1 - elapsed/total) — animates with CSS transition 0.5s
- Center text: MM:SS countdown
- Sub-text below: "Ready" / "In session" / "Complete!"

TIMER CONTROLS:
- Start/Pause button: toggles focusRunning, text changes to "Pause" / "Resume"
- Reset button: red tint, resets focusLeft to focusDur*60, stops interval
- Timer uses setInterval every 1000ms, decrements focusLeft
- On complete: clear interval, show "Complete!" in ring, add session minutes to state.focusLogs[today], award XP

DAILY PROGRESS:
- Below controls: "Today's total: X min" label
- Progress bar showing focusLogs[today] / user's daily focus goal
- Subtext: "X% of Y min daily goal"

STATE INTEGRATION:
- On session complete: focusLogs[today] += sessionMinutes, save state
- Dashboard focus bar reads from same focusLogs[today]
- If daily goal exceeded, show "Goal reached!" teal badge
```

---

**Page 7 — Statistics**

```
Build the Statistics page for QuestLog.

LAYOUT:
- Header + time range filter pills (30 days / 90 days / All time)
- 4-column stat grid: Total XP, Quests done, Focus hours, Habit rate
- XP over time chart (line chart)
- Focus minutes daily chart (bar chart)
- Bottom row (3 columns): Quest tiers donut, Habit completion bars, Level progression

CHARTS (Chart.js):
- XP line chart: 30 data points, amber line, subtle amber fill, no point dots, smooth tension 0.4
- Focus bar chart: 30 bars, teal color, rounded top corners (borderRadius:3)
- Quest tier donut: 4 segments (Career amber, Education blue, Health teal, Skill pink), 65% cutout, custom HTML legend below
- All charts: disable default legend, dark grid lines rgba low opacity, muted tick labels

DATA SOURCE:
- XP chart: iterate state from (today - 30 days), sum dailyXP entries (store daily snapshots in state.xpHistory)
- Focus chart: read state.focusLogs for each date in range
- Habit rate: for each habit, count days where log >= goal / total days in range
- Quest tiers: count quests by tier field

HABIT COMPLETION BARS:
- One row per habit: name left, percentage right (colored to match habit accent), progress bar
- Bars animate width on mount using CSS transition

LEVEL PROGRESSION CARD:
- Current level badge (amber square with number)
- Level title (e.g. "Scholar of the Realm")
- XP bar: current XP within this level / XP needed for next level
- Tags: streak, quest count, focus hours

RESPONSIVE: on narrow screens, bottom row stacks to single column
```

---

**Page 8 — AI Oracle chat**

```
Build the AI Oracle page for QuestLog. This is accessed via the FAB on Dashboard or via the drawer.

LAYOUT:
- Header: "AI Oracle" + "Online" teal badge
- Suggestion chips row: 5 quick-action chips (scrollable on narrow screens)
- Chat message area (min-height 220px, dark bg2 surface)
- Input row at bottom: text input + Send button

MESSAGE STRUCTURE:
- AI messages: amber avatar circle "AI" + bubble (surf bg, border)
- User messages: right-aligned, blue avatar "U" + bubble (blue tint bg, border)
- Typing indicator: 3 animated dots (staggered opacity pulse)

SUGGESTION CHIPS:
- "How am I doing?" 
- "Schedule my workout for tomorrow at 7am"
- "Add a focus session at 2pm"
- "What to focus on today?"
- "Motivate me"
- Tapping a chip fills input and sends immediately

API INTEGRATION (production):
- POST to https://api.anthropic.com/v1/messages
- Model: claude-sonnet-4-20250514, max_tokens: 1000
- System prompt includes full state context:
  "You are the QuestLog AI Oracle. The user's current state: [JSON.stringify(state)]. 
   You can schedule events, add tasks, log habits, and give advice.
   When the user asks to schedule or create something, respond with a JSON action block alongside your reply:
   { reply: string, action: { type: 'create_calendar_event'|'add_task'|'log_habit'|'start_focus', ...fields } }
   Parse natural language dates ('tomorrow', 'next Monday', '7am') into ISO format."
- After receiving response: display reply text, parse action block, call the appropriate state mutation function

ACTION HANDLERS:
- create_calendar_event(data): pushes to state.calendarEvents, saves
- add_task(data): pushes to state.tasks, saves
- log_habit(habitId, value): calls logHabit(), saves
- start_focus(minutes): navigates to focus page, sets duration

CONVERSATION HISTORY:
- Maintain messages array in component state
- Send full history on every API call (up to last 20 messages to manage token count)
- Display loading state (typing dots) while waiting for response
```

---

**Page 9 — Profile**

```
Build the Profile page for QuestLog. Accessed via the hamburger drawer.

LAYOUT:
- Avatar section: ring with amber border, clickable to upload photo, display name + level + XP below
- XP progress bar: current XP in level / total needed, "Level X+1" label
- Tags: PRO badge, streak badge
- Edit Profile card: Username input, Display Name input, Save button, success message
- Stats overview: 4 small stat boxes (Quests done, Streak, Focus hours, Habits)
- Preferences card: Accent color dots (4 colors, click to select), Daily XP goal, Focus goal, Notifications toggle
- Danger zone card: Delete account button (red tint)

AVATAR UPLOAD:
- Hidden <input type="file" accept="image/*">
- Clicking avatar ring triggers file input click
- FileReader reads as DataURL, sets as img src inside ring div, saves URL to state.user.avatarUrl

SAVING PROFILE:
- saveProfile(): reads input values, updates state.user.username + displayName, saves state
- Updates display name shown in drawer avatar section and dashboard greeting
- Shows inline success message for 3 seconds

ACCENT COLOR:
- Clicking a color dot updates state.settings.accentColor
- App re-applies accent (in full implementation, this swaps --amber CSS variable to chosen color)
- Selected dot gets a ring/border indicator
```

---

**Page 10 — Settings**

```
Build the Settings page for QuestLog. Accessed via the hamburger drawer.

LAYOUT:
- Sync warning banner (conditional): amber tint, "Sync incomplete · Last synced X hours ago" + "Sync now" button
- Sync & Offline card
- Notifications card
- Appearance card
- Danger zone card

SYNC & OFFLINE CARD:
- Toggle: Auto-sync (default on)
- Toggle: Offline mode
- Toggle: Sync on wifi only
- Row: "Last synced" + timestamp (reads from state.lastSynced)

MANUAL SYNC BUTTON:
- In the warning banner when auto-sync has failed
- On click: button shows "Syncing..." disabled state
- After 1.8s simulated delay (real: await syncToServer()):
  - Update state.lastSynced to Date.now()
  - Hide the warning banner
  - Update "Last synced" row to "Just now"
  - Update drawer footer sync status to teal "Synced"

OFFLINE MODE LOGIC (production):
- Service worker intercepts all fetch calls
- When offline: queue mutations in IndexedDB under "pending-ops" key
- When back online: replay queue in order against the API
- Show banner if (Date.now() - state.lastSynced) > 2 hours OR if pendingOps.length > 0

NOTIFICATIONS CARD:
- Daily reminders toggle
- Streak alerts toggle  
- Focus end bell toggle
- Each toggle writes to state.settings

APPEARANCE CARD:
- Theme: shows current ("Dark RPG" or "Parchment RPG") — clicking opens theme toggle
- Font: static display "Georgia serif"

DANGER ZONE:
- "Clear all local data": confirm dialog, then clears window.storage, resets state to defaults, navigates to sign-in

TOGGLE COMPONENT:
- 34x18px pill, transitions background and ::after position
- On state: teal bg + teal knob at right
- Off state: surf2 bg + muted knob at left
```

---

**Page 11 — Sign In / Sign Up**

```
Build the Auth pages for QuestLog.

TWO STATES: sign-in view and sign-up view, toggled by a link at the bottom of each form.

SIGN IN LAYOUT:
- Title "Welcome back, Hero" + subtitle
- Error/success message area (hidden by default, slides in on validation)
- Email input
- Password input
- "Forgot password?" link (right-aligned, amber)
- "Keep me signed in" checkbox row
- "Enter the Realm" primary button (full width, amber)
- Divider "or continue with"
- Two social buttons: Google, GitHub (side by side)
- "No account yet? Begin your quest →" link

SIGN UP LAYOUT:
- Title "Begin Your Quest" + subtitle
- First name + Last name (2-column grid)
- Username input
- Email input
- Password input + strength meter (4 segments, color-coded: red/amber/teal/blue as strength increases)
- Strength label text ("Weak — easy to crack" up to "Unbreakable — legendary")
- "Create Hero Profile" button
- "Already have an account? Sign in →" link

VALIDATION:
- On submit: check required fields, show inline error in message area
- Password strength: score based on length + uppercase + numbers + special chars
- Success: show success message, simulate auth, navigate to dashboard

PASSWORD STRENGTH SEGMENTS:
- 4 divs, height:3px, flex:1, border-radius 2px
- Score 1: segment 1 red
- Score 2: segments 1-2 amber
- Score 3: segments 1-3 teal
- Score 4: all 4 blue
```

---

**Final integration prompt**

```
Now wire everything together for QuestLog:

1. STATE PERSISTENCE: implement loadState() and saveState() using window.storage.get/set under key "questlog-v1". On app mount, call loadState() and if null, initialize with default state. Every mutation calls saveState() after updating.

2. DAILY RESET: on every app mount, compare state.lastDate to today(). If different, call resetDaily(): set dailyXP=0, un-check all tasks and steps, reset dailyHabitLogs for today, update lastDate, saveState.

3. XP SYSTEM: centralizeawardXP(amount) function: increments totalXP and dailyXP, checks if totalXP crosses the next level threshold (every 5000 XP), if so increments level and saves. All task completion, habit logging, and focus sessions call this.

4. LEVEL THRESHOLDS: level = Math.floor(totalXP / 5000) + 1. XP within level = totalXP % 5000. Display as "X / 5000 XP" progress bar.

5. CROSS-PAGE REACTIVITY: after any state mutation, call refreshCurrentPage() which re-renders only the active page's dynamic elements (stat numbers, quest bars, task lists). No full re-render needed.

6. CALENDAR ↔ TASKS ↔ HABITS: calendarEvents array is the single source of truth. Tasks and habits with scheduled events have a calendarEventIds array. Deleting a task removes its calendar events. Completing a recurring habit event marks that habit as logged for that day.

7. AI ORACLE ACTIONS: after each API response, parse the action field. Route to: createCalendarEvent(), addTask(), logHabit(), navigateToFocus(). Show a brief confirmation toast at top of screen when an AI action fires.

8. SYNC STATUS: update state.lastSynced on every successful saveState(). If the app is opened and (Date.now() - lastSynced) > 7200000 (2 hours), show the sync warning banner in Settings and a small dot indicator in the drawer footer.

9. THEME PERSISTENCE: on mount, read localStorage "questlog-theme". If "light", add "lm" class to shell immediately before first paint to avoid flash.

10. NAVIGATION GUARD: if state.user is null (not logged in), always redirect to auth page regardless of requested route.
```

---