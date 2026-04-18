import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  Animated,
  Easing,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput as RNTextInput,
  InteractionManager,
} from 'react-native';
import { Text, Button, IconButton, Avatar } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import VoiceOrb from '../../components/chat/VoiceOrb';
import ListeningDots from '../../components/chat/ListeningDots';
import { openaiChatCompletions, transcribeAudioUri, getOpenAIKey } from '../../services/openai/openaiClient';
import { runProdyToolAgentLoop } from '../../services/ai/prodyToolAgent';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { FONT_SERIF, type ThemeColors } from '../../constants/lifeTrackerDesign';
import { useAppTheme } from '../../contexts/AppThemeContext';
import { offlineTaskService } from '../../services/offline/taskService';
import { useAuth } from '../../hooks/useAuth';
import * as Speech from 'expo-speech';
import OfflineIndicator from '../../components/OfflineIndicator';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Task, TaskCreate, TaskPriority } from '../../types/task';
import { formatDateForStorage } from '../../utils/dateUtils';
import { speakBot, preloadBotVoice } from '../../utils/botSpeech';
import { addTaskFolder, getOrCreateTaskFolderByName, getTaskFolders } from '../../services/foldersStorage';

const BOT_NAME = 'PRODY';

type ChatMessage = {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  loading?: boolean;
  suggestions?: string[];
};

const initialMessages: ChatMessage[] = [
  {
    id: '1',
    sender: 'bot',
    text:
      "Hey — I'm PRODY. I can help you sort out what's on your plate, spin up folders and grouped tasks, break big stuff into steps, and line things up on your calendar.\n\nSay or type something like “plan my week” or “break this project into tasks in folders.”",
  },
];

/** OpenAI Chat Completions (GPT-4o mini) — set EXPO_PUBLIC_OPENAI_API_KEY in `.env` */
const API_CONFIG = {
  temperature: 0.75,
  max_tokens: 650,
  top_p: 0.9,
  frequency_penalty: 0.15,
  presence_penalty: 0.1,
  timeout: 25000,
};

/** Core PRODY voice — see docs/AI sound rules.md (conversation first, no system-log tone). */
const PRODY_SYSTEM_BASE = `You are PRODY — a thoughtful productivity copilot inside a quest/task app with a calendar, not a task bot.

Respond to the human situation first. Don't narrate system operations. Don't sound like customer support. Don't jump straight into listing features unless they asked what you can do.

When this chat creates or moves work (tasks, folders, calendar), talk about it the way you'd tell a friend ("I split that across three evenings") — never like a database log ("Task created successfully", "Folder created", "Updated deadline", "Here are the steps").

Tone: contractions, varied sentence length, conversational. Keep replies short unless they want depth. Skip bullet walls unless they asked for structure or a tiny list really helps.

If they don't name a date for a task, **today** is the right default mentally — the app matches that. Voice input can be messy — infer intent. Only ask a follow-up when something critical is missing, and ask one focused question — not an interrogation.

Don't claim you already ran app actions unless this chat flow would have done it.`;

function isOverwhelmedIntent(message: string) {
  const keywords = [
    'overwhelmed', 'too much', 'can\'t handle', 'stressed', 'so many tasks', 'too many tasks',
    'lost', 'don\'t know where to start', 'anxious', 'panic', 'burnt out', 'burned out', 'exhausted',
    'help me focus', 'help me prioritize', 'help me organize', 'help me break down', 'need help',
    'need to focus', 'need to organize', 'need to prioritize', 'need to break down'
  ];
  return keywords.some(word => message.toLowerCase().includes(word));
}

function detectConversationContext(userMessage: string) {
  const m = userMessage.toLowerCase();
  const overwhelmed = isOverwhelmedIntent(userMessage);
  const likelyVenting =
    /\b(ugh|argh|i hate this|so done|need to vent|just ranting)\b/.test(m) &&
    !/\b(create|add|task|schedule|remind|folder|break into)\b/.test(m);
  return { overwhelmed, likelyVenting };
}

function buildProdySystemPrompt(userMessage: string): string {
  const ctx = detectConversationContext(userMessage);
  const bits: string[] = [];
  if (ctx.overwhelmed) {
    bits.push('They sound overloaded — acknowledge that in one short line before you get practical.');
  }
  if (ctx.likelyVenting) {
    bits.push('They may be venting — meet that emotionally first; don’t bulldoze into tasks unless they steer there.');
  }
  if (bits.length === 0) return PRODY_SYSTEM_BASE;
  return `${PRODY_SYSTEM_BASE}\n\nContext for this turn:\n${bits.join('\n')}`;
}

type NaturalizePayload =
  | { kind: 'tasks_planned'; userDraft: string; taskCount: number; folderHint?: string }
  | { kind: 'folder_ready'; name: string; duplicate?: boolean }
  | { kind: 'task_saved'; title: string; coachNote?: string }
  | { kind: 'task_updated'; title: string; changed: string }
  | { kind: 'subtasks_added'; parentTitle: string; stepTitles: string[]; coachNote?: string }
  | { kind: 'list_or_rank'; internalDraft: string };

const NATURALIZE_SYSTEM = `You rewrite assistant text for PRODY, a productivity copilot.

Output ONLY the final message the user reads — no quotes, no preamble, no JSON.

Rules:
- Human voice: contractions, natural rhythm. No customer-support tone.
- Forbidden phrases (never use): "Task created successfully", "Folder created", "Updated deadline", "Generated N subtasks", "Here are the steps", "I'd be happy to help", "Certainly", "To assist you".
- Say what changed in plain language. Don't expose field names, "the system", or tool jargon.
- Avoid bullet walls; at most 3 very short bullets only if unavoidable. Prefer flowing sentences.`;

async function naturalizeProdyFacing(userMessage: string, payload: NaturalizePayload): Promise<string> {
  if (!getOpenAIKey()) {
    return fallbackNaturalize(payload);
  }
  const facts = JSON.stringify(payload);
  try {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 14000);
    const res = await openaiChatCompletions(
      {
        messages: [
          { role: 'system', content: NATURALIZE_SYSTEM },
          {
            role: 'user',
            content: `User said:\n${userMessage}\n\nFacts for you (do not repeat as JSON):\n${facts}\n\nWrite the user-facing reply.`,
          },
        ],
        temperature: 0.55,
        max_tokens: 220,
      },
      controller.signal,
    );
    clearTimeout(tid);
    if (!res.ok) {
      return fallbackNaturalize(payload);
    }
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const out = data.choices?.[0]?.message?.content?.trim();
    return out && out.length > 0 ? out : fallbackNaturalize(payload);
  } catch {
    return fallbackNaturalize(payload);
  }
}

