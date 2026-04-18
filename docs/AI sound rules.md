# PRODY Conversation Architecture Fix

## Problem

PRODY currently behaves like a task engine speaking directly to the user.

Current flow:

User Input  
→ Intent Detection (regex / heuristics)  
→ Action (task/folder/update/JSON planner)  
→ User Response

This produces robotic interactions because:
- Actions happen before conversation
- Internal operations leak into user-facing language
- Regex often overrides emotional context
- Structured planning (JSON) influences conversational tone
- Responses sound like system logs instead of human support

---

# Goal

Make PRODY feel like a conversational copilot, not a task bot.

New flow:

User Input  
→ Context + Emotion Detection  
→ Human Response (natural language)  
→ Action Layer (tasks/folders/updates/subtasks)  
→ Naturalization Layer (rewrite action results conversationally)  
→ Final Response

---

# Existing Features (Keep These)

## Chat (Text)
Current capabilities to preserve:

- Productivity-focused system prompt
- Intent detection
- Task creation (single task)
- Multi-task generation from JSON
- Folder creation
- Task updates/rescheduling
- Subtask generation
- Prioritization
- Show/list tasks
- Calendar-aware scheduling
- Default dates ("today" when missing)

---

## Voice
Current capabilities to preserve:

- Whisper transcription
- Same fetchAIResponseWithTaskExtraction pipeline
- expo-speech voice output
- Shared voice/text logic

Voice and text should continue behaving identically.

---

# New Conversation Pipeline

## Step 1 — Detect Human Context First

Before task logic runs, detect:

- Stress / overwhelm
- Simple task request
- Planning request
- Emotional venting
- Clarification needed
- Greeting / casual talk

Example:

User:
I'm drowning, I have two exams and a project.

Detected:
- emotion: overwhelmed
- intent: planning

Do NOT go straight to task creation.

---

## Step 2 — Respond Like a Human First

First response should acknowledge situation.

Bad:

"I created 5 study tasks."

Good:

"That sounds like a lot at once. Let's break it into something manageable."

Then run actions.

Rule:
Conversation first.
Action second.

---

## Step 3 — Run Existing Features After Conversation

Use existing features only after human response layer.

Possible actions:

- Create task
- Create multiple tasks
- Create folder
- Update task
- Generate subtasks
- Prioritize tasks
- Schedule calendar blocks

No feature loss.

Only ordering changes.

---

## Step 4 — Never Expose Internal Operations

Forbidden responses:

- Task created successfully
- Folder created
- Updated deadline
- Generated 4 subtasks

Replace with:

- I mapped this into four study blocks.
- I moved that deadline to Friday.
- I grouped these under a Work folder.

Never sound like a database log.

---

## Step 5 — Add Naturalization Layer (Critical)

After actions complete:

Take internal result:

{
tasks_created: 5,
schedule: mornings,
folder: Exams
}

Rewrite into user-facing language:

"I spread this into five morning study sessions and grouped them under Exams so it feels less overwhelming."

All tool outputs should pass through this layer.

---

# Architecture Flow

## OLD

User  
→ Regex  
→ Action  
→ Reply

---

## NEW

User  
→ Context detection  
→ Human conversational response  
→ Existing task/folder logic  
→ Naturalization rewrite  
→ Final reply

---

# Prompt Changes

Replace productivity-assistant prompt with:

You are a thoughtful productivity copilot, not a task bot.

Respond to the human situation first.

Do not narrate system operations.

Do not sound like customer support.

Do not immediately jump into feature behavior.

Take actions naturally inside conversation.

Mention created tasks as something you did, not as system output.

---

# Response Rules

Always:
- Use contractions
- Vary sentence length
- Sound conversational
- Keep replies short unless detail is requested

Never:
- "I'd be happy to help"
- "Task created successfully"
- "Here are the steps"
- Corporate support language
- Bullet walls unless user asks for structure

---

# Streaming (Add)

Current:
Full response arrives at once.

Fix:
Stream tokens into UI.

User should feel response is being thought through.

Streaming improves naturalness immediately.

---

# Clarification Rule

Only ask follow-up questions when truly necessary.

Good:
Do you want me to spread those across the week or focus on the exam first?

Bad:
What subject?
What date?
What priority?
What duration?
What folder?

Avoid interrogations.

---

# Core Principle

Old system:
Intent → Action → Response

New system:
Human Response → Action → Naturalized Response

That is the entire fix.

---

# Success Criteria

PRODY should feel like:

- A copilot
- A thinking assistant
- A planner inside the app

Not:

- A task parser
- A workflow engine
- A talking database
