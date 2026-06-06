'use client';

import { useEffect, useRef, useState } from 'react';
import { EmployeeAvatar } from '@/components/EmployeeAvatar';
import { MicButton } from '@/components/MicButton';
import { SpeakButton } from '@/components/SpeakButton';
import { PresenceOrb } from '@/components/PresenceOrb';
import type { OrbState } from '@/lib/persona-orb';

// Dashboard centerpiece — Atlas, the Chief of Staff. His input is a conversation
// RIGHT HERE on the dashboard: it opens with his Morning Brief and you can keep
// talking to him inline. Talking to the company through Atlas is the default; he
// answers or routes work to a teammate via his tools. (No navigating away — that
// was the bug; his bar is a "talk right here" box, not a link to another page.)
const BRIEF_ASK = 'Give me my morning brief for today.';
const ATLAS_COLOR = '#f59e0b';

interface Msg { role: 'user' | 'assistant'; content: string }

export function AtlasBrief() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  // On mount: restore the existing Atlas thread (so revisiting the dashboard keeps
  // the conversation). If there's none yet, open with a fresh morning brief.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      try {
        const res = await fetch('/api/chat?employeeId=atlas');
        const data = await res.json();
        if (data.conversationId) setConversationId(data.conversationId);
        const history: Msg[] = (data.messages ?? []).map((m: Msg) => ({ role: m.role, content: m.content }));
        if (history.length > 0) { setMessages(history); setLoaded(true); return; }
      } catch { /* fall through to a fresh brief */ }
      setLoaded(true);
      stream(BRIEF_ASK, { brief: true });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, streaming]);

  // Stream one Atlas turn inline. `brief` hides the prompt as a user bubble (the
  // brief is his opener, not something the owner typed).
  async function stream(message: string, { brief = false } = {}) {
    if (streaming) return;
    setStreaming(true);
    setMessages((prev) => (brief ? [{ role: 'assistant', content: '' }] : [...prev, { role: 'user', content: message }, { role: 'assistant', content: '' }]));
    try {
      const res = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId: 'atlas', message, conversationId }),
      });
      const cid = res.headers.get('X-Conversation-Id');
      if (cid) setConversationId(cid);
      if (!res.ok || !res.body) {
        const errText = await res.text().catch(() => 'Something went wrong.');
        setMessages((prev) => setLast(prev, errText || 'Something went wrong.'));
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages((prev) => setLast(prev, acc));
      }
    } catch {
      setMessages((prev) => setLast(prev, 'Connection error. Please try again.'));
    } finally {
      setStreaming(false);
    }
  }

  function send(text: string) {
    const t = text.trim();
    if (!t || streaming) return;
    setInput('');
    stream(t);
  }

  const empty = loaded && messages.length === 0;

  // Atlas is alive: thinking while a request is in flight, talking (audio-reactive
  // — text-stream cadence until Track A voices land) while his reply streams.
  const last = messages[messages.length - 1];
  const orbState: OrbState = streaming
    ? (last && last.role === 'assistant' && last.content === '' ? 'thinking' : 'talking')
    : 'idle';

  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderLeft: `3px solid ${ATLAS_COLOR}`, borderRadius: '16px', boxShadow: 'var(--shadow)', padding: '20px 22px', marginBottom: '20px' }}>
      {/* Compact header — orb inline (kept, smaller), brief collapses so it doesn't eat the screen. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: collapsed ? '0' : '12px' }}>
        <div style={{ flexShrink: 0 }}>
          <PresenceOrb employeeId="atlas" state={orbState} size={52} aria-label="Atlas presence" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>Atlas</span>
            <span style={{ fontSize: '10px', color: ATLAS_COLOR, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', border: `1px solid ${ATLAS_COLOR}40`, borderRadius: '5px', padding: '1px 6px' }}>Chief of Staff</span>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-dim)' }}>Your morning brief &amp; command center</p>
        </div>
        <button
          onClick={() => setCollapsed((v) => !v)}
          title={collapsed ? 'Show the briefing' : 'Collapse the briefing'}
          style={{ flexShrink: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '7px 11px', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer' }}
        >
          {collapsed ? 'Show brief' : 'Hide'}
        </button>
        <button
          onClick={() => stream(BRIEF_ASK, { brief: true })}
          disabled={streaming}
          title="Regenerate today's brief"
          style={{ flexShrink: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '7px 13px', fontSize: '12px', fontWeight: 600, color: streaming ? 'var(--text-dim)' : 'var(--text-secondary)', cursor: streaming ? 'default' : 'pointer' }}
        >
          {streaming && messages.length <= 1 ? 'Briefing…' : 'Refresh brief'}
        </button>
      </div>

      {/* Inline conversation — collapses to keep the card tight; capped height when open. */}
      {!collapsed && (
      <div ref={scrollRef} style={{ maxHeight: '300px', overflowY: 'auto', marginBottom: '14px', marginTop: '12px' }}>
        {empty ? (
          <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>Ask Atlas to brief you, or give him something to run.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {messages.map((m, i) => (
              <div key={i} style={{ display: 'flex', gap: '10px', flexDirection: m.role === 'user' ? 'row-reverse' : 'row', animation: 'fadeIn 0.2s ease' }}>
                {m.role === 'assistant' && (
                  <div style={{ width: '26px', height: '26px', borderRadius: '50%', overflow: 'hidden', flexShrink: 0, marginTop: '2px' }}>
                    <EmployeeAvatar id="atlas" size={26} />
                  </div>
                )}
                <div style={{
                  maxWidth: m.role === 'user' ? '78%' : '100%',
                  background: m.role === 'user' ? 'var(--accent)' : 'transparent',
                  color: m.role === 'user' ? '#fff' : 'var(--text-secondary)',
                  borderRadius: m.role === 'user' ? '14px 14px 4px 14px' : '0',
                  padding: m.role === 'user' ? '9px 13px' : '0',
                  fontSize: '13.5px', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                }}>
                  {m.content || (streaming && i === messages.length - 1 ? <TypingDots /> : '')}
                </div>
                {m.role === 'assistant' && m.content && !(streaming && i === messages.length - 1) && (
                  <div style={{ alignSelf: 'flex-end' }}>
                    <SpeakButton text={m.content} employeeId="atlas" />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      )}

      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') send(input); }}
          placeholder="Ask Atlas anything — he answers here or routes it to the right teammate"
          style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '11px 14px', fontSize: '13px', color: 'var(--text-primary)', outline: 'none' }}
        />
        <MicButton onText={setInput} disabled={streaming} />
        <button
          onClick={() => send(input)}
          disabled={streaming || input.trim() === ''}
          style={{ flexShrink: 0, background: streaming || input.trim() === '' ? 'var(--border)' : 'var(--accent)', color: streaming || input.trim() === '' ? 'var(--text-dim)' : '#fff', border: 'none', borderRadius: '10px', padding: '11px 18px', fontSize: '13px', fontWeight: 700, cursor: streaming || input.trim() === '' ? 'default' : 'pointer' }}
        >
          {streaming ? '…' : 'Ask'}
        </button>
      </div>
    </div>
  );
}

function setLast(prev: Msg[], content: string): Msg[] {
  if (prev.length === 0) return prev;
  const copy = prev.slice();
  copy[copy.length - 1] = { ...copy[copy.length - 1], content };
  return copy;
}

function TypingDots() {
  return (
    <span style={{ display: 'inline-flex', gap: '4px', alignItems: 'center', padding: '2px 0' }}>
      {[0, 1, 2].map((i) => (
        <span key={i} style={{ width: '6px', height: '6px', borderRadius: '50%', background: ATLAS_COLOR, opacity: 0.5, animation: `pulse-amber 1s ${i * 0.15}s infinite` }} />
      ))}
    </span>
  );
}