function fallbackNaturalize(payload: NaturalizePayload): string {
  switch (payload.kind) {
    case 'tasks_planned':
      return payload.userDraft;
    case 'folder_ready':
      return payload.duplicate
        ? `You've already got a folder called "${payload.name}" — you're covered.`
        : `You're set — I added a "${payload.name}" bucket you can use.`;
    case 'task_saved':
      return payload.coachNote
        ? `Got it — I saved "${payload.title}" for you.\n\n${payload.coachNote}`
        : `Got it — I saved "${payload.title}" for you.`;
    case 'task_updated':
      return `Done — I adjusted "${payload.title}" (${payload.changed}).`;
    case 'subtasks_added':
      return payload.coachNote
        ? `I split "${payload.parentTitle}" into a few smaller steps — ${payload.stepTitles.slice(0, 4).join(', ')}${payload.stepTitles.length > 4 ? '…' : ''}.\n\n${payload.coachNote}`
        : `I split "${payload.parentTitle}" into ${payload.stepTitles.length} smaller steps — peek at your list when you're ready.`;
    case 'list_or_rank':
      return 'Peek at your Tasks tab — that’s where the full picture lives.';
    default:
      return '';
  }
}

/** Composer row height for list padding (capsule + safe area). */
const INPUT_BAR_HEIGHT = 64;

/** After speech is detected, stop & send when volume stays below threshold this long. */
const VOICE_SILENCE_MS = 3000;
/** expo-av metering dBFS — values above this count as speech (typical speech ~-35 to -20). */
const VOICE_METERING_DB = -48;

function pad(n: number) {
  return n.toString().padStart(2, '0');
}

/** Calendar day (YYYY-MM-DD) for a planned task: honor full ISO on slots, else dayOffset from today. */
function computePlanTaskDeadlineYmd(t: { dayOffset?: number; startTime?: string; endTime?: string }, off: number): string {
  const st = t.startTime?.trim();
  if (st && /^\d{4}-\d{2}-\d{2}T/.test(st)) return st.slice(0, 10);
  const et = t.endTime?.trim();
  if (et && /^\d{4}-\d{2}-\d{2}T/.test(et)) return et.slice(0, 10);
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + off);
  return formatDateForStorage(d);
}

/** Turn optional start/end hints into full ISO local datetimes on deadlineYmd. */
function normalizePlanSlotToIso(deadlineYmd: string, slot: string | undefined): string | undefined {
  if (!slot || typeof slot !== 'string') return undefined;
  const t = slot.trim();
  if (!t) return undefined;
  if (/^\d{4}-\d{2}-\d{2}T\d/.test(t)) {
    if (t.length === 16 && t[13] === ':') return `${t}:00`;
    return t;
  }
  const lower = t.toLowerCase();
  const m = lower.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (m) {
    let h = parseInt(m[1], 10);
    const min = m[2] ? parseInt(m[2], 10) : 0;
    const ap = m[3];
    if (ap === 'pm' && h < 12) h += 12;
    if (ap === 'am' && h === 12) h = 0;
    if (h < 0 || h > 23 || min < 0 || min > 59) return undefined;
    return `${deadlineYmd}T${pad(h)}:${pad(min)}:00`;
  }
  return undefined;
}

function parseCreateFolderIntent(userMessage: string): string | null {
  const trimmed = userMessage.trim();
  const m = trimmed.match(
    /(?:^|\n)\s*(?:create|add|make)\s+(?:a\s+)?(?:new\s+)?folder\s+(?:called|named\s+)?["']?([^"'\n]+?)["']?\s*\.?\s*$/i,
  );
  if (m?.[1]) return m[1].trim();
  const m2 = trimmed.match(/new\s+folder\s*[:\-]\s*([^\n]+)/i);
  return m2?.[1]?.trim() ?? null;
}

async function resolveFolderIdFromMessage(userMessage: string, userId: string): Promise<string | null> {
  const patterns = [
    /(?:in|inside|under)\s+(?:the\s+)?folder\s+["']?([^"'\n]+?)["']?(?:\s|$|,|\.)/i,
    /(?:in|under)\s+(?:the\s+)?project\s+["']?([^"'\n]+?)["']?(?:\s|$|,|\.)/i,
  ];
  for (const p of patterns) {
    const m = userMessage.match(p);
    if (!m?.[1]) continue;
    const raw = m[1].trim();
    const folders = await getTaskFolders(userId);
    const hit = folders.find((f) => f.name.toLowerCase() === raw.toLowerCase());
    if (hit) return hit.id;
  }
  return null;
}

type AiPlanTask = {
  title?: string;
  description?: string;
  dayOffset?: number;
  /** Put this task in a folder; created if missing (matched case-insensitively). */
  folderName?: string;
  /** Optional time on that task's calendar day: "14:00", "2pm", or full ISO datetime. */
  startTime?: string;
  endTime?: string;
  priority?: number;
};

type AiPlanJson = {
  /** Folder names to ensure exist (empty ok). Tasks may also set folderName per row. */
  newFolders?: string[];
  tasks?: AiPlanTask[];
  /** Short, conversational acknowledgment — no bullet essay. */
  reply?: string;
};

const DEFAULT_EXAM_PREP_FOLDER = 'Exam prep';

/** Model forgot folders but user clearly asked for one bucket for exams — assign a single folder. */
function shouldDefaultSingleExamFolder(
  userMessage: string,
  tasks: AiPlanTask[],
  parsed: AiPlanJson,
): boolean {
  const m = userMessage.toLowerCase();
  const wantsExamBundle =
    /\b(exam|exams|midterm|finals?)\b/.test(m) &&
    /\b(folder|folders|group|grouped|together)\b/.test(m);
  if (!wantsExamBundle) return false;
  if (Array.isArray(parsed.newFolders) && parsed.newFolders.some((n) => typeof n === 'string' && n.trim())) {
    return false;
  }
  if (tasks.some((t) => t.folderName && String(t.folderName).trim())) return false;
  return true;
}

