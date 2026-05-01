# PRODY AI — features overview

This document summarizes what the in-app assistant does and how it connects to tasks, folders, and the calendar.

## Chat & models

- **Chat model:** OpenAI `gpt-4o-mini` via `services/openai/openaiClient.ts` (set `EXPO_PUBLIC_OPENAI_API_KEY`).
- **System behavior:** Guided by `PRODY_SYSTEM_PROMPT` in `app/(app)/chat.tsx` — clarify goals, break problems into steps, respect scheduling, assume **today** when no date is given (see below).

## Speech

- **Speech-to-text:** Recordings are sent to **Whisper** (`whisper-1`) so casual or messy speech is transcribed; the model is instructed to infer intent and ask for missing details when needed.
- **Text-to-speech:** Replies use `expo-speech` with **`utils/botSpeech.ts`** — prefers an **enhanced** English voice when the device exposes one, and uses tuned rate/pitch for clearer, more natural playback.

## Tasks & calendar

- **Single-task creation:** Heuristics + regex detect task-like messages; new tasks get a **deadline** so they show on the **calendar**. If the user does not specify a date, the app defaults the deadline to **today** (local date).
- **Multi-task “breakdown”:** Phrases like “break this into tasks” / “create several tasks” can trigger a **JSON plan** from the model; multiple tasks are created with `dayOffset` (0 = today, 1 = tomorrow, …), so they appear on the calendar on the right days.
- **Updates:** Messages that look like “change / reschedule / update …” try to match an existing task and update fields (including `startTime` / `endTime` where parsed).

## Folders

- **New folder:** A standalone message such as `Create folder Work` creates a task folder (AsyncStorage via `services/foldersStorage.ts`).
- **Tasks in a folder:** If the message mentions **in folder …** or **under project …** and the name matches an existing folder, new tasks are created with that `folder_id`.

## Subtasks & prioritization

- **Subtasks:** “Break down …” / “subtasks for …” flows can generate subtasks (including AI-generated steps) under a parent task.
- **Prioritize / list:** Keyword paths can list tasks or help prioritize by priority or subtasks.

## Limits & expectations

- **Canned replies** (hi / bye / a bare “help”) use **anchored** patterns so phrases like “help me with my exams” always go to **GPT**, not the feature list.
- The **tool schemas** in `chat.tsx` are legacy scaffolding; execution paths today are mostly **regex + offline task service**, not OpenAI function-calling for every action.
- For the most reliable folder and multi-task behavior, use short, clear utterances or split requests into separate messages when something fails to parse.
