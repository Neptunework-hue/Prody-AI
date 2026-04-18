/**
 * PRODY — OpenAI tool-calling agent loop.
 * The model chooses tools from meaning; this module executes them and feeds results back.
 */

import { openaiChatCompletions } from '../openai/openaiClient';
import { offlineTaskService } from '../offline/taskService';
import {
  addTaskFolder,
  getOrCreateTaskFolderByName,
  getTaskFolders,
} from '../foldersStorage';
import { formatDateForStorage } from '../../utils/dateUtils';
import type { Task, TaskCreate, TaskPriority } from '../../types/task';

const MAX_TOOL_ROUNDS = 8;

const TOOL_SYSTEM_SUFFIX = `

You can call tools to change the user's quest list and calendar. Rules:
- Prefer **plan_study_tasks** when they want several study/exam/project tasks, things on different days, or work grouped into folders (smarter than many single createTask calls).
- Call **getTasks** (or **getCalendarEvents**) before **updateTask** if you need to see titles/ids.
- Use **createTask** for a single clear action; optional **folderName** puts it in that folder (created if missing).
- Use **createTaskFolder** when they only want a folder by name.
- After tools succeed, reply in a short, human way (no "task created successfully" boilerplate).`;

export const PRODY_TOOLS: Record<string, unknown>[] = [
  {
    type: 'function',
    function: {
      name: 'plan_study_tasks',
      description:
        'Best for multiple exams/study blocks, spreading work across days, or grouping tasks into folders. Runs the structured planner on what the user said.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'createTaskFolder',
      description: 'Create a task folder (bucket) the user can file tasks under.',
      parameters: {
        type: 'object',
        properties: { name: { type: 'string', description: 'Folder name' } },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'createTask',
      description: 'Create one task on the calendar when dates/times are known.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          deadline: { type: 'string', description: 'YYYY-MM-DD' },
          startTime: { type: 'string' },
          endTime: { type: 'string' },
          priority: { type: 'number', description: '0–3' },
          folderName: { type: 'string', description: 'Optional folder; created if missing' },
        },
        required: ['title'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'createTasks',
      description: 'Create several tasks at once. Each item may include folderName.',
      parameters: {
        type: 'object',
        properties: {
          tasks: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                description: { type: 'string' },
                deadline: { type: 'string' },
                startTime: { type: 'string' },
                endTime: { type: 'string' },
                folderName: { type: 'string' },
              },
              required: ['title'],
            },
          },
        },
        required: ['tasks'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'createSubtasks',
      description: 'Add subtasks under an existing parent task (match by title).',
      parameters: {
        type: 'object',
        properties: {
          parentTaskTitle: { type: 'string' },
          subtasks: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                description: { type: 'string' },
                priority: { type: 'number' },
              },
              required: ['title'],
            },
          },
        },
        required: ['parentTaskTitle', 'subtasks'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'updateTask',
      description: 'Update a task by id or by matching title.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          matchTitle: { type: 'string', description: 'Fuzzy title if id unknown' },
          title: { type: 'string' },
          description: { type: 'string' },
          deadline: { type: 'string' },
          startTime: { type: 'string' },
          endTime: { type: 'string' },
          starttime: { type: 'string' },
          endtime: { type: 'string' },
          status: { type: 'string' },
          priority: { type: 'number' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getTasks',
      description: "List the user's tasks (summary for planning).",
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getCalendarEvents',
      description: 'Tasks that have dates (calendar view).',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'proposeSchedule',
      description: 'Optional: outline a schedule in words only (nothing saved). Prefer plan_study_tasks or createTasks to persist.',
      parameters: {
        type: 'object',
        properties: { details: { type: 'string' } },
        required: ['details'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'confirmSchedule',
      description: 'Same as createTasks — persists a list of tasks.',
      parameters: {
        type: 'object',
        properties: {
          tasks: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                description: { type: 'string' },
                deadline: { type: 'string' },
                starttime: { type: 'string' },
                endtime: { type: 'string' },
                folderName: { type: 'string' },
              },
              required: ['title'],
            },
          },
        },
        required: ['tasks'],
      },
    },
  },
];

