'use client';

import { useEffect, useRef, useState } from 'react';
import { ConversationProvider, useConversation } from '@elevenlabs/react';
import { PresenceOrb } from '@/components/PresenceOrb';
import { useSpeechOrb } from '@/lib/use-speech-orb';
import type { AgentProfile } from '@/lib/agents';
import type { OrbState } from '@/lib/persona-orb';

// The orb stage + voice CTA for an agent page. Atlas gets a REAL-TIME, interruptible voice
// conversation (mic → ElevenLabs Agent → speech), with the big orb pulsing to the live agent
// audio. Other agents get a click-to-play voice taste (their orb pulses to that TTS). Anonymous
// visitors (no session) fall back to the spoken intro so the demo still works.

function StageInner({ agent }: { agent: AgentProfile }) {
  const accent = agent.color;
  const isAtlas = agent.id === 'atlas';
  const startedAt = useRef(0);
  const rafRef = useRef(0);
  const [liveLevel, setLiveLevel] = useState(0);
  const [connecting, setConnecting] = useState(false);
  const [note, setNote] = useState('');

  const conv = useConversation({
    onConnect: () => { startedAt.current = Date.now(); setConnecting(false); setNote(''); },
    onDisconnect: () => {
      setConnecting(false);
      setLiveLevel(0);
      const seconds = startedAt.current ? Math.round((Date.now() - startedAt.current) / 1000) : 0;
      startedAt.current = 0;
      if (seconds > 0) fetch('/api/voice/meter', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ seconds }) }).catch(() => {});
    },
    onError: () => { setConnecting(false); setNote('Voice hit a snag — try again.'); },
  });
  const tts = useSpeechOrb(agent.id);

  const live = conv.status === 'connected';

  // Drive the orb from the LIVE agent audio amplitude while connected.
  useEffect(() => {
    if (!live) { cancelAnimationFrame(rafRef.current); return; }
    let last = 0;
    const tick = (t: number) => {
      rafRef.current = requestAnimationFrame(tick);
      if (t - last < 70) return; // ~14fps is plenty for an amplitude meter
      last = t;
      try {
        const data = conv.getOutputByteFrequencyData();
        if (data && data.length) {
          let sum = 0;
          for (let i = 0; i < data.length; i++) sum += data[i];
          setLiveLevel(Math.min(1, (sum / (data.length * 255)) * 5));
        }
      } catch { /* ignore */ }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [live, conv]);

  async function startLive() {
    if (connecting || live) return;
    setNote('');
    setConnecting(true);
    try {
      const res = await fetch('/api/voice/session', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        conv.startSession({ signedUrl: data.signedUrl, connectionType: 'websocket' });
        return;
      }
      // 401 (not signed in) / 503 (not configured) → still let them hear Atlas.
      setConnecting(false);
      if (res.status === 401) setNote('Sign in to talk live — playing his intro for now.');
      tts.play(agent.spokenIntro);
    } catch {
      setConnecting(false);
      tts.play(agent.spokenIntro);
    }
  }

  function primaryClick() {
    if (live) { conv.endSession(); return; }
    if (connecting) return;
    if (isAtlas) { startLive(); return; }
    if (tts.speaking) { tts.stop(); return; }
    tts.play(agent.spokenIntro);
  }

  const speaking = (live && conv.isSpeaking) || tts.speaking;
  const orbState: OrbState = speaking ? 'talking' : connecting ? 'thinking' : 'idle';
  const statusLabel = connecting ? 'Connecting…' : live ? (conv.isSpeaking ? `${agent.name} is speaking…` : conv.isMuted ? 'Muted' : 'Listening…') : '';
  const primaryLabel = live ? 'End' : connecting ? 'Connecting…' : isAtlas ? 'Talk to Atlas' : (tts.speaking ? 'Stop' : agent.cta);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
      <div style={{ position: 'relative', width: 360, height: 360, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ position: 'absolute', width: 360, height: 360, borderRadius: '50%', background: `radial-gradient(circle, ${accent}66 0%, ${accent}22 38%, transparent 68%)`, filter: 'blur(30px)' }} />
        <PresenceOrb
          employeeId={agent.id}
          state={orbState}
          size={300}
          onDark
          analyser={tts.analyser}
          level={live ? liveLevel : undefined}
          aria-label={`${agent.name} presence`}
        />
      </div>

      {/* Live controls (during a conversation) vs the start CTA. */}
      {live ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span aria-live="polite" style={{ fontSize: '13px', color: 'rgba(255,255,255,0.78)', minWidth: '120px', textAlign: 'right' }}>{statusLabel}</span>
          <button
            type="button"
            onClick={() => conv.setMuted(!conv.isMuted)}
            aria-label={conv.isMuted ? 'Unmute your microphone' : 'Mute your microphone'}
            style={{ width: 42, height: 42, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '999px', border: '1px solid rgba(255,255,255,0.18)', background: conv.isMuted ? '#ef444422' : 'rgba(255,255,255,0.06)', color: conv.isMuted ? '#fca5a5' : '#fff', cursor: 'pointer' }}
          >
            {conv.isMuted ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="2" y1="2" x2="22" y2="22" /><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V5a3 3 0 0 0-5.94-.6" /><path d="M17 16.95A7 7 0 0 1 5 12" /><line x1="12" y1="19" x2="12" y2="22" /></svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0 0 14 0" /><line x1="12" y1="19" x2="12" y2="22" /></svg>
            )}
          </button>
          <button type="button" onClick={primaryClick} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '999px', padding: '11px 20px', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}>End</button>
        </div>
      ) : (
        <button
          type="button"
          onClick={primaryClick}
          disabled={connecting}
          aria-label={isAtlas ? 'Talk to Atlas hands-free' : `Hear ${agent.name}`}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '9px', background: accent, color: '#0a0b10', border: 'none', borderRadius: '999px', padding: '12px 22px', fontSize: '14px', fontWeight: 700, cursor: connecting ? 'default' : 'pointer', boxShadow: `0 8px 30px ${accent}55`, opacity: connecting ? 0.8 : 1 }}
        >
          {speaking ? (
            <><svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2" /></svg> Stop</>
          ) : (
            <><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="6 4 20 12 6 20 6 4" fill="currentColor" /></svg> {primaryLabel}</>
          )}
        </button>
      )}

      {isAtlas && !live && !connecting && (
        <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', textAlign: 'center', maxWidth: '34ch' }}>
          Real-time voice — speak, and interrupt him any time.
        </p>
      )}
      {note && <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>{note}</span>}
    </div>
  );
}

export function AgentStage({ agent }: { agent: AgentProfile }) {
  return (
    <ConversationProvider>
      <StageInner agent={agent} />
    </ConversationProvider>
  );
}
