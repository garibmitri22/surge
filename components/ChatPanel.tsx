'use client';

import { useEffect, useRef, useState } from 'react';
import { EmployeeAvatar } from '@/components/EmployeeAvatar';
import { MicButton } from '@/components/MicButton';
import { ImageButton } from '@/components/ImageButton';
import { SpeakButton } from '@/components/SpeakButton';
import { PresenceOrb } from '@/components/PresenceOrb';
import type { OrbState } from '@/lib/persona-orb';
import { getCompanyProfile } from '@/lib/data';

interface Msg {
  role: 'user' | 'assistant';
  content: string;
}

// Static base chips. Aria's lead-gen chip (index 1) is a NEUTRAL fallback — it gets
// replaced at runtime with one derived from the company's own ICP (see ChatPanel).
const SUGGESTIONS: Record<string, string[]> = {
  aria: [
    'What are you working on right now?',
    'Find and rank 50 leads in your target market',
    'What should I know before our next sales push?',
  ],
  nova: [
    'What are you working on right now?',
    'Draft a content plan for this month and get my sign-off',
    'What channels should we prioritize?',
  ],
  opus: [
    'What are you working on right now?',
    'Build me an onboarding SOP and create the task',
    'What needs my attention this week?',
  ],
  atlas: [
    'Give me my morning brief.',
    "What's the most important thing for me to do today?",
    'What across the team needs my attention?',
  ],
};

