'use client';

import { useEffect, useRef, useState } from 'react';
import { ConversationProvider, useConversation } from '@elevenlabs/react';
import { PresenceOrb } from '@/components/PresenceOrb';
import type { OrbState } from '@/lib/persona-orb';

// JARVIS Phase 3 — hands-free live conversation with Atlas. Tap once; Atlas greets, you talk back
// continuously, and interrupt him mid-sentence (native barge-in). The ElevenLabs Agent is fully
// configured (persona + greeting + Gemini LLM + Eric voice) in the ElevenLabs dashboard, so we just
// connect to it with a signed URL. The orb pulses to the live agent audio. Metered per minute.
//
// Graceful: if the agent/keys aren't configured the session call returns 503 and we show a
// quiet "not enabled yet" note instead of breaking the dashboard.

function VoiceChatInner({ employeeId = 'atlas' }: { employeeId?: string }) {
  const startedAt = useRef<number>(0);
  const rafRef = useRef(0);
  const [error, setError] = useState<string>('');
  const [connecting, setConnecting] = useState(false);
  const [liveLevel, setLiveLevel] = useState(0);

  const conversation = useConversation({
    onConnect: () => { startedAt.current = Date.now(); setConnecting(false); setError(''); },
    onDisconnect: () => {
      setConnecting(false);
      const seconds = startedAt.current ? Math.round((Date.now() - startedAt.current) / 1000) : 0;
      startedAt.current = 0;
      if (seconds > 0) {
        fetch('/api/voice/meter', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ seconds }) }).catch(() => {});
      }
    },
    onError: (message) => { setConnecting(false); setError(typeof message === 'string' ? message : 'Voice error'); },
  });

  const { status, isSpeaking, isMuted, setMuted, startSession, endSession, getOutputByteFrequencyData } = conversation;
  const live = status === 'connected';

  // Drive the orb from the LIVE agent audio amplitude while connected.
  useEffect(() => {
    if (!live) { cancelAnimationFrame(rafRef.current); return; }
    let last = 0;
    const tick = (t: number) => {
      rafRef.current = requestAnimationFrame(tick);
      if (t - last < 70) return;
      last = t;
      try {
        const data = getOutputByteFrequencyData();
        if (data && data.length) {
          let sum = 0;
          for (let i = 0; i < data.length; i++) sum += data[i];
          setLiveLevel(Math.min(1, (sum / (data.length * 255)) * 5));
        }
      } catch { /* ignore */ }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [live, getOutputByteFrequencyData]);

  async function start() {
    if (connecting || live) return;
    setError('');
    setConnecting(true);
    try {
      const res = await fetch('/api/voice/session', { method: 'POST' });
      if (res.status === 503) { setConnecting(false); setError('Live voice isn’t enabled yet — add the ElevenLabs agent + keys.'); return; }
      if (!res.ok) { setConnecting(false); setError('Couldn’t start the call.'); return; }
      const data = await res.json();
      startSession({ signedUrl: data.signedUrl, connectionType: 'websocket' });
    } catch {
      setConnecting(false);
      setError('Couldn’t reach the voice service.');
    }
  }

  const orbState: OrbState = isSpeaking ? 'talking' : live ? 'idle' : connecting ? 'thinking' : 'idle';
  const statusLabel = connecting ? 'Connecting…' : !live ? '' : isSpeaking ? 'Atlas is speaking…' : isMuted ? 'Muted' : 'Listening…';

  if (!live && !connecting) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-start' }}>
        <button
          type="button"
          onClick={start}
          aria-label="Talk to Atlas hands-free"
          style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--accent, #f59e0b)', color: '#fff', border: 'none', borderRadius: '999px', padding: '9px 16px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', boxShadow: 'var(--shadow)' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0 0 14 0" /><line x1="12" y1="19" x2="12" y2="22" />
          </svg>
          Talk to Atlas
        </button>
        {error && <span style={{ fontSize: '11px', color: 'var(--amber, #f59e0b)' }}>{error}</span>}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '14px', padding: '12px 16px', boxShadow: 'var(--shadow)' }}>
      <PresenceOrb employeeId={employeeId} state={orbState} size={56} level={live ? Math.max(liveLevel, isSpeaking ? 0.15 : 0) : 0} aria-label="Atlas presence" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>Atlas · live</p>
        <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }} aria-live="polite">{statusLabel}</p>
      </div>
      <button
        type="button"
        onClick={() => setMuted(!isMuted)}
        disabled={!live}
        aria-label={isMuted ? 'Unmute your microphone' : 'Mute your microphone'}
        aria-pressed={isMuted}
        title={isMuted ? 'Unmute' : 'Mute'}
        style={{ flexShrink: 0, width: '38px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '10px', border: '1px solid var(--border)', background: isMuted ? '#ef444418' : 'var(--surface)', color: isMuted ? '#ef4444' : 'var(--text-secondary)', cursor: 'pointer' }}
      >
        {isMuted ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="2" y1="2" x2="22" y2="22" /><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V5a3 3 0 0 0-5.94-.6" /><path d="M17 16.95A7 7 0 0 1 5 12" /><line x1="12" y1="19" x2="12" y2="22" /></svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0 0 14 0" /><line x1="12" y1="19" x2="12" y2="22" /></svg>
        )}
      </button>
      <button
        type="button"
        onClick={() => endSession()}
        aria-label="End the call"
        style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '6px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '10px', padding: '8px 14px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
      >
        End
      </button>
    </div>
  );
}

export function VoiceChat({ employeeId = 'atlas' }: { employeeId?: string }) {
  return (
    <ConversationProvider>
      <VoiceChatInner employeeId={employeeId} />
    </ConversationProvider>
  );
}
