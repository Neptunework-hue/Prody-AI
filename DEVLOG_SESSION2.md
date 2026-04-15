# DEVLOG — Session 2: Getting the App Running
**Date:** April 14–15, 2026  
**Goal:** Get ProdyAI (Mark III) running on Expo Go and fix all startup blockers

---

## What We Were Trying To Do
Run the app on a phone using Expo Go after the RPG reskin from Session 1. The QR code would scan but nothing would appear, or the app would crash immediately.

---

## Errors We Hit (in order) and How We Fixed Them

---

### 1. PowerShell blocked `npm`
**Error:** `npm : File C:\Program Files\nodejs\npm.ps1 cannot be loaded because running scripts is disabled`  
**Why:** Windows PowerShell blocks `.ps1` scripts by default for security reasons.  
**Fix:** Switch to **Command Prompt** (CMD) instead of PowerShell in the VS Code terminal. Click the dropdown arrow next to `+` in the terminal panel and select Command Prompt.  
**Lesson:** Always use CMD for running npm commands on Windows, not PowerShell.

---

### 2. `expo` command not found
**Error:** `'expo' is not recognized as an internal or external command`  
**Why:** `node_modules` hadn't been installed yet. Expo CLI lives inside node_modules.  
**Fix:** Run `npm install` first, then `npm start`.  
**Lesson:** Any time you clone a project or start fresh, always run `npm install` before anything else.

---

### 3. Wrong directory
**Error:** npm ran but the wrong project started (or it failed to find files)  
**Why:** The terminal was in `Prody-AI-version2/` (the parent folder), not `Prody-AI-version2/Mark III/` (the actual project).  
**Fix:** `cd "Mark III"` then `npm start`.  
**Lesson:** Always check your terminal path matches the folder with `package.json` in it.

---

### 4. Development Build vs Expo Go confusion
**Error:** App didn't load; terminal showed Android SDK errors  
**Why:** The terminal defaulted to "development build" mode which expects Android Studio / a real device with a custom build. We're using Expo Go instead.  
**Fix:** After running `npm start`, press **`s`** in the terminal to switch to Expo Go mode. The label at the top should say `Using Expo Go`.  
**Lesson:** Always press `s` to confirm Expo Go mode before scanning the QR code.

---