async function createTasksFromAiPlan(
  userMessage: string,
  userId: string,
  onTaskCreated?: () => void,
): Promise<{ text: string; suggestions: string[] } | null> {
  if (!getOpenAIKey()) return null;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.timeout + 8000);
    const res = await openaiChatCompletions(
      {
        messages: [
          {
            role: 'system',
            content: `Output ONLY valid JSON with this exact shape:
{"newFolders":["optional names of folders to create"],"tasks":[{"title":"string","description":"string","dayOffset":0,"folderName":"optional","startTime":"optional","endTime":"optional","priority":0}],"reply":"string"}

Rules:
- You are helping someone who may be stressed. In "reply": sound human, warm, brief (2–5 short sentences). Acknowledge what they said, say what you grouped or scheduled, no bullet lists unless they asked for a list.
- "newFolders": folder names to create up front. If they want one bucket for several exams (e.g. "group my exams in a folder"), use ONE folder name like "Exam prep" and set the same folderName on every task. If they want a folder per subject, use multiple newFolders / per-task folderName instead.
- dayOffset: 0 = today, 1 = tomorrow, … up to 14. If the user gave specific days/times, set dayOffset and/or use full ISO in startTime/endTime on that calendar day.
- startTime / endTime: optional. Use clock form "HH:MM" or "9am"/"2:30pm" for that task's day, OR full ISO "YYYY-MM-DDTHH:mm:ss" if you need an exact instant.
- priority: optional 0–3 (0 low … 3 urgent).
- Max 12 tasks. Titles must be concrete (e.g. "Physics — mechanics drill 40m").
- Respect scheduling preferences they stated (mornings only, one subject per day, lighter weekends, etc.).`,
          },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.55,
        max_tokens: 1100,
        response_format: { type: 'json_object' },
      },
      controller.signal,
    );
    clearTimeout(timeoutId);
    if (!res.ok) return null;
    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content;
    if (!raw || typeof raw !== 'string') return null;
    const parsed = JSON.parse(raw) as AiPlanJson;
    const tasks = parsed.tasks;
    if (!Array.isArray(tasks) || tasks.length === 0) return null;

    if (shouldDefaultSingleExamFolder(userMessage, tasks, parsed)) {
      const bucket = DEFAULT_EXAM_PREP_FOLDER;
      for (const t of tasks) {
        if (!t.folderName?.trim()) t.folderName = bucket;
      }
      if (!Array.isArray(parsed.newFolders) || parsed.newFolders.length === 0) {
        parsed.newFolders = [bucket];
      }
    }

    const namesToEnsure = new Set<string>();
    if (Array.isArray(parsed.newFolders)) {
      for (const n of parsed.newFolders) {
        if (typeof n === 'string' && n.trim()) namesToEnsure.add(n.trim());
      }
    }
    for (const t of tasks) {
      if (t.folderName && typeof t.folderName === 'string' && t.folderName.trim()) {
        namesToEnsure.add(t.folderName.trim());
      }
    }
    for (const name of namesToEnsure) {
      await getOrCreateTaskFolderByName(userId, name);
    }

    const messageFolderFallback = await resolveFolderIdFromMessage(userMessage, userId);
    let created = 0;
    for (const t of tasks) {
      const title = (t.title || '').trim();
      if (!title) continue;
      const off =
        typeof t.dayOffset === 'number' && t.dayOffset >= 0
          ? Math.min(Math.floor(t.dayOffset), 14)
          : 0;
      const deadline = computePlanTaskDeadlineYmd(t, off);
      let folderId: string | null = null;
      if (t.folderName && typeof t.folderName === 'string' && t.folderName.trim()) {
        const f = await getOrCreateTaskFolderByName(userId, t.folderName.trim());
        folderId = f.id;
      } else if (messageFolderFallback) {
        folderId = messageFolderFallback;
      }
      const startIso = normalizePlanSlotToIso(deadline, t.startTime);
      const endIso = normalizePlanSlotToIso(deadline, t.endTime);
      const pr =
        typeof t.priority === 'number' && t.priority >= 0 && t.priority <= 3
          ? (Math.floor(t.priority) as TaskPriority)
          : undefined;
      await offlineTaskService.createTask(
        {
          title,
          description: (t.description || '').trim(),
          deadline,
          ...(folderId ? { folder_id: folderId } : {}),
          ...(startIso ? { startTime: startIso } : {}),
          ...(endIso ? { endTime: endIso } : {}),
          ...(pr !== undefined ? { priority: pr } : {}),
        },
        userId,
      );
      created += 1;
    }
    if (created === 0) return null;
    if (onTaskCreated) setTimeout(onTaskCreated, 100);
    const reply =
      parsed.reply?.trim() ||
      `I lined up ${created} tasks on your calendar — take a look when you can.`;
    const folderHint =
      namesToEnsure.size > 0 ? [...namesToEnsure].slice(0, 6).join(', ') : undefined;
    const text = await naturalizeProdyFacing(userMessage, {
      kind: 'tasks_planned',
      userDraft: reply,
      taskCount: created,
      folderHint,
    });
    return {
      text,
      suggestions: ['Show my tasks', 'Break into subtasks', 'Help me prioritize'],
    };
  } catch (e) {
    console.error('createTasksFromAiPlan:', e);
    return null;
  }
}

let lastBotTask: { id: string; title: string } | null = null;

// AI-powered subtask generation (OpenAI)
async function generateSubtasksWithAI(parentTaskTitle: string, parentTaskDescription: string, userId: string): Promise<{ title: string; description: string; priority: number }[]> {
  try {
    if (!getOpenAIKey()) {
      throw new Error('Missing API key');
    }
    const prompt = `Please break down the following task into 3-7 logical subtasks that would help complete it effectively:

Task: ${parentTaskTitle}
Description: ${parentTaskDescription || 'No description provided'}

Please create subtasks that are:
1. Specific and actionable
2. Logical steps toward completing the main task
3. Appropriately sized (not too big or too small)
4. Clear and easy to understand

Return the subtasks in a structured format.`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.timeout);

    const response = await openaiChatCompletions(
      {
        messages: [
          {
            role: 'system',
            content:
              'You break work into manageable subtasks. Reply in plain language — short numbered lines or bullets with concrete next actions. No corporate tone.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: API_CONFIG.temperature,
        max_tokens: API_CONFIG.max_tokens,
        top_p: API_CONFIG.top_p,
        frequency_penalty: API_CONFIG.frequency_penalty,
        presence_penalty: API_CONFIG.presence_penalty,
      },
      controller.signal,
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices?.[0]?.message?.content || '';

    // Parse the AI response to extract subtasks
    const subtasks = parseSubtasksFromAIResponse(aiResponse);
    return subtasks;
  } catch (error) {
    console.error('AI subtask generation error:', error);
    // Fallback to basic subtasks
    return [
      { title: `Research ${parentTaskTitle}`, description: 'Gather information and resources needed', priority: 1 },
      { title: `Plan ${parentTaskTitle}`, description: 'Create a detailed plan and timeline', priority: 1 },
      { title: `Execute ${parentTaskTitle}`, description: 'Implement the main task', priority: 2 },
      { title: `Review ${parentTaskTitle}`, description: 'Review and refine the completed work', priority: 1 }
    ];
  }
}

// Parse subtasks from AI response
function parseSubtasksFromAIResponse(aiResponse: string): { title: string; description: string; priority: number }[] {
  const subtasks: { title: string; description: string; priority: number }[] = [];
  
  // Try to extract numbered or bulleted lists
  const lines = aiResponse.split('\n');
  let currentSubtask: { title: string; description: string; priority: number } | null = null;
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // Skip empty lines
    if (!trimmedLine) continue;
    
    // Look for numbered or bulleted items
    const numberedMatch = trimmedLine.match(/^(\d+)[\.\)]\s*(.+)$/);
    const bulletMatch = trimmedLine.match(/^[-*•]\s*(.+)$/);
    
    if (numberedMatch || bulletMatch) {
      // Save previous subtask if exists
      if (currentSubtask) {
        subtasks.push(currentSubtask);
      }
      
      // Start new subtask
      const title = (numberedMatch?.[2] || bulletMatch?.[1] || '').trim();
      if (title) {
        currentSubtask = {
          title: title,
          description: '',
          priority: 1
        };
      }
    } else if (currentSubtask && trimmedLine) {
      // Add to description of current subtask
      currentSubtask.description += (currentSubtask.description ? ' ' : '') + trimmedLine;
    }
  }
  
  // Add the last subtask
  if (currentSubtask) {
    subtasks.push(currentSubtask);
  }
  
  // If no structured subtasks found, try to extract from general text
  if (subtasks.length === 0) {
    const sentences = aiResponse.split(/[.!?]+/).filter(s => s.trim().length > 10);
    subtasks.push(...sentences.slice(0, 5).map(sentence => ({
      title: sentence.trim().substring(0, 50) + (sentence.length > 50 ? '...' : ''),
      description: sentence.trim(),
      priority: 1
    })));
  }
  
  return subtasks;
}

