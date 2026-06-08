'use client';

// Surge — voice output preference (mute). Accessibility: a single global switch the owner
// controls; when muted, no agent voice surfaces or plays. localStorage-backed so the choice
// sticks across reloads, with a tiny subscribe model so every SpeakButton + the Settings
// toggle stay in sync (including across tabs via the storage event).
import { useSyncExternalStore } from 'react';

const KEY = 'surge-voice-muted';
const listeners = new Set<() => void>();

function emit() { listeners.forEach((l) => l()); }

export function isVoiceMuted(): boolean {
  if (typeof window === 'undefined') return false;
  try { return window.localStorage.getItem(KEY) === '1'; } catch { return false; }
}

export function setVoiceMuted(muted: boolean): void {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(KEY, muted ? '1' : '0'); } catch { /* ignore */ }
  emit();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => { if (e.key === KEY) cb(); };
  if (typeof window !== 'undefined') window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(cb);
    if (typeof window !== 'undefined') window.removeEventListener('storage', onStorage);
  };
}

/** React hook: current mute state, reactive to changes from any SpeakButton or Settings. */
export function useVoiceMuted(): boolean {
  return useSyncExternalStore(subscribe, isVoiceMuted, () => false);
}