### 5. "Failed to download remote update" on phone
**Error:** Expo Go scanned the QR but showed a blue error screen about a remote update  
**Why:** The `app.json` had `"owner": "neptune249"` (the original developer's Expo account) and an EAS `projectId`. Expo Go saw these and tried to fetch a published build from that account's EAS server instead of loading the local bundle.  
**Fix:** Removed `owner` and `extra.eas.projectId` from `app.json`, and added `"updates": { "enabled": false }`.  
**Lesson:** When you clone someone else's Expo project, remove their `owner` field and EAS project ID from `app.json` before running locally.

---

### 6. Duplicate `useAuth` files causing `AuthProvider` to be undefined
**Error:** `Element type is invalid: expected a string or class/function but got: undefined. Check the render method of Layout`  
**Why:** There were two files: `hooks/useAuth.ts` (a plain hook, no AuthProvider) and `hooks/useAuth.tsx` (a Context Provider version). Metro bundler prefers `.ts` over `.tsx`, so it always loaded the one without `AuthProvider`. When `_layout.tsx` tried to use `AuthProvider` it was `undefined` → crash.  
**Fix:** Removed the `AuthProvider` import from `_layout.tsx` entirely. The app's auth is handled by the plain hook (`useAuth.ts`) which each screen calls directly — no Provider wrapper needed.  
**Lesson:** Never have two files with the same name but different extensions (`.ts` vs `.tsx`) in the same folder. Metro will always pick one and ignore the other.

---

### 7. Supabase tables missing
**Error:** App screens crashed; console showed `relation "subtasks" does not exist`, `relation "habit_logs" does not exist`  
**Why:** The Supabase database had a partial schema — some tables existed from a previous run, others didn't. The `CREATE TABLE IF NOT EXISTS` commands were silently skipped for tables that already existed, even if those tables were incomplete.  
**Fix:** Ran a complete SQL script in Supabase SQL Editor that created all missing tables (`subtasks`, `habits`, `habit_logs`, `focus_sessions`) and set up all RLS policies.  
**Lesson:** Always run the complete database setup SQL in Supabase before testing. If you get schema errors, check the Table Editor in Supabase to confirm each table exists with the right columns.

---

### 8. RLS blocking user registration
**Error:** "Error checking username availability" during signup  
**Why:** Row Level Security (RLS) was enabled on the `profiles` table, but there was no policy allowing unauthenticated (anon) users to read from it. The registration code tries to check if a username is already taken before the user is logged in — but RLS blocked the query.  
**Fix:** Added a policy: `create policy "Usernames are publicly readable" on profiles for select using (true);`  
**Lesson:** When enabling RLS, think about which operations need to work for unauthenticated users (like checking username availability during signup). Add explicit `select` policies for those cases.

---

### 9. Supabase dashboard user creation failing
**Error:** "Failed to create user: Database error creating new user" when trying to add a user from the Supabase dashboard  
**Why:** The database trigger `handle_new_user` (which auto-creates a profile when a user signs up) was failing because the `profiles` table was missing the `username` column. The `CREATE TABLE IF NOT EXISTS` skipped recreating it, so the old version without `username` was still in place.  
**Fix:** Added the missing column: `alter table profiles add column if not exists username text;`  
**Lesson:** `CREATE TABLE IF NOT EXISTS` only creates the table if it doesn't exist — it will NOT add missing columns to an existing table. If you change your schema, use `ALTER TABLE ADD COLUMN IF NOT EXISTS` to add new columns.

---

### 10. Double profile insert causing 409 conflict
**Error:** After registration, console showed 409 (Conflict) on profile insert  
**Why:** The database trigger (`handle_new_user`) automatically creates a profile row when a new auth user is created. But the `signUp` function in `useAuth.ts` was ALSO manually inserting a profile. Both ran → duplicate key error.  
**Fix:** Removed the manual profile insert from `signUp` in `useAuth.ts`. The trigger handles it.  
**Lesson:** If you have a database trigger that handles something automatically, don't also do it manually in code. Pick one place.

---

### 11. Bottom navigation overlapping phone system buttons
**Error:** The bottom nav bar overlapped the Android gesture navigation bar  
**Why:** The nav bar used a hardcoded `paddingBottom: 8` for Android, which isn't enough on phones with gesture navigation (which needs 24–34px of clearance).  
**Fix:** Used `useSafeAreaInsets()` from `react-native-safe-area-context` to dynamically read the phone's bottom inset and apply it as padding.  
**Lesson:** Never hardcode bottom padding on mobile. Always use `useSafeAreaInsets().bottom` to handle the notch/home bar on both iOS and Android.

---

### 12. Habits `daily_goal` column missing
**Error:** "Could not find the 'daily_goal' in the schema cache" when creating a habit  
**Why:** Same as issue #9 — the `habits` table was created from an older schema that didn't have `daily_goal`. Our `CREATE TABLE IF NOT EXISTS` was skipped.  
**Fix:** `alter table habits add column if not exists daily_goal integer default 1;`

---

### 13. Chat bot not working on web (CORS)
**Why:** The DeepSeek API doesn't allow browser requests (CORS policy). When you call an external API directly from a web browser, the browser blocks it unless the API server explicitly allows it.  
**Expected behavior:** The chatbot works on the phone (Expo Go / React Native ignores CORS) but will not work on web. This is normal.  
**Lesson:** Direct API calls to third-party services (OpenAI, DeepSeek, etc.) should go through a backend server in production, not directly from the client. For mobile-only apps this isn't a problem.

---

## Summary of All Files Changed This Session

| File | What Changed |
|------|-------------|
| `app/_layout.tsx` | Removed AuthProvider (it wasn't needed and caused crash) |
| `app.json` | Removed `owner`, removed EAS `projectId`, added `updates.enabled: false` |
| `hooks/useAuth.ts` | Removed manual profile insert (trigger handles it) |
| `hooks/useAuth.tsx` | Kept as-is (unused but not deleted) |
| `components/BottomNavBar.tsx` | Used `useSafeAreaInsets` for proper bottom padding |
| `app/(auth)/forgot-password.tsx` | Created this missing screen |

---

## Supabase SQL Run This Session

```sql
-- Added missing tables
create table if not exists subtasks (...);
create table if not exists habits (...);
create table if not exists habit_logs (...);
create table if not exists focus_sessions (...);

-- Added missing columns
alter table profiles add column if not exists username text;
alter table habits add column if not exists daily_goal integer default 1;

-- Added RLS policies
create policy "Usernames are publicly readable" on profiles for select using (true);
create policy "Service can insert profiles" on profiles for insert with check (true);
```

---

## How to Open and Run This Project Next Time

### Every time you want to work on the app:
1. Open VS Code
2. Open a **Command Prompt** terminal (not PowerShell)
3. `cd "C:\DEV\AI-GRAD-PROJECT\Prody-AI-version2\Mark III"`
4. `npm start`
5. Press **`s`** if it doesn't say "Using Expo Go" already
6. Open Expo Go on your phone → scan the QR code

### If it's your first time on a new machine:
1. `npm install` (only needed once, or after deleting node_modules)
2. Then `npm start`

### If the phone shows errors or won't load:
- Try `npx expo start --clear` (clears cached bundle)
- Make sure Expo Go app is updated on your phone
- If on same WiFi but still fails: `npx expo start --tunnel`

### If Supabase gives errors:
- Open supabase.com → your project → SQL Editor
- Re-run the full schema SQL to make sure all tables exist
- Check Table Editor to confirm columns exist

---

## Things Still To Improve (see IMPROVEMENT_SUGGESTIONS.md)
- Chat bot needs a backend proxy for web support
- Registration flow could be cleaner (no error flash even though it succeeds)
- Phone loading reliability (consider a proper development build via EAS)
