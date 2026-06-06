'use client';

import { useRef, useState, useSyncExternalStore } from 'react';

// Speech-to-text mic for any text input (Web Speech API). Calls onText with the live
// transcript so it fills the field as you speak. Renders nothing on browsers without
// support (some desktop Firefox); works in Chrome/Edge/Safari incl. iOS.
// v1 = dictation into the field; real-time voice/TTS is a later step.

interface SpeechAlt { transcript: string }
interface SpeechResult { isFinal: boolean; 0: SpeechAlt }
interface SpeechEvent { resultIndex: number; results: { length: number;[i: number]: SpeechResult } }
interface Recognition {
  lang: string; interimResults: boolean; continuous: boolean;
  onresult: ((e: SpeechEvent) => void) | null;
  onend: (() => void) | null; onerror: (() => void) | null;
  start: () => void; stop: () => void;
}
type RecCtor = new () => Recognition;

function getCtor(): RecCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: RecCtor; webkitSpeechRecognition?: RecCtor };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function MicButton({ onText, disabled }: { onText: (t: string) => void; disabled?: boolean }) {
  // SSR snapshot = unsupported, so no hydration mismatch; resolves on the client.
  const supported = useSyncExternalStore(() => () => {}, () => !!getCtor(), () => false);
  const [listening, setListening] = useState(false);
  const recRef = useRef<Recognition | null>(null);

  if (!supported) return null;

  function toggle() {
    if (disabled) return;
    if (listening) { recRef.current?.stop(); return; }
    const Ctor = getCtor();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = 'en-US';
    rec.interimResults = true;
    rec.continuous = false;
    let finalText = '';
    rec.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript; else interim += r[0].transcript;
      }
      onText((finalText + interim).trim());
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={disabled}
      aria-label={listening ? 'Stop dictation' : 'Dictate'}
      title={listening ? 'Stop' : 'Speak'}
      style={{
        flexShrink: 0, width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: '10px', border: '1px solid var(--border)',
        background: listening ? '#ef444418' : 'var(--surface)',
        color: listening ? '#ef4444' : 'var(--text-secondary)',
        cursor: disabled ? 'default' : 'pointer',
        animation: listening ? 'pulse-amber 1.2s infinite' : 'none',
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="9" y="2" width="6" height="12" rx="3" />
        <path d="M5 10a7 7 0 0 0 14 0" />
        <line x1="12" y1="19" x2="12" y2="22" />
      </svg>
    </button>
  );
}
