'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { EmployeeAvatar } from '@/components/EmployeeAvatar';
import { supabase } from '@/lib/supabase';
import { getMyCompanyId, isOnboardingComplete } from '@/lib/data';

// Onboarding v2 — the customer's FIRST conversation, with Atlas (the Chief of
// Staff). Distinct from the normal employee ChatPanel: it runs in intakeMode,
// triggers the one-time site research when the owner pastes a URL, captures a
// logo into brand-assets, and redirects to the dashboard the moment Atlas
// completes onboarding server-side.

const ATLAS = { id: 'atlas', name: 'Atlas', color: '#f59e0b' };

// Atlas's opening line (the flow's step 2). Rendered client-side so the owner is
// greeted instantly; the conversation persists from their first real reply.
const OPENING =
  "Welcome — I'm Atlas, your Chief of Staff. Before I ask you anything, I'd like to do my homework.\n\nWhat's your website? Paste the URL and I'll review it, then tell you what I understand about your business so you can correct me.";

interface Msg { role: 'user' | 'assistant'; content: string }

const URL_RE = /\bhttps?:\/\/[^\s]+|\b(?:www\.)?[a-z0-9-]+\.[a-z]{2,}(?:\/[^\s]*)?/i;

function extractUrl(text: string): string | null {
  const m = text.match(URL_RE);
  if (!m) return null;
  let u = m[0].replace(/[.,;:)]+$/, '');
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
  return u;
}

