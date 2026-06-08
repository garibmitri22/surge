'use client';

// useSpeechOrb — wire the orb to ACTUAL speech. Plays an agent line through the live
// ElevenLabs TTS (/api/tts), routes the audio through a Web Audio AnalyserNode, and hands that
// analyser to <PresenceOrb analyser={...} /> so the orb pulses to the real waveform — not a
// synthetic cadence. Falls back to a brief synthetic "talking" flag if TTS is unavailable
// (anonymous visitor / no key) so the orb still comes alive.

import { useCallback, useEffect, useRef, useState } from 'react';
import { forSpeech } from '@/lib/voices.mjs';

export function useSpeechOrb(employeeId: string) {
  const [speaking, setSpeaking] = useState(false);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const playingRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);
  const fallbackTimer = useRef<number | null>(null);

  useEffect(() => () => {
    try { playingRef.current?.pause(); } catch { /* ignore */ }
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    if (fallbackTimer.current) window.clearTimeout(fallbackTimer.current);
    try { ctxRef.current?.close(); } catch { /* ignore */ }
  }, []);

  const stop = useCallback(() => {
    try { playingRef.current?.pause(); } catch { /* ignore */ }
    if (fallbackTimer.current) { window.clearTimeout(fallbackTimer.current); fallbackTimer.current = null; }
    setSpeaking(false);
  }, []);

  const play = useCallback(async (text: string) => {
    const clean = forSpeech(text);
    if (!clean) return;
    try {
      const res = await fetch('/api/tts', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: clean, employeeId }) });
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = url;

      // Fresh element each play (createMediaElementSource is one-per-element); the analyser is
      // persistent, so every source feeds the SAME node that drives the orb.
      if (playingRef.current) { try { playingRef.current.pause(); } catch { /* ignore */ } }
      const audio = new Audio(url);
      audio.onended = () => setSpeaking(false);
      audio.onerror = () => setSpeaking(false);
      playingRef.current = audio;

      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (Ctx) {
        const ctx = ctxRef.current ?? new Ctx();
        ctxRef.current = ctx;
        await ctx.resume().catch(() => {});
        let an = analyserRef.current;
        if (!an) {
          an = ctx.createAnalyser();
          an.fftSize = 256;
          an.smoothingTimeConstant = 0.8;
          an.connect(ctx.destination);
          analyserRef.current = an;
          setAnalyser(an); // → fed straight into PresenceOrb
        }
        ctx.createMediaElementSource(audio).connect(an);
      }
      setSpeaking(true);
      await audio.play();
    } catch {
      // No live voice (anonymous / no key) — still bring the orb alive with a synthetic beat.
      setSpeaking(true);
      if (fallbackTimer.current) window.clearTimeout(fallbackTimer.current);
      fallbackTimer.current = window.setTimeout(() => setSpeaking(false), 2800);
    }
  }, [employeeId]);

  return { speaking, analyser, play, stop };
}
