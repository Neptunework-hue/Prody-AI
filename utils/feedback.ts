/**
 * Haptic + audio feedback utility.
 * Sounds are preloaded on first use and cached for zero-latency playback.
 * All calls are fire-and-forget — never throw.
 */
import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';
import { Audio } from 'expo-av';

// ── Sound cache ───────────────────────────────────────────────────────────────

type SoundKey = 'tap' | 'success' | 'complete';

const soundFiles: Record<SoundKey, any> = {
  tap:      require('../assets/sounds/tap.mp3'),
  success:  require('../assets/sounds/success.mp3'),
  complete: require('../assets/sounds/complete.mp3'),
};

const cache: Partial<Record<SoundKey, Audio.Sound>> = {};
let audioReady = false;

async function ensureAudioMode() {
  if (audioReady) return;
  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      allowsRecordingIOS: false,
    });
    audioReady = true;
  } catch {
    /* ignore */
  }
}

async function getSound(key: SoundKey): Promise<Audio.Sound | null> {
  if (cache[key]) return cache[key]!;
  try {
    await ensureAudioMode();
    const { sound } = await Audio.Sound.createAsync(soundFiles[key], {
      shouldPlay: false,
      volume: 0.6,
    });
    cache[key] = sound;
    return sound;
  } catch {
    return null;
  }
}

async function playSound(key: SoundKey) {
  try {
    const sound = await getSound(key);
    if (!sound) return;
    await sound.setPositionAsync(0);
    await sound.playAsync();
  } catch {
    /* ignore — never crash on missing sound */
  }
}

/** Preload all sounds at app start so first press has no lag */
export async function preloadSounds() {
  await Promise.allSettled([
    getSound('tap'),
    getSound('success'),
    getSound('complete'),
  ]);
}

// ── Sound helpers ─────────────────────────────────────────────────────────────

/** Soft click — nav, chips, small buttons */
export function soundTap() {
  void playSound('tap');
}

/** Pleasant ding — task completed, habit goal reached */
export function soundSuccess() {
  void playSound('success');
}

/** Richer completion — focus timer done */
export function soundComplete() {
  void playSound('complete');
}

// ── Haptic helpers ────────────────────────────────────────────────────────────

/** Light tap — nav items, chips, small buttons */
export function tapLight() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

/** Medium tap — primary action buttons */
export function tapMedium() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

/** Success pulse — task completed, habit goal reached */
export function feedbackSuccess() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  void playSound('success');
}

/** Warning pulse — task failed */
export function feedbackWarning() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
}

/** Heavy thud — focus session ended */
export function tapHeavy() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
}

// ── Combined helpers ──────────────────────────────────────────────────────────

/** Nav / button tap — sound + light haptic */
export function tap() {
  tapLight();
  soundTap();
}

// ── Speech ────────────────────────────────────────────────────────────────────

/** Spoken announcement when focus timer completes */
export function announceTimerComplete() {
  soundComplete();
  tapHeavy();
  Speech.stop();
  Speech.speak('Focus session complete. Great work!', {
    rate: 0.95,
    pitch: 1.0,
  });
}
