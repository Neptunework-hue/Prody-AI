import { Platform } from 'react-native';
import * as Speech from 'expo-speech';
import { Audio } from 'expo-av';
import { getOpenAIKey } from '../services/openai/openaiClient';

let currentSound: Audio.Sound | null = null;

const FALLBACK_RATE = Platform.OS === 'ios' ? 0.82 : 0.85;
const FALLBACK_PITCH = 1.0;

export async function preloadBotVoice(): Promise<void> {
  // Kept for compatibility with existing chat.tsx
  return;
}

async function stopCurrentSound() {
  if (currentSound) {
    try {
      await currentSound.stopAsync();
      await currentSound.unloadAsync();
    } catch {
      // ignore
    }
    currentSound = null;
  }
}

function fallbackSpeak(text: string) {
  Speech.speak(text, {
    language: 'en-US',
    rate: FALLBACK_RATE,
    pitch: FALLBACK_PITCH,
  });
}

type SpeakBotCallbacks = {
  onDone?: () => void;
  onStopped?: () => void;
  onError?: () => void;
};

export async function speakBot(
  text: string,
  callbacks?: SpeakBotCallbacks
): Promise<void> {
  const apiKey = getOpenAIKey();

  Speech.stop();
  await stopCurrentSound();

  if (!apiKey) {
    Speech.speak(text, {
      language: 'en-US',
      rate: FALLBACK_RATE,
      pitch: FALLBACK_PITCH,
      onDone: callbacks?.onDone,
      onStopped: callbacks?.onStopped,
      onError: callbacks?.onError,
    });
    return;
  }

  try {
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini-tts',
        voice: 'alloy',
        input: text,
        format: 'mp3',
      }),
    });

    if (!response.ok) {
      callbacks?.onError?.();
      return;
    }

    const audioBlob = await response.blob();
    const reader = new FileReader();

    reader.onloadend = async () => {
      try {
        const base64Audio = reader.result as string;

        const { sound } = await Audio.Sound.createAsync({
          uri: base64Audio,
        });

        currentSound = sound;

        sound.setOnPlaybackStatusUpdate((status) => {
          if (!status.isLoaded) return;

          if (status.didJustFinish) {
            callbacks?.onDone?.();

            sound.unloadAsync().catch(() => {});

            if (currentSound === sound) {
              currentSound = null;
            }
          }
        });

        await sound.playAsync();
      } catch (error) {
        console.error('Playback error:', error);
        callbacks?.onError?.();
      }
    };

    reader.onerror = () => {
      callbacks?.onError?.();
    };

    reader.readAsDataURL(audioBlob);
  } catch (error) {
    console.error('TTS error:', error);
    callbacks?.onError?.();
  }
}

export async function stopBotSpeech(): Promise<void> {
  Speech.stop();
  await stopCurrentSound();
}