export function ChatPanel({
  employeeId,
  name,
  color,
  initialAsk,
  onAskConsumed,
  working = false,
}: {
  employeeId: string;
  name: string;
  color: string;
  initialAsk?: string | null;
  onAskConsumed?: () => void;
  /** True when this employee has an in-progress task — drives the `working` orb. */
  working?: boolean;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const askFired = useRef(false);
  // Aria's lead-gen suggestion chip, derived from the company's own ICP (target + geo) —
  // never a hardcoded vertical. null until/unless an ICP is on file (neutral chip shows meanwhile).
  const [ariaLeadSuggestion, setAriaLeadSuggestion] = useState<string | null>(null);

  // Load history once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/chat?employeeId=${encodeURIComponent(employeeId)}`);
        const data = await res.json();
        if (cancelled) return;
        setConversationId(data.conversationId ?? null);
        setMessages((data.messages ?? []).map((m: Msg) => ({ role: m.role, content: m.content })));
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [employeeId]);

  // Auto-scroll on new content.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, streaming]);

  // Aria's lead chip comes from the company's ICP — their target market in their words.
  // If no ICP is set, the neutral fallback in SUGGESTIONS stays.
  useEffect(() => {
    if (employeeId !== 'aria') return;
    let cancelled = false;
    getCompanyProfile()
      .then((p) => {
        const target = (p?.targetCustomers || '').trim();
        if (!cancelled && target) setAriaLeadSuggestion(`Find and rank the top 50 ${target} and book them`);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [employeeId]);

  async function send(text: string) {
    const msg = text.trim();
    const img = image;
    if ((!msg && !img) || streaming) return;
    setInput('');
    setImage(null);
    setMessages((prev) => [...prev, { role: 'user', content: msg || (img ? '🖼 Image' : '') }, { role: 'assistant', content: '' }]);
    setStreaming(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId, message: msg, conversationId, imageDataUrl: img ?? undefined }),
      });
      const cid = res.headers.get('X-Conversation-Id');
      if (cid) setConversationId(cid);
      if (!res.ok || !res.body) {
        const errText = await res.text().catch(() => 'Something went wrong.');
        setMessages((prev) => updateLast(prev, errText || 'Something went wrong.'));
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages((prev) => updateLast(prev, acc));
      }
    } catch {
      setMessages((prev) => updateLast(prev, 'Connection error. Please try again.'));
    } finally {
      setStreaming(false);
    }
  }

  // Fire the command-bar ask once history has loaded.
  useEffect(() => {
    if (loaded && initialAsk && !askFired.current) {
      askFired.current = true;
      send(initialAsk);
      onAskConsumed?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, initialAsk]);

  const lastAssistantEmpty =
    streaming && messages.length > 0 && messages[messages.length - 1].role === 'assistant' && messages[messages.length - 1].content === '';

  // Living presence: thinking (request in flight) → talking (reply streaming;
  // audio-reactive via text-stream cadence until Track A voices land) →
  // working (an in-progress task exists) or idle at rest.
  const orbState: OrbState = streaming
    ? (lastAssistantEmpty ? 'thinking' : 'talking')
    : (working ? 'working' : 'idle');

  // Suggestion chips: swap in Aria's ICP-derived lead chip when we have one; otherwise the
  // static base (which already carries the neutral fallback for Aria).
  const baseSuggestions = SUGGESTIONS[employeeId] ?? SUGGESTIONS.aria;
  const suggestions = employeeId === 'aria' && ariaLeadSuggestion
    ? [baseSuggestions[0], ariaLeadSuggestion, baseSuggestions[2]]
    : baseSuggestions;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '560px' }}>
      {/* Presence header — their orb, always reacting */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingBottom: '12px', borderBottom: '1px solid var(--border)', marginBottom: '4px' }}>
        <PresenceOrb employeeId={employeeId} state={orbState} size={44} aria-label={`${name} presence`} />
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>{name}</p>
          <p style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'capitalize' }}>{orbState === 'idle' ? 'online' : orbState}</p>
        </div>
      </div>
      {/* Messages */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '8px 4px 16px' }}>
        {loaded && messages.length === 0 ? (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '24px', animation: 'fadeIn 0.3s ease' }}>
            <div style={{ width: '52px', height: '52px', borderRadius: '14px', overflow: 'hidden', border: `1px solid ${color}30`, marginBottom: '14px' }}>
              <EmployeeAvatar id={employeeId} size={52} />
            </div>
            <p style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '4px' }}>Talk to {name}</p>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '360px', marginBottom: '18px', lineHeight: 1.5 }}>
              Ask what {name} is working on, give a directive to plan and assign, or just say hi.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', maxWidth: '420px' }}>
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="card-hover"
                  style={{ textAlign: 'left', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '11px 14px', fontSize: '13px', color: 'var(--text-secondary)', cursor: 'pointer' }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {messages.map((m, i) => (
              <div key={i} style={{ display: 'flex', gap: '10px', flexDirection: m.role === 'user' ? 'row-reverse' : 'row', animation: 'fadeIn 0.25s ease' }}>
                {m.role === 'assistant' && (
                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', overflow: 'hidden', flexShrink: 0, marginTop: '2px' }}>
                    <EmployeeAvatar id={employeeId} size={28} />
                  </div>
                )}
                <div
                  style={{
                    maxWidth: '78%',
                    background: m.role === 'user' ? 'var(--accent)' : 'var(--card)',
                    color: m.role === 'user' ? '#fff' : 'var(--text-primary)',
                    border: m.role === 'user' ? 'none' : '1px solid var(--border)',
                    borderRadius: m.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                    padding: '10px 14px',
                    fontSize: '13.5px',
                    lineHeight: 1.55,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    boxShadow: m.role === 'user' ? 'none' : 'var(--shadow)',
                  }}
                >
                  {m.content || (lastAssistantEmpty && i === messages.length - 1 ? <TypingDots color={color} /> : '')}
                </div>
                {m.role === 'assistant' && m.content && !(streaming && i === messages.length - 1) && (
                  <div style={{ alignSelf: 'flex-end' }}>
                    <SpeakButton text={m.content} employeeId={employeeId} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Attached-image preview */}
      {image && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 4px 0' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '8px', border: '1px solid var(--border)', backgroundImage: `url(${image})`, backgroundSize: 'cover', backgroundPosition: 'center', flexShrink: 0 }} />
          <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>Image attached</span>
          <button
            onClick={() => setImage(null)}
            style={{ fontSize: '11.5px', color: 'var(--text-secondary)', background: 'transparent', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
          >
            remove
          </button>
        </div>
      )}

      {/* Composer */}
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px', display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          placeholder={`Message ${name}…`}
          rows={1}
          style={{ flex: 1, resize: 'none', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '11px 14px', fontSize: '13.5px', color: 'var(--text-primary)', outline: 'none', fontFamily: 'inherit', lineHeight: 1.5, maxHeight: '120px' }}
        />
        <ImageButton onImage={setImage} disabled={streaming} />
        <MicButton onText={setInput} disabled={streaming} />
        <button
          onClick={() => send(input)}
          disabled={streaming || (input.trim() === '' && !image)}
          style={{
            flexShrink: 0,
            background: streaming || (input.trim() === '' && !image) ? 'var(--border)' : 'var(--accent)',
            color: streaming || (input.trim() === '' && !image) ? 'var(--text-dim)' : '#fff',
            border: 'none',
            borderRadius: '12px',
            padding: '11px 18px',
            fontSize: '13px',
            fontWeight: '700',
            cursor: streaming || (input.trim() === '' && !image) ? 'default' : 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          {streaming ? '…' : 'Send'}
        </button>
      </div>
    </div>
  );
}

function updateLast(prev: Msg[], content: string): Msg[] {
  if (prev.length === 0) return prev;
  const copy = prev.slice();
  copy[copy.length - 1] = { ...copy[copy.length - 1], content };
  return copy;
}

function TypingDots({ color }: { color: string }) {
  return (
    <span style={{ display: 'inline-flex', gap: '4px', alignItems: 'center', padding: '2px 0' }}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: color,
            opacity: 0.5,
            animation: `pulse-amber 1s ${i * 0.15}s infinite`,
          }}
        />
      ))}
    </span>
  );
}
