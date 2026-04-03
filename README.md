# ProdyAI

**ProdyAI** is a cross-platform **productivity app** for iOS, Android, and web. It helps you manage **tasks** (with subtasks), run **focus / Pomodoro sessions**, track **habits**, browse a **calendar**, and use an **AI chat** for planning help. The experience is framed like a **quest log** (dark RPG-style UI—see `design.md`).

Accounts and cloud data use **Supabase** (auth + database). Tasks can be **cached offline** and synced when you reconnect.

---

## What it does

| Area | Description |
|------|-------------|
| **Home (Dashboard)** | Today’s work, streaks, quick task access, chat FAB |
| **Daily (Tasks)** | Task board with priorities, deadlines, subtasks, drag reorder |
| **Focus** | Timers, session logging, focus statistics |
| **Habits** | Recurring habits; optional local reminders (full push needs a [dev build](https://docs.expo.dev/develop/development-builds/introduction/)) |
| **Shelf (History)** | Archive of completed / failed tasks |
| **Calendar** | Task / time overview |
| **Statistics** | Focus, tasks, and habit summaries |
| **Chat** | AI-assisted prompts (wire your API/keys as you implement) |
| **Profile & settings** | Profile, offline-related options, sign out |

Secondary navigation (e.g. calendar, stats, chat) is available from the **sidebar menu**; the **bottom bar** covers the five main tabs: Home, Daily, Focus, Habits, Shelf.

---

## Tech stack

- **Expo SDK 54** · **Expo Router** · **TypeScript**
- **React Native Paper** (UI)
- **Supabase** (authentication, Postgres, realtime where used)
- Offline task storage + sync (see `services/offline/`)

---

## Prerequisites

- **Node.js** (LTS recommended, e.g. 20.x+)
- **npm**
- A **Supabase** project (free tier is fine) for login and synced data
- **Expo Go** on a phone for quick testing, or an emulator/simulator; use a **development build** if you need full push notifications (Expo Go has limits on SDK 53+)

---

## Setup

### 1. Install dependencies

```sh
git clone <your-repo-url>
cd ProdyAI
npm install
```

### 2. Configure Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. In **Project Settings → API**, copy:
   - **Project URL**
   - **anon public** key (JWT starting with `eyJ…`)
3. Paste them into both client files so they stay in sync:
   - `services/supabase/supabase.ts`
   - `services/supabase/client.ts`  

   Replace `supabaseUrl` and `supabaseAnonKey` with your values.

4. Run the SQL your app expects (tables such as `profiles`, tasks, focus sessions, habits, etc.). Reference SQL snippets under `docs/` if present in your repo, or align with `docs/context.md`.

5. Enable **Email** auth (or your chosen providers) under **Authentication → Providers** in Supabase.

### 3. Run the app

```sh
npm start
```

Then:

- Press **`a`** — Android emulator  
- Press **`i`** — iOS simulator (macOS)  
- Scan the QR code — **Expo Go** on a physical device  

Other scripts:

```sh
npm run android   # expo start --android
npm run ios       # expo start --ios
npm run web       # expo start --web
npm run doctor    # Expo compatibility check (expo-doctor)
```

### 4. Verify the project

```sh
npm run doctor
```

You should see all checks passing once dependencies and config match **Expo SDK 54**.

---

## Deploying

- **Web**: `npm run deploy` runs `expo export` and can push via EAS (see [EAS Hosting](https://docs.expo.dev/eas/hosting/introduction/)).
- **iOS / Android stores**: use [EAS Build](https://docs.expo.dev/build/introduction/) (`eas.json` is included).

---

## Troubleshooting

- **`Network request failed` / 521-style errors** — Confirm the Supabase project is not paused, URL/key are correct, and the device has internet.
- **Push notifications in Expo Go** — Use a **development build** for full `expo-notifications` behavior.
- **More detail** — See `docs/context.md` (product/spec) and `design.md` (UI framing).

---

## License

Private project unless you add an explicit open-source license.
