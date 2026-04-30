# ProdyAI

**ProdyAI** is a cross-platform **productivity app** for iOS, Android, and web. It helps you manage **tasks** (with subtasks), run **focus / Pomodoro sessions**, track **habits**, browse a **calendar**, and use an **AI chat** for planning help. The experience follows the **QuestLog** design system (dark RPG quest log — see `docs/design.md`).

Accounts and cloud data use **Supabase** (auth + database). Tasks can be **cached offline** and synced when you reconnect.

---

## What is ProdyAI?

ProdyAI is a single place to **plan work**, **stay on task**, and **see progress**—with optional **AI assistance** (chat, task tooling, and voice features powered by **OpenAI**). It is built with **Expo** and **React Native**, so one codebase runs on phones and the web.

---

## What problem does it solve?

| Problem | How ProdyAI helps |
|--------|-------------------|
| **Scattered tools** | Tasks, calendar, habits, focus time, and AI help live in one app instead of many apps and notes. |
| **Losing work offline** | Tasks are cached locally and **sync when you are back online** (see `services/offline/`). |
| **Hard to stay focused** | **Focus / Pomodoro** flows and session logging support deep work without juggling timers elsewhere. |
| **Planning overload** | **AI Oracle** can answer questions, break down work, and use tools that tie into your task data (with your API keys configured). |
| **No clear picture of progress** | **Dashboard**, **stats**, and **streaks** summarize tasks, habits, and focus so you see momentum. |

---

## What it does

| Area | Description |
|------|-------------|
| **Home (Dashboard)** | Today’s work, streaks, quick task access; **FAB** opens AI Oracle |
| **Calendar** | Month grid and events |
| **Tasks** | Task board with priorities, deadlines, subtasks, drag reorder |
| **Habits** | Recurring habits; optional local reminders (full push needs a [dev build](https://docs.expo.dev/develop/development-builds/introduction/)) |
| **Stats** | Focus, tasks, and habit summaries |
| **Focus** | Timers, session logging (drawer) |
| **Shelf (History)** | Archive of completed / failed tasks (drawer) |
| **AI Oracle** | AI-assisted chat (drawer + FAB on Home); voice uses device TTS via **expo-speech** |
| **Profile & settings** | Profile, offline-related options, sign out |

**Bottom navigation** (five tabs): **Home · Calendar · Tasks · Habits · Stats**. **Drawer**: Focus, Shelf, Profile, Settings, AI Oracle, Log out.

---

## Recent updates

*Snapshot of the **current codebase** (April 2026). Update this section when you ship meaningful changes.*

- **Expo SDK 54** with **React 19** and **Expo Router** file-based navigation.
- **QuestLog / life-tracker** UI theme (light + dark) via `AppThemeProvider` and `lifeTrackerDesign`.
- **AI Oracle**: OpenAI-backed chat, tool/agent loop for task-aware actions, optional **Whisper** transcription (see `.env.example`).
- **Offline-first tasks**: local cache and sync when connectivity returns.
- **Supabase** auth and data layer for profiles, tasks, focus sessions, habits, and related tables (SQL references under `docs/`).

---

## Tech stack

- **Expo SDK 54** · **Expo Router** · **TypeScript**
- **React Native Paper** (UI)
- **Supabase** (authentication, Postgres, realtime where used)
- **OpenAI** (chat + transcription where configured)
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

### 2. Environment variables (`.env`)

1. Copy the example file and fill in your values:

   **macOS / Linux**

   ```sh
   cp .env.example .env
   ```

   **Windows (PowerShell)**

   ```powershell
   Copy-Item .env.example .env
   ```

2. Set at least:
   - **`EXPO_PUBLIC_OPENAI_API_KEY`** — OpenAI API key for AI chat and transcription ([API keys](https://platform.openai.com/api-keys)).
   - **`EXPO_PUBLIC_SUPABASE_URL`** and **`EXPO_PUBLIC_SUPABASE_ANON_KEY`** — from Supabase **Project Settings → API** (use the **anon public** key; it is safe to ship in a client app but keep out of public repos).

3. Optional: **`EXPO_PUBLIC_WHISPER_LANGUAGE`** — ISO-639-1 language code for Whisper (defaults to `en`).

Expo reads **`EXPO_PUBLIC_*`** variables from `.env` when Metro starts; **restart Expo** after editing `.env`. The file `.env` is gitignored; commit **`.env.example`** only.

### 3. Configure Supabase (project & SQL)

1. Create a project at [supabase.com](https://supabase.com) if you do not have one yet.
2. Put **Project URL** and **anon** key into `.env` as above (not in source files).

3. Run the SQL your app expects (tables such as `profiles`, tasks, focus sessions, habits, etc.). Reference `docs/supabase_full_setup.sql` and `docs/context.md` as needed.

4. Enable **Email** auth (or your chosen providers) under **Authentication → Providers** in Supabase.

### 4. Run the app

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

### 5. Verify the project

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