export type ProdyAgentHistoryMsg = { sender: 'user' | 'bot'; text: string };

export type ProdyAgentHooks = {
  onTaskMutated?: () => void;
  registerLastBotTask?: (t: { id: string; title: string }) => void;
  registerLastCreatedTask?: (t: { id: string; title: string; description?: string }) => void;
  runStructuredPlan: (
    userMessage: string,
  ) => Promise<{ ok: boolean; replyText?: string; suggestions?: string[] } | null>;
};

type ToolCtx = { userId: string; userMessage: string; hooks: ProdyAgentHooks };

function todayYmd(): string {
  return formatDateForStorage(new Date());
}

async function resolveFolderId(userId: string, folderName?: string): Promise<string | null> {
  if (!folderName?.trim()) return null;
  const f = await getOrCreateTaskFolderByName(userId, folderName.trim());
  return f.id;
}

function findTask(all: Task[], id?: string, matchTitle?: string): Task | undefined {
  if (id) {
    const t = all.find((x) => x.id === id);
    if (t) return t;
  }
  if (matchTitle?.trim()) {
    const q = matchTitle.trim().toLowerCase();
    return all.find(
      (x) =>
        x.title.toLowerCase() === q ||
        x.title.toLowerCase().includes(q) ||
        q.includes(x.title.toLowerCase()),
    );
  }
  return undefined;
}

