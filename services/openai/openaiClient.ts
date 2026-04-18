/**
 * OpenAI REST helpers — Chat Completions + Whisper.
 * Set EXPO_PUBLIC_OPENAI_API_KEY in `.env` (Expo loads EXPO_PUBLIC_* at build time).
 */

const CHAT_URL = 'https://api.openai.com/v1/chat/completions';
const WHISPER_URL = 'https://api.openai.com/v1/audio/transcriptions';

export const OPENAI_CHAT_MODEL = 'gpt-4o-mini';

export function getOpenAIKey(): string | undefined {
  return process.env.EXPO_PUBLIC_OPENAI_API_KEY?.trim() || undefined;
}

export function assertOpenAIKey(): string {
  const k = getOpenAIKey();
  if (!k) {
    throw new Error(
      'Missing EXPO_PUBLIC_OPENAI_API_KEY. Add it to your .env and restart Expo.',
    );
  }
  return k;
}

export async function openaiChatCompletions(
  body: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<Response> {
  const key = assertOpenAIKey();
  return fetch(CHAT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: OPENAI_CHAT_MODEL,
      ...body,
    }),
    signal,
  });
}

/**
 * Stream chat completion; calls onDelta with accumulated assistant text.
 * Falls back to non-streaming JSON if the runtime has no response body reader.
 */
export async function openaiChatCompletionStreamed(
  body: Record<string, unknown>,
  onDelta: (accumulatedText: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const key = assertOpenAIKey();
  const res = await fetch(CHAT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: OPENAI_CHAT_MODEL,
      ...body,
      stream: true,
    }),
    signal,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI stream failed (${res.status}): ${err}`);
  }

  const reader = res.body?.getReader?.();
  if (!reader) {
    const fallback = await openaiChatCompletions({ ...body, stream: false }, signal);
    if (!fallback.ok) {
      const err = await fallback.text();
      throw new Error(`OpenAI fallback failed (${fallback.status}): ${err}`);
    }
    const data = (await fallback.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = data.choices?.[0]?.message?.content?.trim() ?? '';
    onDelta(text);
    return text;
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let full = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n');
    buffer = parts.pop() ?? '';
    for (const line of parts) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === '[DONE]') continue;
      try {
        const json = JSON.parse(payload) as {
          choices?: { delta?: { content?: string } }[];
        };
        const piece = json.choices?.[0]?.delta?.content;
        if (piece) {
          full += piece;
          onDelta(full);
        }
      } catch {
        /* ignore malformed SSE chunks */
      }
    }
  }

  if (buffer.trim()) {
    const trimmed = buffer.trim();
    if (trimmed.startsWith('data:')) {
      const payload = trimmed.slice(5).trim();
      if (payload && payload !== '[DONE]') {
        try {
          const json = JSON.parse(payload) as {
            choices?: { delta?: { content?: string } }[];
          };
          const piece = json.choices?.[0]?.delta?.content;
          if (piece) {
            full += piece;
            onDelta(full);
          }
        } catch {
          /* ignore */
        }
      }
    }
  }

  return full.trim();
}

/**
 * Transcribe local audio file (m4a from expo-av).
 * Whisper defaults to auto-detecting language, which can mis-guess (e.g. English speech → Arabic text).
 * We send `language` so transcription matches the app’s primary locale unless overridden.
 *
 * Set `EXPO_PUBLIC_WHISPER_LANGUAGE` to an ISO-639-1 code (`en`, `ar`, …) or leave unset for `en`.
 */
export async function transcribeAudioUri(uri: string): Promise<string> {
  const key = assertOpenAIKey();
  const form = new FormData();
  form.append('file', {
    uri,
    name: 'recording.m4a',
    type: 'audio/m4a',
  } as unknown as Blob);
  form.append('model', 'whisper-1');
  const whisperLang =
    process.env.EXPO_PUBLIC_WHISPER_LANGUAGE?.trim().toLowerCase() || 'en';
  if (whisperLang.length >= 2) {
    form.append('language', whisperLang.slice(0, 2));
  }
  /** Light vocabulary bias toward school / planning English (optional API field). */
  form.append(
    'prompt',
    'Classes, deadlines, tasks, chemistry, physics, design, calendar, today, tomorrow.',
  );

  const res = await fetch(WHISPER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
    },
    body: form,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Whisper failed (${res.status}): ${err}`);
  }

  const data = (await res.json()) as { text?: string };
  return (data.text ?? '').trim();
}
