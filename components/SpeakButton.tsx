'use client';

import { useEffect, useRef, useState } from 'react';
import { forSpeech } from '@/lib/voices.mjs';
import { useVoiceMuted } from '@/lib/voice-prefs';

// Read an assistant reply aloud in the employee's REAL voice.
//
// Primary: ElevenLabs per-agent TTS via /api/tts (Atlas/Aria/Nova/Opus each sound like a
// distinct person — the JARVIS upgrade). Tap to play, tap to stop. The fetched audio is
// cached per message so a replay neither re-calls ElevenLabs nor re-charges hours.
//
// Graceful fallback: if the key/API is unavailable (503/502/network), we fall back to the
// browser's free Web-Speech voice so the UI never breaks. Accessible: explicit play/stop
// labels, no autoplay (only on tap), and a global mute setting hides the control entirely.

// --- Web-Speech fallback voice character (only used when ElevenLabs is unavailable) -------
interface Profile { gender: 'female' | 'male'; pitch: number; rate: number; slot: number }
const VOICE_PROFILES: Record<string, Profile> = {
  aria:  { gender: 'female', pitch: 1.04, rate: 1.05, slot: 0 },
  nova:  { gender: 'female', pitch: 1.16, rate: 1.10, slot: 1 },
  opus:  { gender: 'male',   pitch: 0.86, rate: 1.00, slot: 1 },
  atlas: { gender: 'male',   pitch: 0.94, rate: 0.98, slot: 0 },
};
const DEFAULT_PROFILE: Profile = { gender: 'female', pitch: 1.0, rate: 1.04, slot: 0 };
const FEMALE_HINTS = ['samantha', 'victoria', 'karen', 'tessa', 'fiona', 'moira', 'zira', 'susan', 'google us english', 'female'];
const MALE_HINTS = ['daniel', 'alex', 'david', 'mark', 'fred', 'rishi', 'google uk english male', 'male'];
function pickVoice(voices: SpeechSynthesisVoice[], gender: 'female' | 'male', slot: number): SpeechSynthesisVoice | null {
  const en = voices.filter((v) => /^en/i.test(v.lang));
  const pool = en.length ? en : voices;
  if (pool.length === 0) return null;
  const hints = gender === 'male' ? MALE_HINTS : FEMALE_HINTS;
  const matches: SpeechSynthesisVoice[] = [];
  for (const h of hints) for (const v of pool) if (v.name.toLowerCase().includes(h) && !matches.includes(v)) matches.push(v);
  if (matches.length) return matches[slot % matches.length];
  return pool[slot % pool.length];
}

const cacheKey = (text: string, employeeId: string) => `${employeeId}::${text}`;

export function SpeakButton({ text, employeeId, size = 26 }: { text: string; employeeId: string; size?: number }) {
  const muted = useVoiceMuted();
  const [speaking, setSpeaking] = useState(false);
  const [loading, setLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const cacheRef = useRef<{ key: string; url: string } | null>(null);
  const uttRef = useRef<SpeechSynthesisUtterance | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Tear everything down on unmount: stop audio + speech, cancel any in-flight fetch, free the blob.
  useEffect(() => () => {
    if (audioRef.current) audioRef.current.pause();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window && uttRef.current) window.speechSynthesis.cancel();
    if (abortRef.current) abortRef.current.abort();
    if (cacheRef.current) URL.revokeObjectURL(cacheRef.current.url);
  }, []);

  // A mute setting hides the voice surface entirely (no surprise sound, nothing to stop).
  if (muted) return null;

  function stopWebSpeech() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
  }

  function speakWebSpeech(clean: string) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) { setSpeaking(false); return; }
    const synth = window.speechSynthesis;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(clean);
    const prof = VOICE_PROFILES[employeeId] ?? DEFAULT_PROFILE;
    const voice = pickVoice(synth.getVoices(), prof.gender, prof.slot);
    if (voice) u.voice = voice;
    u.pitch = prof.pitch; u.rate = prof.rate;
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    uttRef.current = u;
    setSpeaking(true);
    synth.speak(u);
  }

  function playUrl(url: string, clean: string) {
    stopWebSpeech();
    if (audioRef.current) audioRef.current.pause(); // stop anything already playing
    const audio = new Audio(url); // fresh element each play — never mutate the ref-held one
    audio.onended = () => setSpeaking(false);
    audio.onerror = () => setSpeaking(false);
    audioRef.current = audio;
    setSpeaking(true);
    // Seam for the presence orb (Track B): expose the live element so it can attach an analyser.
    try { window.dispatchEvent(new CustomEvent('surge:voice', { detail: { employeeId, audio } })); } catch { /* ignore */ }
    audio.play().catch(() => { setSpeaking(false); speakWebSpeech(clean); }); // playback blocked → free voice
  }

  function stop() {
    if (abortRef.current) { abortRef.current.abort(); abortRef.current = null; }
    if (audioRef.current) audioRef.current.pause();
    stopWebSpeech();
    setLoading(false);
    setSpeaking(false);
  }

  async function play() {
    const clean = forSpeech(text);
    if (!clean) return;
    // Replay cached audio — no second ElevenLabs call, no second charge.
    if (cacheRef.current && cacheRef.current.key === cacheKey(clean, employeeId)) {
      playUrl(cacheRef.current.url, clean);
      return;
    }
    setLoading(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const res = await fetch('/api/tts', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: clean, employeeId }), signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(String(res.status)); // 503 no-key / 502 error / 402 out-of-hours → fall back
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      if (cacheRef.current) URL.revokeObjectURL(cacheRef.current.url);
      cacheRef.current = { key: cacheKey(clean, employeeId), url };
      abortRef.current = null;
      setLoading(false);
      playUrl(url, clean);
    } catch (e) {
      abortRef.current = null;
      setLoading(false);
      if (e instanceof DOMException && e.name === 'AbortError') return; // user pressed stop
      speakWebSpeech(clean); // graceful fallback to the free browser voice
    }
  }

  function toggle() {
    if (speaking || loading) { stop(); return; }
    play();
  }

  const active = speaking || loading;
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={active ? 'Stop reading aloud' : 'Read aloud'}
      aria-pressed={active}
      title={loading ? 'Loading voice…' : speaking ? 'Stop' : 'Read aloud'}
      style={{
        flexShrink: 0, width: `${size}px`, height: `${size}px`, display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: '8px', border: '1px solid var(--border)',
        background: active ? '#f59e0b18' : 'transparent',
        color: active ? '#f59e0b' : 'var(--text-dim)',
        cursor: 'pointer', padding: 0,
        animation: active ? 'pulse-amber 1.2s infinite' : 'none',
      }}
    >
      {active ? (
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
