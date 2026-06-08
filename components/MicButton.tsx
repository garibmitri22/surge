'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

// Speech-to-text mic. Primary: record the utterance (MediaRecorder) and transcribe it
// server-side with Deepgram via /api/stt — accurate, works in EVERY browser (incl. Firefox),
// metered in hours. Calls onText with the final transcript to fill the field.
//
// Graceful fallback: if the key/API is unavailable or MediaRecorder isn't supported, fall back
// to the browser's free Web-Speech dictation so the mic never breaks. Renders nothing only when
// neither path exists. Three states: idle → recording → transcribing.

// --- Web-Speech fallback types -------------------------------------------------------------
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
function hasMediaRecording(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined';
}

type State = 'idle' | 'recording' | 'transcribing';

export function MicButton({ onText, disabled }: { onText: (t: string) => void; disabled?: boolean }) {
  // SSR snapshot = unsupported (no hydration mismatch); resolves on the client.
  const mediaSupported = useSyncExternalStore(() => () => {}, () => hasMediaRecording(), () => false);
  const webSpeechSupported = useSyncExternalStore(() => () => {}, () => !!getCtor(), () => false);
  const [state, setState] = useState<State>('idle');
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recRef = useRef<Recognition | null>(null);

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    try { recRef.current?.stop(); } catch { /* ignore */ }
  }, []);

  if (!mediaSupported && !webSpeechSupported) return null;

  function stopStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  // --- Web-Speech fallback (instant, browser-only) -----------------------------------------
  function startWebSpeech() {
    const Ctor = getCtor();
    if (!Ctor) { setState('idle'); return; }
    const rec = new Ctor();
    rec.lang = 'en-US'; rec.interimResults = true; rec.continuous = false;
    let finalText = '';
    rec.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript; else interim += r[0].transcript;
      }
      onText((finalText + interim).trim());
    };
    rec.onend = () => setState('idle');
    rec.onerror = () => setState('idle');
    recRef.current = rec;
    setState('recording');
    rec.start();
  }

  // --- Deepgram path (record → /api/stt) ---------------------------------------------------
  async function startMediaRecording() {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      if (webSpeechSupported) startWebSpeech(); else setState('idle'); // permission denied → fall back
      return;
    }
    streamRef.current = stream;
    const rec = new MediaRecorder(stream);
    const chunks: Blob[] = []; // local — captured by both handlers, no ref mutation
    rec.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); };
    rec.onstop = async () => {
      stopStream();
      const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
      if (blob.size === 0) { setState('idle'); return; }
      setState('transcribing');
      try {
        const res = await fetch('/api/stt', { method: 'POST', headers: { 'content-type': blob.type }, body: blob });
        if (!res.ok) throw new Error(String(res.status)); // 503 no-key / 502 error / 402 out-of-hours
        const data = await res.json();
        setState('idle');
        if (data?.transcript) onText(String(data.transcript));
      } catch {
        setState('idle');
        if (webSpeechSupported) startWebSpeech(); // server STT down → free dictation
      }
    };
    recorderRef.current = rec;
    rec.start();
    setState('recording');
  }

  function toggle() {
    if (disabled) return;
    if (state === 'transcribing') return; // let it finish
    if (state === 'recording') {
      if (recorderRef.current && recorderRef.current.state === 'recording') recorderRef.current.stop();
      else { try { recRef.current?.stop(); } catch { /* ignore */ } }
      return;
    }
    if (mediaSupported) startMediaRecording(); else startWebSpeech();
  }

  const recording = state === 'recording';
  const transcribing = state === 'transcribing';
  const label = recording ? 'Stop dictation' : transcribing ? 'Transcribing…' : 'Dictate';
  return (
    <button
      type="button"
      onClick={toggle}
      disabled={disabled || transcribing}
      aria-label={label}
      aria-pressed={recording}
      title={recording ? 'Stop' : transcribing ? 'Transcribing…' : 'Speak'}
      style={{
        flexShrink: 0, width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: '10px', border: '1px solid var(--border)',
        background: recording ? '#ef444418' : transcribing ? '#f59e0b18' : 'var(--surface)',
        color: recording ? '#ef4444' : transcribing ? '#f59e0b' : 'var(--text-secondary)',
        cursor: disabled || transcribing ? 'default' : 'pointer',
        animation: recording || transcribing ? 'pulse-amber 1.2s infinite' : 'none',
      }}
    >
      {transcribing ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="2" width="6" height="12" rx="3" />
          <path d="M5 10a7 7 0 0 0 14 0" />
          <line x1="12" y1="19" x2="12" y2="22" />
        </svg>
      )}
    </button>
  );
}
