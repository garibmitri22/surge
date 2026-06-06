'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

// Text-to-speech for an assistant reply (Web Speech API SpeechSynthesis). Tap to
// hear the message; tap again to stop. Each employee gets a DISTINCT voice so the
// team feels alive and individual — same browser voice set, but a per-employee
// voice pick + pitch/rate so Aria, Nova, Opus and Atlas never sound identical.
// Renders nothing where synthesis is unsupported. v1 of the "Jarvis feel" — voice
// INPUT already ships via MicButton; this is the spoken-reply half.

// Per-employee voice character. gender steers which system voice we pick; pitch/rate
// differentiate even when the browser only exposes one voice per gender. slot lets
// two same-gender employees land on different voices when several are available.
interface Profile { gender: 'female' | 'male'; pitch: number; rate: number; slot: number }
const VOICE_PROFILES: Record<string, Profile> = {
  aria:  { gender: 'female', pitch: 1.04, rate: 1.05, slot: 0 }, // sales — warm, brisk
  nova:  { gender: 'female', pitch: 1.16, rate: 1.10, slot: 1 }, // marketing — bright, fast
  opus:  { gender: 'male',   pitch: 0.86, rate: 1.00, slot: 1 }, // ops — steady, grounded
  atlas: { gender: 'male',   pitch: 0.94, rate: 0.98, slot: 0 }, // chief of staff — measured, calm
};
const DEFAULT_PROFILE: Profile = { gender: 'female', pitch: 1.0, rate: 1.04, slot: 0 };

// Ordered name hints — first match wins. Covers macOS/iOS (Samantha/Daniel…),
// Windows (Zira/David), and Chrome ("Google US English").
const FEMALE_HINTS = ['samantha', 'victoria', 'karen', 'tessa', 'fiona', 'moira', 'zira', 'susan', 'google us english', 'female'];
const MALE_HINTS = ['daniel', 'alex', 'david', 'mark', 'fred', 'rishi', 'google uk english male', 'male'];

function pickVoice(voices: SpeechSynthesisVoice[], gender: 'female' | 'male', slot: number): SpeechSynthesisVoice | null {
  const en = voices.filter((v) => /^en/i.test(v.lang));
  const pool = en.length ? en : voices;
  if (pool.length === 0) return null;
  const hints = gender === 'male' ? MALE_HINTS : FEMALE_HINTS;
  const matches: SpeechSynthesisVoice[] = [];
  for (const h of hints) {
    for (const v of pool) {
      if (v.name.toLowerCase().includes(h) && !matches.includes(v)) matches.push(v);
    }
  }
  if (matches.length) return matches[slot % matches.length];
  return pool[slot % pool.length]; // no gendered match — at least keep employees distinct
}

// Strip markdown / emoji so the speech sounds natural rather than reading "asterisk".
function forSpeech(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' code block ')
    .replace(/[*_`#>]/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function SpeakButton({ text, employeeId, size = 26 }: { text: string; employeeId: string; size?: number }) {
  // SSR snapshot = unsupported (no hydration mismatch); resolves on the client.
  const supported = useSyncExternalStore(
    () => () => {},
    () => typeof window !== 'undefined' && 'speechSynthesis' in window,
    () => false
  );
  const [speaking, setSpeaking] = useState(false);
  const uttRef = useRef<SpeechSynthesisUtterance | null>(null);

  // If this button unmounts mid-speech, stop the audio.
  useEffect(() => () => { if (uttRef.current) window.speechSynthesis.cancel(); }, []);

  if (!supported) return null;

  function toggle() {
    const synth = window.speechSynthesis;
    if (speaking) { synth.cancel(); setSpeaking(false); return; }
    const clean = forSpeech(text);
    if (!clean) return;
    synth.cancel(); // clear anything another button queued
    const u = new SpeechSynthesisUtterance(clean);
    const prof = VOICE_PROFILES[employeeId] ?? DEFAULT_PROFILE;
    const voice = pickVoice(synth.getVoices(), prof.gender, prof.slot);
    if (voice) u.voice = voice;
    u.pitch = prof.pitch;
    u.rate = prof.rate;
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    uttRef.current = u;
    setSpeaking(true);
    synth.speak(u);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={speaking ? 'Stop reading aloud' : 'Read aloud'}
      title={speaking ? 'Stop' : 'Read aloud'}
      style={{
        flexShrink: 0, width: `${size}px`, height: `${size}px`, display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: '8px', border: '1px solid var(--border)',
        background: speaking ? '#f59e0b18' : 'transparent',
        color: speaking ? '#f59e0b' : 'var(--text-dim)',
        cursor: 'pointer', padding: 0,
        animation: speaking ? 'pulse-amber 1.2s infinite' : 'none',
      }}
    >
      {speaking ? (
        <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
          <rect x="6" y="6" width="12" height="12" rx="2" />
        </svg>
      ) : (
        <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 5 6 9H2v6h4l5 4V5z" />
          <path d="M15.5 8.5a5 5 0 0 1 0 7" />
          <path d="M18.5 5.5a9 9 0 0 1 0 13" />
        </svg>
      )}
    </button>
  );
}