// Helper: detect confirmation
function isConfirmation(message: string) {
  const yesWords = ['yes', 'sure', 'ok', 'okay', 'please', 'yep', 'yeah', 'do it', 'go ahead', 'break it down', 'confirm'];
  return yesWords.some(word => message.toLowerCase().includes(word));
}

// Track last created task in component state
let lastCreatedTask: { id: string, title: string, description?: string } | null = null;

type FetchAIStreamCallbacks = {
  onStreamDelta?: (accumulated: string) => void;
};

// Text-based task extraction AI response fetcher
async function fetchAIResponseWithTaskExtraction(
  userMessage: string,
  history: { sender: string; text: string }[],
  userId: string,
  onTaskCreated?: () => void,
  streamCallbacks?: FetchAIStreamCallbacks,
) {
  const startTime = Date.now();
  
  try {
    // Check cache first for instant responses
    const cachedResponse = getCachedResponse(userMessage);
    if (cachedResponse) {
      logPerformance('responseTime', Date.now() - startTime);
      return cachedResponse;
    }

    if (!getOpenAIKey()) {
      return {
        text: 'Add EXPO_PUBLIC_OPENAI_API_KEY to your .env file and restart Expo.',
        suggestions: [],
      };
    }

    const folderNameOnly = parseCreateFolderIntent(userMessage);
    if (folderNameOnly) {
      const existing = await getTaskFolders(userId);
      if (existing.some((f) => f.name.toLowerCase() === folderNameOnly.toLowerCase())) {
        const text = await naturalizeProdyFacing(userMessage, {
          kind: 'folder_ready',
          name: folderNameOnly,
          duplicate: true,
        });
        const response = { text, suggestions: ['Show my tasks', 'Create a task'] };
        cacheResponse(userMessage, response);
        return response;
      }
      const folder = await addTaskFolder(userId, folderNameOnly);
      const text = await naturalizeProdyFacing(userMessage, {
        kind: 'folder_ready',
        name: folder.name,
      });
      const response = {
        text,
        suggestions: [`Add a task in folder ${folder.name}`, 'Show my tasks'],
      };
      cacheResponse(userMessage, response);
      return response;
    }

    if (lastCreatedTask && isConfirmation(userMessage)) {
      const parentTitleForNaturalize = lastCreatedTask.title;
      const subtasks = await generateSubtasksWithAI(lastCreatedTask.title, lastCreatedTask.description || '', userId);
      const createdSubtasks = [];
      for (const subtask of subtasks) {
        const created = await offlineTaskService.createTask({
          title: subtask.title,
          description: subtask.description,
          priority: subtask.priority as import('../../types/task').TaskPriority,
          parent_task_id: lastCreatedTask.id
        }, userId);
        createdSubtasks.push(created);
      }
      lastCreatedTask = null;
      const stepTitles = createdSubtasks.map((s) => s.title);
      const text = await naturalizeProdyFacing(userMessage, {
        kind: 'subtasks_added',
        parentTitle: parentTitleForNaturalize,
        stepTitles,
      });
      const response = { text, suggestions: ["Break into subtasks", "Set a deadline", "Add to focus session"] };
      cacheResponse(userMessage, response);
      logPerformance('responseTime', Date.now() - startTime);
      return response;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), Math.min(120000, API_CONFIG.timeout * 4));
    try {
      const agentHistory = history.map((m) => ({
        sender: (m.sender === 'user' ? 'user' : 'bot') as 'user' | 'bot',
        text: m.text,
      }));
      const agentReply = await runProdyToolAgentLoop({
        userMessage,
        history: agentHistory,
        systemPrompt: buildProdySystemPrompt(userMessage),
        userId,
        signal: controller.signal,
        temperature: API_CONFIG.temperature,
        maxTokens: API_CONFIG.max_tokens,
        hooks: {
          onTaskMutated: onTaskCreated,
          registerLastBotTask: (t) => {
            lastBotTask = t;
          },
          registerLastCreatedTask: (t) => {
            lastCreatedTask = t;
            lastBotTask = { id: t.id, title: t.title };
          },
          runStructuredPlan: async (msg) => {
            const plan = await createTasksFromAiPlan(msg, userId, onTaskCreated);
            if (!plan) return null;
            return { ok: true, replyText: plan.text, suggestions: plan.suggestions };
          },
        },
        onStreamDelta: streamCallbacks?.onStreamDelta,
      });
      cacheResponse(userMessage, agentReply);
      logPerformance('responseTime', Date.now() - startTime);
      return agentReply;
    } catch (e) {
      console.error('Prody tool agent error:', e);
      logPerformance('apiError');
      const response = { text: 'Sorry, there was an error connecting to the AI.', suggestions: [] };
      cacheResponse(userMessage, response);
      logPerformance('responseTime', Date.now() - startTime);
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (err) {
    console.error('API call error:', err);
    logPerformance('apiError');
    const response = { text: 'Sorry, there was an error connecting to the AI.', suggestions: [] };
    cacheResponse(userMessage, response);
    logPerformance('responseTime', Date.now() - startTime);
    return response;
  }
}

// Utility to strip basic markdown formatting for bot messages
function stripMarkdown(text: string): string {
  // Remove code blocks
  text = text.replace(/```[\s\S]*?```/g, '');
  // Remove inline code
  text = text.replace(/`([^`]+)`/g, '$1');
  // Remove bold/italic/underline
  text = text.replace(/\*\*([^*]+)\*\*/g, '$1');
  text = text.replace(/\*([^*]+)\*/g, '$1');
  text = text.replace(/__([^_]+)__/g, '$1');
  text = text.replace(/_([^_]+)_/g, '$1');
  // Remove headings
  text = text.replace(/^#+\s?/gm, '');
  // Remove links but keep text
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1');
  // Remove images
  text = text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '');
  // Remove unordered/ordered list markers
  text = text.replace(/^\s*[-*+]\s+/gm, '');
  text = text.replace(/^\s*\d+\.\s+/gm, '');
  // Remove blockquotes
  text = text.replace(/^>\s?/gm, '');
  // Remove horizontal rules
  text = text.replace(/^---$/gm, '');
  return text.trim();
}

// Animated Typing Indicator (three bouncing dots)
const TypingIndicator = () => {
  const { colors: dotC } = useAppTheme();
  const dot1 = React.useRef(new Animated.Value(0)).current;
  const dot2 = React.useRef(new Animated.Value(0)).current;
  const dot3 = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const createAnimation = (dot, delay) => {
      return Animated.loop(
        Animated.sequence([
          Animated.timing(dot, { toValue: -6, duration: 300, delay, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
          Animated.timing(dot, { toValue: 0, duration: 300, useNativeDriver: true, easing: Easing.inOut(Easing.ease) })
        ])
      );
    };
    const a1 = createAnimation(dot1, 0);
    const a2 = createAnimation(dot2, 150);
    const a3 = createAnimation(dot3, 300);
    a1.start(); a2.start(); a3.start();
    return () => { a1.stop(); a2.stop(); a3.stop(); };
  }, [dot1, dot2, dot3]);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginLeft: 8 }}>
      {[dot1, dot2, dot3].map((dot, i) => (
        <Animated.View
          key={i}
          style={{
            width: 7, height: 7, borderRadius: 3.5, backgroundColor: dotC.amber, marginHorizontal: 2,
            transform: [{ translateY: dot }],
          }}
        />
      ))}
    </View>
  );
};

// Simple cache for common responses to avoid API calls
const RESPONSE_CACHE = new Map<string, { text: string; suggestions: string[]; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/** Very short, exact-intent messages only — never match "help me with my exams" (that must hit GPT). */
function matchCannedChatResponse(trimmed: string): { text: string; suggestions: string[] } | null {
  const t = trimmed.trim();
  if (t.length > 56) return null;

  if (/^(hi|hello|hey)(\s+there)?(\s+prody)?[!?.,\s]*$/i.test(t)) {
    return {
      text: "Hey — what's going on? Tell me what you're trying to get done.",
      suggestions: ['Create a task', 'Show my tasks', 'Help me prioritize'],
    };
  }
  if (/^(thanks|thank you)([!?.,\s]*)$/i.test(t) || /^thanks\s+so\s+much[!?.,\s]*$/i.test(t)) {
    return {
      text: "Anytime. Ping me if something else pops up.",
      suggestions: ['Create a task', 'Show my tasks'],
    };
  }
  if (/^(bye|goodbye)[!?.,\s]*$/i.test(t)) {
    return { text: 'Later — go get something small done and call it a win.', suggestions: [] };
  }
  if (/^(help|what can you do)(\s+me)?\??\s*$/i.test(t)) {
    return {
      text:
        "I'm here to untangle your workload: I can break a messy project into tasks, group stuff into folders, and put things on your calendar (no date from you usually means today). Voice works too — talk like you normally would. What do you want to tackle?",
      suggestions: ['Create a task', 'Break this into tasks', 'Show my tasks'],
    };
  }
  return null;
}

// Check cache for common responses
function getCachedResponse(userMessage: string): { text: string; suggestions: string[] } | null {
  const now = Date.now();
  const trimmed = userMessage.trim();

  const canned = matchCannedChatResponse(trimmed);
  if (canned) {
    logPerformance('cacheHit');
    return canned;
  }

  // Check cache
  const cacheKey = trimmed.toLowerCase();
  const cached = RESPONSE_CACHE.get(cacheKey);
  if (cached && (now - cached.timestamp) < CACHE_DURATION) {
    logPerformance('cacheHit');
    return { text: cached.text, suggestions: cached.suggestions };
  }
  
  logPerformance('cacheMiss');
  return null;
}

// Cache a response
function cacheResponse(userMessage: string, response: { text: string; suggestions: string[] }) {
  const cacheKey = userMessage.toLowerCase().trim();
  RESPONSE_CACHE.set(cacheKey, { ...response, timestamp: Date.now() });
  
  // Clean up old cache entries
  if (RESPONSE_CACHE.size > 100) {
    const now = Date.now();
    for (const [key, value] of RESPONSE_CACHE.entries()) {
      if (now - value.timestamp > CACHE_DURATION) {
        RESPONSE_CACHE.delete(key);
      }
    }
  }
}

// Performance monitoring
const PERFORMANCE_METRICS = {
  responseTimes: [] as number[],
  cacheHits: 0,
  cacheMisses: 0,
  apiErrors: 0
};

function logPerformance(metric: 'responseTime' | 'cacheHit' | 'cacheMiss' | 'apiError', value?: number) {
  switch (metric) {
    case 'responseTime':
      if (value) {
        PERFORMANCE_METRICS.responseTimes.push(value);
        // Keep only last 50 measurements
        if (PERFORMANCE_METRICS.responseTimes.length > 50) {
          PERFORMANCE_METRICS.responseTimes.shift();
        }
        console.log(`Response time: ${value}ms (Avg: ${getAverageResponseTime()}ms)`);
      }
      break;
    case 'cacheHit':
      PERFORMANCE_METRICS.cacheHits++;
      console.log(`Cache hit! Total hits: ${PERFORMANCE_METRICS.cacheHits}`);
      break;
    case 'cacheMiss':
      PERFORMANCE_METRICS.cacheMisses++;
      console.log(`Cache miss. Total misses: ${PERFORMANCE_METRICS.cacheMisses}`);
      break;
    case 'apiError':
      PERFORMANCE_METRICS.apiErrors++;
      console.log(`API error. Total errors: ${PERFORMANCE_METRICS.apiErrors}`);
      break;
  }
}

function getAverageResponseTime(): number {
  if (PERFORMANCE_METRICS.responseTimes.length === 0) return 0;
  const sum = PERFORMANCE_METRICS.responseTimes.reduce((a, b) => a + b, 0);
  return Math.round(sum / PERFORMANCE_METRICS.responseTimes.length);
}

export default function ChatScreen() {
  const { colors: c } = useAppTheme();
  const styles = useMemo(() => createChatStyles(c), [c]);
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState('');
  const flatListRef = useRef<FlatList<ChatMessage>>(null);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const speechRef = useRef<{ id: string | null }>({ id: null });
  // For quick reply button debounce
  const quickReplyLock = useRef(false);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const lastSoundTimeRef = useRef<number | null>(null);
  const heardSpeechRef = useRef(false);
  const autoSilenceFinishRef = useRef(false);
  const finishVoiceRecordingRef = useRef<() => Promise<void>>(async () => {});
  /** User closed overlay or left tab — skip applying AI/TTS from an in-flight voice turn. */
  const voiceOverlayCancelledRef = useRef(false);
  const insets = useSafeAreaInsets();
  const [voiceSession, setVoiceSession] = useState<
    null | 'listening' | 'thinking' | 'speaking'
  >(null);

  // Get username for personalized greeting
  const username = user?.user_metadata?.username || user?.email?.split('@')[0] || 'there';

  // Handle AI subtask requests from tasks screen
  useEffect(() => {
    if (params.aiSubtaskRequest && user) {
      const aiRequest = params.aiSubtaskRequest as string;
      setInput(aiRequest);
      // Auto-send the AI subtask request
      setTimeout(() => {
        handleSendAIRequest(aiRequest);
      }, 500);
    }
  }, [params.aiSubtaskRequest, user]);

  // Scroll to bottom on new message
  useEffect(() => {
    flatListRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  useEffect(() => {
    void preloadBotVoice();
  }, []);

  useFocusEffect(
    useCallback(() => {
      return () => {
        voiceOverlayCancelledRef.current = true;
        setVoiceSession(null);
        Speech.stop();
        const rec = recordingRef.current;
        if (rec) {
          try {
            rec.setOnRecordingStatusUpdate(null);
          } catch {
            /* ignore */
          }
          recordingRef.current = null;
          void rec.stopAndUnloadAsync().catch(() => {});
        }
        void Audio.setAudioModeAsync({ allowsRecordingIOS: false }).catch(() => {});
      };
    }, []),
  );

  // Stop speech when unmounting or when a new message is played
  React.useEffect(() => {
    return () => {
      Speech.stop();
    };
  }, []);

  const handlePlayPause = (id: string, text: string) => {
    if (speakingId === id) {
      Speech.stop();
      setSpeakingId(null);
      speechRef.current.id = null;
    } else {
      Speech.stop(); // Stop any previous speech
      setSpeakingId(id);
      speechRef.current.id = id;
      speakBot(stripMarkdown(text), {
        onDone: () => {
          if (speechRef.current.id === id) setSpeakingId(null);
        },
        onStopped: () => {
          if (speechRef.current.id === id) setSpeakingId(null);
        },
        onError: () => {
          if (speechRef.current.id === id) setSpeakingId(null);
        },
      });
    }
  };

  const handleSendAIRequest = async (aiRequest: string) => {
    if (!user) return;
    setInput('');
    setMessages(prev => [
      ...prev,
      { id: String(prev.length + 1), sender: 'user', text: aiRequest },
      { id: String(prev.length + 2), sender: 'bot', text: 'Thinking...', loading: true },
    ]);
    
    const aiReplyRaw = await fetchAIResponseWithTaskExtraction(
      aiRequest,
      [...messages, { sender: 'user', text: aiRequest }],
      user.id,
      () => {
        router.setParams({ refresh: Date.now().toString() });
      },
      {
        onStreamDelta: (partial) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.loading ? { ...m, text: partial.trim() ? partial : 'Thinking...' } : m,
            ),
          );
        },
      },
    );
    
    const aiReply = typeof aiReplyRaw === 'string' ? { text: aiReplyRaw, suggestions: [] } : aiReplyRaw;
    setMessages(prev => prev.map(m =>
      m.loading ? { ...m, text: aiReply.text, loading: false, suggestions: aiReply.suggestions } : m
    ));
  };

  const handleSend = async () => {
    if (!input.trim() || !user) return;
    const userMsg = input.trim();
    setInput('');
    
    // Check cache first for instant response
    const cachedResponse = getCachedResponse(userMsg);
    if (cachedResponse) {
      setMessages(prev => [
        ...prev,
        { id: String(prev.length + 1), sender: 'user', text: userMsg },
        { id: String(prev.length + 2), sender: 'bot', text: cachedResponse.text, loading: false, suggestions: cachedResponse.suggestions },
      ]);
      return;
    }
    
    setMessages(prev => [
      ...prev,
      { id: String(prev.length + 1), sender: 'user', text: userMsg },
      { id: String(prev.length + 2), sender: 'bot', text: 'Thinking...', loading: true },
    ]);
    
    const aiReplyRaw = await fetchAIResponseWithTaskExtraction(
      userMsg,
      [...messages, { sender: 'user', text: userMsg }],
      user.id,
      () => {
        router.setParams({ refresh: Date.now().toString() });
      },
      {
        onStreamDelta: (partial) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.loading ? { ...m, text: partial.trim() ? partial : 'Thinking...' } : m,
            ),
          );
        },
      },
    );
    const aiReply = typeof aiReplyRaw === 'string' ? { text: aiReplyRaw, suggestions: [] } : aiReplyRaw;
    setMessages(prev => prev.map(m =>
      m.loading ? { ...m, text: aiReply.text, loading: false, suggestions: aiReply.suggestions } : m
    ));
  };

  const cancelVoiceSession = useCallback(() => {
    voiceOverlayCancelledRef.current = true;
    setVoiceSession(null);
    Speech.stop();

    const rec = recordingRef.current;
    if (rec) {
      try {
        rec.setOnRecordingStatusUpdate(null);
      } catch {
        /* ignore */
      }
    }
    recordingRef.current = null;
    autoSilenceFinishRef.current = false;
    heardSpeechRef.current = false;
    lastSoundTimeRef.current = null;

    InteractionManager.runAfterInteractions(() => {
      void (async () => {
        if (rec) {
          try {
            await rec.stopAndUnloadAsync();
          } catch {
            /* ignore */
          }
        }
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false }).catch(() => {});
      })();
    });
  }, []);

  const finishVoiceRecording = async () => {
    if (voiceOverlayCancelledRef.current) {
      return;
    }
    const rec = recordingRef.current;
    if (rec) {
      try {
        rec.setOnRecordingStatusUpdate(null);
      } catch {
        /* ignore */
      }
    }
    recordingRef.current = null;
    autoSilenceFinishRef.current = false;
    heardSpeechRef.current = false;
    lastSoundTimeRef.current = null;
    if (!rec) {
      setVoiceSession(null);
      return;
    }
    setVoiceSession('thinking');
    try {
      await rec.stopAndUnloadAsync();
      if (voiceOverlayCancelledRef.current) {
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false }).catch(() => {});
        return;
      }
      const uri = rec.getURI();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      if (!uri) throw new Error('No audio file');
      const userMsg = await transcribeAudioUri(uri);
      if (voiceOverlayCancelledRef.current) {
        return;
      }
      if (!userMsg.trim()) {
        setVoiceSession(null);
        Alert.alert('Voice', 'No speech detected. Try again.');
        return;
      }
      if (!user) {
        setVoiceSession(null);
        return;
      }
      const cachedResponse = getCachedResponse(userMsg);
      if (cachedResponse) {
        if (voiceOverlayCancelledRef.current) {
          return;
        }
        setMessages(prev => [
          ...prev,
          { id: `u-${Date.now()}`, sender: 'user', text: userMsg },
          {
            id: `b-${Date.now()}`,
            sender: 'bot',
            text: cachedResponse.text,
            loading: false,
            suggestions: cachedResponse.suggestions,
          },
        ]);
        setVoiceSession('speaking');
        speakBot(stripMarkdown(cachedResponse.text), {
          onDone: () => {
            if (!voiceOverlayCancelledRef.current) setVoiceSession(null);
          },
          onStopped: () => {
            if (!voiceOverlayCancelledRef.current) setVoiceSession(null);
          },
          onError: () => {
            if (!voiceOverlayCancelledRef.current) setVoiceSession(null);
          },
        });
        return;
      }
      setMessages(prev => [
        ...prev,
        { id: `u-${Date.now()}`, sender: 'user', text: userMsg },
        { id: `b-${Date.now()}`, sender: 'bot', text: 'Thinking...', loading: true },
      ]);
      const aiReplyRaw = await fetchAIResponseWithTaskExtraction(
        userMsg,
        [...messages, { sender: 'user', text: userMsg }],
        user.id,
        () => {
          router.setParams({ refresh: Date.now().toString() });
        },
        {
          onStreamDelta: (partial) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.loading ? { ...m, text: partial.trim() ? partial : 'Thinking...' } : m,
              ),
            );
          },
        },
      );
      if (voiceOverlayCancelledRef.current) {
        setMessages(prev => prev.filter(m => !m.loading));
        return;
      }
      const aiReply =
        typeof aiReplyRaw === 'string'
          ? { text: aiReplyRaw, suggestions: [] }
          : aiReplyRaw;
      setMessages(prev =>
        prev.map(m =>
          m.loading
            ? { ...m, text: aiReply.text, loading: false, suggestions: aiReply.suggestions }
            : m,
        ),
      );
      setVoiceSession('speaking');
      speakBot(stripMarkdown(aiReply.text), {
        onDone: () => {
          if (!voiceOverlayCancelledRef.current) setVoiceSession(null);
        },
        onStopped: () => {
          if (!voiceOverlayCancelledRef.current) setVoiceSession(null);
        },
        onError: () => {
          if (!voiceOverlayCancelledRef.current) setVoiceSession(null);
        },
      });
    } catch (e) {
      console.error(e);
      if (!voiceOverlayCancelledRef.current) {
        setVoiceSession(null);
        Alert.alert('Voice', e instanceof Error ? e.message : 'Voice input failed');
      }
    }
  };

  finishVoiceRecordingRef.current = finishVoiceRecording;

  const handleMicPress = async () => {
    if (voiceSession === 'listening') {
      await finishVoiceRecording();
      return;
    }
    if (!getOpenAIKey()) {
      Alert.alert(
        'OpenAI API key',
        'Add EXPO_PUBLIC_OPENAI_API_KEY to your .env file and restart Expo.',
      );
      return;
    }
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Microphone', 'Microphone access is required for voice input.');
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      voiceOverlayCancelledRef.current = false;
      autoSilenceFinishRef.current = false;
      heardSpeechRef.current = false;
      lastSoundTimeRef.current = null;

      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      rec.setProgressUpdateInterval(200);
      rec.setOnRecordingStatusUpdate(status => {
        if (!status.isRecording || autoSilenceFinishRef.current) return;
        const m = status.metering;
        if (typeof m !== 'number') return;
        const now = Date.now();
        if (m > VOICE_METERING_DB) {
          heardSpeechRef.current = true;
          lastSoundTimeRef.current = now;
          return;
        }
        if (heardSpeechRef.current && lastSoundTimeRef.current != null) {
          if (now - lastSoundTimeRef.current >= VOICE_SILENCE_MS) {
            autoSilenceFinishRef.current = true;
            try {
              rec.setOnRecordingStatusUpdate(null);
            } catch {
              /* ignore */
            }
            void finishVoiceRecordingRef.current();
          }
        }
      });
      await rec.startAsync();
      recordingRef.current = rec;
      setVoiceSession('listening');
    } catch (e) {
      console.error(e);
      Alert.alert('Voice', 'Could not start recording.');
    }
  };

  // Handle quick reply button click
  const handleQuickReply = async (suggestion: string) => {
    if (quickReplyLock.current) return;
    quickReplyLock.current = true;
    setMessages(prev => [
      ...prev,
      { id: String(prev.length + 1), sender: 'user', text: suggestion },
      { id: String(prev.length + 2), sender: 'bot', text: 'Thinking...', loading: true },
    ]);
    setInput('');
    const aiReplyRaw = await fetchAIResponseWithTaskExtraction(
      suggestion,
      [...messages, { sender: 'user', text: suggestion }],
      user.id,
      () => {
        router.setParams({ refresh: Date.now().toString() });
      },
      {
        onStreamDelta: (partial) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.loading ? { ...m, text: partial.trim() ? partial : 'Thinking...' } : m,
            ),
          );
        },
      },
    );
    const aiReply = typeof aiReplyRaw === 'string' ? { text: aiReplyRaw, suggestions: [] } : aiReplyRaw;
    setMessages(prev => prev.map(m =>
      m.loading ? { ...m, text: aiReply.text, loading: false, suggestions: aiReply.suggestions } : m
    ));
    setTimeout(() => { quickReplyLock.current = false; }, 500);
  };

  const renderItem = ({ item }: { item: ChatMessage }) => {
    const isBot = item.sender === 'bot';
    const displayText = isBot ? stripMarkdown(item.text) : item.text;
    return (
      <View style={[styles.messageRow, isBot ? styles.botRow : styles.userRow]}>
        {isBot && (
          <View style={styles.oracleAvatar}>
            <MaterialCommunityIcons name="star-four-points" size={22} color={c.amber} />
          </View>
        )}
        <View style={[styles.bubble, isBot ? styles.botBubble : styles.userBubble]}>
          {item.loading ? (
            <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
              <Text style={[styles.messageText, styles.botText, { flex: 1, marginRight: 8 }]}>
                {item.text && item.text !== 'Thinking...'
                  ? stripMarkdown(item.text)
                  : 'Thinking…'}
              </Text>
              {(!item.text || item.text === 'Thinking...') && <TypingIndicator />}
            </View>
          ) : (
            <Text style={[styles.messageText, isBot ? styles.botText : styles.userText]}>{displayText}</Text>
          )}
        </View>
        {isBot && !item.loading && (
          <IconButton
            icon={speakingId === item.id ? 'pause' : 'play'}
            size={24}
            iconColor={c.amber}
            onPress={() => handlePlayPause(item.id, displayText)}
            style={{ marginLeft: 0 }}
            accessibilityLabel={speakingId === item.id ? 'Pause reading aloud' : 'Play message aloud'}
          />
        )}
        {!isBot && (
          <Avatar.Icon icon="account" size={40} style={[styles.avatar, { backgroundColor: c.surf }]} color={c.tx} />
        )}
        {/* Quick reply buttons for suggestions */}
        {isBot && item.suggestions && item.suggestions.length > 0 && !item.loading && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 }}>
            {item.suggestions.map((suggestion, idx) => (
              <Button
                key={idx}
                mode="outlined"
                style={{ marginRight: 6, marginBottom: 4, borderRadius: 12, borderColor: c.amberBorder }}
                textColor={c.amber}
                labelStyle={{ fontFamily: FONT_SERIF, fontSize: 13 }}
                onPress={() => handleQuickReply(suggestion)}
              >
                {suggestion}
              </Button>
            ))}
          </View>
        )}
      </View>
    );
  };

  const inputBottomPad = Math.max(insets.bottom, 12);
  const listBottomPad = INPUT_BAR_HEIGHT + inputBottomPad + 20;

  return (
    <View style={[styles.root, { backgroundColor: c.bg }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
      >
        <View style={[styles.container, { flex: 1 }]}>
          <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
            <IconButton
              icon="arrow-left"
              onPress={() => router.back()}
              iconColor={c.tx}
              style={styles.headerIconBtn}
            />
            <Text style={styles.headerTitleCenter}>{BOT_NAME}</Text>
            <View style={styles.headerRightSpacer} />
          </View>
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderItem}
            keyExtractor={item => item.id}
            contentContainerStyle={[
              styles.messagesContainer,
              { paddingBottom: listBottomPad },
            ]}
            showsVerticalScrollIndicator={false}
          />
          <View style={[styles.inputRow, { paddingBottom: inputBottomPad }]}>
            <View style={styles.capsule}>
              <RNTextInput
                value={input}
                onChangeText={setInput}
                placeholder="Ask anything"
                placeholderTextColor={c.tx3}
                style={styles.capsuleInput}
                editable={voiceSession === null}
                multiline={false}
                onSubmitEditing={handleSend}
                returnKeyType="send"
              />
              {input.trim().length > 0 ? (
                <TouchableOpacity onPress={handleSend} style={styles.capsuleInnerSend}>
                  <MaterialCommunityIcons name="send" size={22} color={c.amber} />
                </TouchableOpacity>
              ) : null}
            </View>
            <TouchableOpacity
              style={[
                styles.micOuter,
                voiceSession === 'listening' && styles.micOuterActive,
              ]}
              onPress={handleMicPress}
              accessibilityLabel={
                voiceSession === 'listening'
                  ? 'Stop recording and send, or wait for silence'
                  : 'Voice input'
              }
            >
              <MaterialCommunityIcons
                name={voiceSession === 'listening' ? 'stop' : 'microphone'}
                size={22}
                color={c.tx}
              />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      <Modal
        visible={voiceSession !== null}
        transparent
        animationType="fade"
        onRequestClose={cancelVoiceSession}
      >
        <View style={styles.voiceOverlay}>
          <TouchableOpacity
            style={[styles.voiceCloseBtn, { top: insets.top + 12 }]}
            onPress={cancelVoiceSession}
          >
            <Text style={styles.voiceCloseText}>Close</Text>
          </TouchableOpacity>
          <VoiceOrb
            mode={
              voiceSession === 'listening'
                ? 'listening'
                : voiceSession === 'speaking'
                  ? 'speaking'
                  : 'thinking'
            }
            active={voiceSession !== null}
          />
          {voiceSession === 'listening' ? <ListeningDots active /> : null}
          <Text style={styles.voiceHint}>
            {voiceSession === 'listening'
              ? 'Listening… stops and sends after 3s of silence, or tap mic'
              : voiceSession === 'thinking'
                ? 'Thinking…'
                : 'Speaking…'}
          </Text>
        </View>
      </Modal>
      <OfflineIndicator />
    </View>
  );
}

function createChatStyles(c: ThemeColors) {
  return StyleSheet.create({
    root: {
      flex: 1,
    },
    container: {
      flex: 1,
      backgroundColor: c.bg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingBottom: 12,
      paddingHorizontal: 4,
      backgroundColor: c.bg,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.borderDefault,
      zIndex: 10,
    },
    headerIconBtn: {
      margin: 0,
    },
    headerTitleCenter: {
      fontFamily: FONT_SERIF,
      fontSize: 18,
      fontWeight: '600',
      color: c.tx,
      flex: 1,
      textAlign: 'center',
    },
    headerRightSpacer: {
      width: 48,
    },
    messagesContainer: {
      flexGrow: 1,
      paddingHorizontal: 16,
      paddingTop: 12,
    },
    oracleAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      borderWidth: 2,
      borderColor: c.amberBorder,
      backgroundColor: c.bg2,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 8,
    },
    messageRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      marginBottom: 12,
    },
    botRow: {
      justifyContent: 'flex-start',
    },
    userRow: {
      justifyContent: 'flex-end',
    },
    avatar: {
      marginRight: 8,
      marginLeft: 8,
    },
    bubble: {
      maxWidth: '78%',
      borderRadius: 14,
      paddingVertical: 10,
      paddingHorizontal: 14,
    },
    botBubble: {
      backgroundColor: c.surf,
      borderTopLeftRadius: 4,
      borderWidth: 1,
      borderColor: c.borderDefault,
    },
    userBubble: {
      backgroundColor: c.blueBg,
      borderWidth: 1,
      borderColor: c.blueBorder,
      borderTopRightRadius: 4,
    },
    messageText: {
      fontFamily: FONT_SERIF,
      fontSize: 15,
      lineHeight: 22,
    },
    botText: {
      color: c.tx,
    },
    userText: {
      color: c.tx,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingTop: 10,
      backgroundColor: c.bg,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.borderDefault,
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 1100,
    },
    capsule: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.bg2,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: c.borderDefault,
      paddingLeft: 16,
      paddingRight: 6,
      minHeight: 48,
      maxHeight: 48,
    },
    capsuleInput: {
      flex: 1,
      fontFamily: FONT_SERIF,
      color: c.tx,
      fontSize: 16,
      paddingVertical: 10,
    },
    capsuleInnerSend: {
      padding: 8,
    },
    micOuter: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: c.bg2,
      borderWidth: 1,
      borderColor: c.borderDefault,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 10,
    },
    micOuterActive: {
      backgroundColor: 'rgba(220,38,38,0.25)',
      borderColor: 'rgba(220,38,38,0.5)',
    },
    voiceOverlay: {
      flex: 1,
      backgroundColor: 'rgba(15,15,20,0.96)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    voiceCloseBtn: {
      position: 'absolute',
      right: 16,
      padding: 12,
      zIndex: 10,
    },
    voiceCloseText: {
      fontFamily: FONT_SERIF,
      color: c.tx2,
      fontSize: 16,
    },
    voiceHint: {
      fontFamily: FONT_SERIF,
      marginTop: 28,
      color: c.tx2,
      fontSize: 15,
      textAlign: 'center',
      paddingHorizontal: 24,
    },
  });
} 