async function executeProdyTool(name: string, argsJson: string, ctx: ToolCtx): Promise<string> {
  let args: Record<string, unknown> = {};
  try {
    args = JSON.parse(argsJson || '{}') as Record<string, unknown>;
  } catch {
    return JSON.stringify({ error: 'invalid_json_arguments' });
  }

  const { userId, userMessage, hooks } = ctx;
  const bump = () => {
    if (hooks.onTaskMutated) setTimeout(hooks.onTaskMutated, 80);
  };
  const reg = (task: Task) => {
    hooks.registerLastBotTask?.({ id: task.id, title: task.title });
    hooks.registerLastCreatedTask?.({
      id: task.id,
      title: task.title,
      description: task.description,
    });
  };

  try {
    switch (name) {
      case 'plan_study_tasks': {
        const out = await hooks.runStructuredPlan(userMessage);
        if (!out?.ok) {
          return JSON.stringify({
            ok: false,
            error: 'planner_failed',
            hint: 'Try createTasks or createTask with explicit titles and dates.',
          });
        }
        bump();
        return JSON.stringify({
          ok: true,
          planner_reply: out.replyText ?? '',
          suggestions: out.suggestions ?? [],
        });
      }
      case 'createTaskFolder': {
        const n = String(args.name ?? '').trim();
        if (!n) return JSON.stringify({ error: 'missing_name' });
        const existing = await getTaskFolders(userId);
        if (existing.some((f) => f.name.toLowerCase() === n.toLowerCase())) {
          return JSON.stringify({ ok: true, duplicate: true, name: n });
        }
        const folder = await addTaskFolder(userId, n);
        return JSON.stringify({ ok: true, folderId: folder.id, name: folder.name });
      }
      case 'createTask': {
        const title = String(args.title ?? '').trim();
        if (!title) return JSON.stringify({ error: 'missing_title' });
        const deadline = (args.deadline as string | undefined)?.trim() || todayYmd();
        const folderId = await resolveFolderId(userId, args.folderName as string | undefined);
        const pr = args.priority;
        const priority =
          typeof pr === 'number' && pr >= 0 && pr <= 3 ? (Math.floor(pr) as TaskPriority) : undefined;
        const payload: TaskCreate = {
          title,
          description: (args.description as string | undefined)?.trim(),
          deadline,
          ...(args.startTime ? { startTime: String(args.startTime) } : {}),
          ...(args.endTime ? { endTime: String(args.endTime) } : {}),
          ...(priority !== undefined ? { priority } : {}),
          ...(folderId ? { folder_id: folderId } : {}),
        };
        const task = await offlineTaskService.createTask(payload, userId);
        reg(task);
        bump();
        return JSON.stringify({ ok: true, taskId: task.id, title: task.title });
      }
      case 'createTasks':
      case 'confirmSchedule': {
        const list = args.tasks as Record<string, unknown>[] | undefined;
        if (!Array.isArray(list) || list.length === 0) {
          return JSON.stringify({ error: 'missing_tasks_array' });
        }
        const created: { id: string; title: string }[] = [];
        for (const row of list) {
          const title = String(row.title ?? '').trim();
          if (!title) continue;
          const deadline = (row.deadline as string | undefined)?.trim() || todayYmd();
          const st = (row.startTime ?? row.starttime) as string | undefined;
          const en = (row.endTime ?? row.endtime) as string | undefined;
          const folderId = await resolveFolderId(userId, row.folderName as string | undefined);
          const task = await offlineTaskService.createTask(
            {
              title,
              description: (row.description as string | undefined)?.trim(),
              deadline,
              ...(st ? { startTime: st } : {}),
              ...(en ? { endTime: en } : {}),
              ...(folderId ? { folder_id: folderId } : {}),
            },
            userId,
          );
          created.push({ id: task.id, title: task.title });
          reg(task);
        }
        bump();
        return JSON.stringify({ ok: true, created_count: created.length, tasks: created });
      }
      case 'createSubtasks': {
        const parentTitle = String(args.parentTaskTitle ?? '').trim();
        const subs = args.subtasks as { title?: string; description?: string; priority?: number }[];
        if (!parentTitle || !Array.isArray(subs) || subs.length === 0) {
          return JSON.stringify({ error: 'missing_parent_or_subtasks' });
        }
        const all = await offlineTaskService.getTasks(userId);
        const parent = findTask(all, undefined, parentTitle);
        if (!parent) {
          return JSON.stringify({ error: 'parent_not_found', parentTaskTitle: parentTitle });
        }
        let n = 0;
        for (const s of subs) {
          const st = (s.title ?? '').trim();
          if (!st) continue;
          const pr = s.priority;
          const priority =
            typeof pr === 'number' && pr >= 0 && pr <= 3 ? (Math.floor(pr) as TaskPriority) : (1 as TaskPriority);
          await offlineTaskService.createTask(
            {
              title: st,
              description: s.description?.trim(),
              priority,
              parent_task_id: parent.id,
            },
            userId,
          );
          n += 1;
        }
        bump();
        return JSON.stringify({ ok: true, parent: parent.title, subtasks_created: n });
      }
      case 'updateTask': {
        const all = await offlineTaskService.getTasks(userId);
        const id = (args.id as string | undefined)?.trim();
        const matchTitle = (args.matchTitle as string | undefined)?.trim();
        const t = findTask(all, id, matchTitle);
        if (!t) return JSON.stringify({ error: 'task_not_found' });
        const updates: Record<string, unknown> = {};
        if (typeof args.title === 'string' && args.title.trim()) updates.title = args.title.trim();
        if (typeof args.description === 'string') updates.description = args.description;
        if (typeof args.deadline === 'string' && args.deadline.trim()) updates.deadline = args.deadline.trim();
        const st = (args.startTime ?? args.starttime) as string | undefined;
        const en = (args.endTime ?? args.endtime) as string | undefined;
        if (st) updates.startTime = st;
        if (en) updates.endTime = en;
        if (typeof args.status === 'string') updates.status = args.status;
        if (typeof args.priority === 'number') updates.priority = Math.min(3, Math.max(0, args.priority));
        if (Object.keys(updates).length === 0) {
          return JSON.stringify({ error: 'no_update_fields' });
        }
        await offlineTaskService.updateTask(t.id, updates as Partial<Task>);
        bump();
        return JSON.stringify({ ok: true, taskId: t.id, title: t.title, updated_fields: Object.keys(updates) });
      }
      case 'getTasks': {
        const all = await offlineTaskService.getTasks(userId);
        const parents = all.filter((x) => !x.parent_task_id).slice(0, 40);
        return JSON.stringify({
          count: all.length,
          tasks: parents.map((x) => ({
            id: x.id,
            title: x.title,
            deadline: x.deadline,
            status: x.status,
            priority: x.priority,
            folder_id: x.folder_id,
          })),
        });
      }
      case 'getCalendarEvents': {
        const all = await offlineTaskService.getTasks(userId);
        const withDates = all.filter((x) => x.deadline).slice(0, 40);
        return JSON.stringify({
          count: withDates.length,
          events: withDates.map((x) => ({
            id: x.id,
            title: x.title,
            deadline: x.deadline,
            startTime: x.startTime,
            endTime: x.endTime,
          })),
        });
      }
      case 'proposeSchedule': {
        return JSON.stringify({
          ok: true,
          note: 'Outline only — use plan_study_tasks or createTasks to save to the calendar.',
          details: String(args.details ?? ''),
        });
      }
      default:
        return JSON.stringify({ error: 'unknown_tool', name });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return JSON.stringify({ error: 'tool_execution_failed', message: msg });
  }
}

function defaultSuggestions(): string[] {
  return ['Show my tasks', 'Plan my week', 'Create a task'];
}

export async function runProdyToolAgentLoop(params: {
  userMessage: string;
  history: ProdyAgentHistoryMsg[];
  systemPrompt: string;
  userId: string;
  signal: AbortSignal;
  hooks: ProdyAgentHooks;
  temperature?: number;
  maxTokens?: number;
  onStreamDelta?: (text: string) => void;
}): Promise<{ text: string; suggestions: string[] }> {
  const {
    userMessage,
    history,
    systemPrompt,
    userId,
    signal,
    hooks,
    onStreamDelta,
    temperature = 0.5,
    maxTokens = 900,
  } = params;

  const messages: Record<string, unknown>[] = [
    { role: 'system', content: `${systemPrompt}${TOOL_SYSTEM_SUFFIX}` },
    ...history.map((h) => ({
      role: h.sender === 'user' ? 'user' : 'assistant',
      content: h.text,
    })),
    { role: 'user', content: userMessage },
  ];

  const toolCtx: ToolCtx = { userId, userMessage, hooks };
  let lastPlannerSuggestions: string[] | undefined;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const res = await openaiChatCompletions(
      {
        messages,
        tools: PRODY_TOOLS,
        tool_choice: 'auto',
        temperature,
        max_tokens: maxTokens,
        top_p: 0.9,
      },
      signal,
    );

    if (!res.ok) {
      const err = await res.text();
      return {
        text: `Sorry — I couldn’t reach the AI (${res.status}). ${err.slice(0, 160)}`,
        suggestions: [],
      };
    }

    const data = (await res.json()) as {
      choices?: Array<{
        finish_reason?: string;
        message?: {
          role?: string;
          content?: string | null;
          tool_calls?: Array<{
            id: string;
            type: string;
            function: { name: string; arguments: string };
          }>;
        };
      }>;
    };

    const choice = data.choices?.[0];
    const msg = choice?.message;
    if (!msg) {
      return { text: 'Something went wrong — try that again?', suggestions: defaultSuggestions() };
    }

    const toolCalls = msg.tool_calls;
    if (toolCalls && toolCalls.length > 0) {
      messages.push({
        role: 'assistant',
        content: msg.content ?? null,
        tool_calls: toolCalls.map((tc) => ({
          id: tc.id,
          type: 'function',
          function: { name: tc.function.name, arguments: tc.function.arguments || '{}' },
        })),
      });

      for (const tc of toolCalls) {
        const content = await executeProdyTool(
          tc.function.name,
          tc.function.arguments || '{}',
          toolCtx,
        );
        if (tc.function.name === 'plan_study_tasks') {
          try {
            const j = JSON.parse(content) as { suggestions?: string[] };
            if (Array.isArray(j.suggestions) && j.suggestions.length > 0) {
              lastPlannerSuggestions = j.suggestions;
            }
          } catch {
            /* ignore */
          }
        }
        messages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content,
        });
      }
      continue;
    }

    const text = (msg.content ?? '').trim() || 'Tell me what you’re trying to line up.';
    if (onStreamDelta) onStreamDelta(text);
    return {
      text,
      suggestions: lastPlannerSuggestions?.length ? lastPlannerSuggestions : defaultSuggestions(),
    };
  }

  return {
    text: 'That needed too many steps at once — try splitting it into two messages?',
    suggestions: lastPlannerSuggestions?.length ? lastPlannerSuggestions : defaultSuggestions(),
  };
}