export function IntakeChat() {
  const router = useRouter();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [researching, setResearching] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [done, setDone] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const researchDone = useRef(false);

  // Load any in-progress intake (a returning, not-yet-complete draft).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/chat?employeeId=${ATLAS.id}`);
        const data = await res.json();
        if (cancelled) return;
        setConversationId(data.conversationId ?? null);
        setMessages((data.messages ?? []).map((m: Msg) => ({ role: m.role, content: m.content })));
      } catch { /* ignore */ }
      finally { if (!cancelled) setLoaded(true); }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, streaming, researching]);

  async function send(text: string) {
    const msg = text.trim();
    if (!msg || streaming || researching || done) return;
    setInput('');

    // Website-first: if the owner pastes a URL and we haven't researched yet, do
    // the one-time site scan BEFORE the chat turn so Atlas's reply can present the
    // findings (the route injects whatever we persisted to the draft company).
    const url = !researchDone.current ? extractUrl(msg) : null;
    if (url) {
      setMessages((prev) => [...prev, { role: 'user', content: msg }]);
      setResearching(true);
      try {
        await fetch('/api/onboard/research', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url }),
        });
        researchDone.current = true;
      } catch { /* Atlas will fall back to interviewing if findings are thin */ }
      finally { setResearching(false); }
      await stream(msg);
      return;
    }

    setMessages((prev) => [...prev, { role: 'user', content: msg }]);
    await stream(msg);
  }

  // POST one turn to the intake chat and stream the reply. The caller is
  // responsible for any user bubble; this only appends the streaming assistant
  // bubble (logo confirmations are sent without a user bubble by design).
  async function stream(msg: string) {
    setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);
    setStreaming(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId: ATLAS.id, message: msg, conversationId, intakeMode: true }),
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
        const { done: d, value } = await reader.read();
        if (d) break;
        acc += decoder.decode(value, { stream: true });
        setMessages((prev) => updateLast(prev, acc));
      }
    } catch {
      setMessages((prev) => updateLast(prev, 'Connection error. Please try again.'));
    } finally {
      setStreaming(false);
    }

    // Atlas flips onboarding_complete server-side when the required set is in.
    // Check after the turn settles; on completion, hand off to the dashboard.
    try {
      if (await isOnboardingComplete()) {
        setDone(true);
        setTimeout(() => router.push('/dashboard'), 1600);
      }
    } catch { /* ignore */ }
  }

  async function onLogoPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || uploading) return;
    setUploading(true);
    try {
      const companyId = await getMyCompanyId();
      if (!companyId) throw new Error('no company');
      const ext = (file.name.split('.').pop() || 'png').toLowerCase();
      const path = `${companyId}/logo-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('brand-assets').upload(path, file, { upsert: true });
      if (error) throw error;
      await stream(`I've uploaded my logo (saved to brand-assets at ${path}). Note it as part of my brand kit.`);
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: "I couldn't save that logo — we can grab it from your site instead, or you can try the upload again." }]);
    } finally {
      setUploading(false);
    }
  }

  const busy = streaming || researching || uploading;
  // The opening greeting is shown only on a fresh intake (no persisted history).
  const view: Msg[] = !loaded ? [] : (messages.length === 0 ? [{ role: 'assistant', content: OPENING }] : messages);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', maxWidth: '720px' }}>
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '8px 4px 16px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {view.map((m, i) => (
            <div key={i} style={{ display: 'flex', gap: '10px', flexDirection: m.role === 'user' ? 'row-reverse' : 'row', animation: 'fadeIn 0.25s ease' }}>
              {m.role === 'assistant' && (
                <div style={{ width: '30px', height: '30px', borderRadius: '50%', overflow: 'hidden', flexShrink: 0, marginTop: '2px' }}>
                  <EmployeeAvatar id={ATLAS.id} size={30} />
                </div>
              )}
              <div style={{
                maxWidth: '80%',
                background: m.role === 'user' ? 'var(--accent)' : 'var(--card)',
                color: m.role === 'user' ? '#fff' : 'var(--text-primary)',
                border: m.role === 'user' ? 'none' : '1px solid var(--border)',
                borderRadius: m.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                padding: '11px 15px', fontSize: '14px', lineHeight: 1.6,
                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                boxShadow: m.role === 'user' ? 'none' : 'var(--shadow)',
              }}>
                {m.content || (i === view.length - 1 ? <TypingDots color={ATLAS.color} /> : '')}
              </div>
            </div>
          ))}
          {researching && (
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', paddingLeft: '40px', fontSize: '13px', color: 'var(--text-secondary)', animation: 'fadeIn 0.25s ease' }}>
              <TypingDots color={ATLAS.color} /> Reviewing your site…
            </div>
          )}
        </div>
      </div>

      {done ? (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '14px', textAlign: 'center', fontSize: '13.5px', color: 'var(--text-secondary)' }}>
          Your workforce is ready — taking you to your dashboard…
        </div>
      ) : (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px', display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            title="Upload your logo"
            style={{ flexShrink: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '11px 13px', fontSize: '15px', color: 'var(--text-secondary)', cursor: busy ? 'default' : 'pointer', lineHeight: 1 }}
          >
            {uploading ? '…' : '📎'}
          </button>
          <input ref={fileRef} type="file" accept="image/*" onChange={onLogoPick} style={{ display: 'none' }} />
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
            placeholder="Message Atlas…"
            rows={1}
            style={{ flex: 1, resize: 'none', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '12px 15px', fontSize: '14px', color: 'var(--text-primary)', outline: 'none', fontFamily: 'inherit', lineHeight: 1.5, maxHeight: '140px' }}
          />
          <button
            onClick={() => send(input)}
            disabled={busy || input.trim() === ''}
            style={{ flexShrink: 0, background: busy || input.trim() === '' ? 'var(--border)' : 'var(--accent)', color: busy || input.trim() === '' ? 'var(--text-dim)' : '#fff', border: 'none', borderRadius: '12px', padding: '12px 20px', fontSize: '13.5px', fontWeight: '700', cursor: busy || input.trim() === '' ? 'default' : 'pointer', transition: 'all 0.15s ease' }}
          >
            {streaming ? '…' : 'Send'}
          </button>
        </div>
      )}
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
        <span key={i} style={{ width: '6px', height: '6px', borderRadius: '50%', background: color, opacity: 0.5, animation: `pulse-amber 1s ${i * 0.15}s infinite` }} />
      ))}
    </span>
  );
}
