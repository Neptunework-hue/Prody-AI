import { Platform } from 'react-native';
import * as Speech from 'expo-speech';
import type { SpeechOptions } from 'expo-speech';
import { VoiceQuality } from 'expo-speech';

let cachedVoiceIdentifier: string | undefined | null = null;

/**
 * Pick a high-quality English voice once (Enhanced on iOS when available).
 */
export async function preloadBotVoice(): Promise<void> {
  if (cachedVoiceIdentifier !== null) return;
  cachedVoiceIdentifier = undefined;
  try {
    const voices = await Speech.getAvailableVoicesAsync();
    const english = voices.filter((v) => /^en(-|$)/i.test(v.language));
    const enhanced = english.find((v) => v.quality === VoiceQuality.Enhanced);
    const named =
      english.find((v) => /samantha|allison|ava|aaron|nicky|siri|google|natural/i.test(v.name)) ??
      english[0];
    cachedVoiceIdentifier = enhanced?.identifier ?? named?.identifier;
  } catch {
    cachedVoiceIdentifier = undefined;
  }
}

/** Slightly relaxed from default — closer to natural speech without sounding rushed. */
const TTS_RATE = Platform.OS === 'ios' ? 0.98 : 0.97;
const TTS_PITCH = 1.0;

export function getBotSpeechOptions(overrides?: SpeechOptions): SpeechOptions {
  return {
    language: 'en-US',
    pitch: TTS_PITCH,
    rate: TTS_RATE,
    ...overrides,
    ...(cachedVoiceIdentifier ? { voice: cachedVoiceIdentifier } : {}),
  };
}

export function speakBot(text: string, overrides?: SpeechOptions): void {
  Speech.speak(text, getBotSpeechOptions(overrides));
}
