'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { EmployeeAvatar } from '@/components/EmployeeAvatar';

// Dashboard centerpiece — Atlas, the Chief of Staff. His Morning Brief (real data
// via the whole-board context the chat route already builds for him; honest
// fresh-state when there's nothing yet) plus his always-present input. Talking to
// the company through Atlas is the default; he answers or routes to a teammate.
const BRIEF_ASK = 'Give me my morning brief for today.';
const ATLAS_COLOR = '#f59e0b';

export function AtlasBrief() {
  const router = useRouter();
  const [brief, setBrief] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [input, setInput] = useState('');
  const fired = useRef(false);

  // Stream the brief once per browser session (not on every dashboard revisit) —
  // the "your brief is ready" moment without an API call on every navigation.
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    const already = typeof window !== 'undefined' && sessionStorage.getItem('atlas-briefed') === '1';
    if (already) return;
    runBrief();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runBrief() {
    if (streaming) return;
    setStreaming(true);
    setBrief('');
    try {
      const res = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId: 'atlas', message: BRIEF_ASK }),
      });
      if (!res.ok || !res.body) {
        setBrief(await res.text().catch(() => 'Could not load your brief right now.'));
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setBrief(acc);
      }
      if (typeof window !== 'undefined') sessionStorage.setItem('atlas-briefed', '1');
    } catch {
      setBrief('Connection error — try refreshing your brief.');
    } finally {
      setStreaming(false);
    }
  }

  function ask(text: string) {
    const t = text.trim();
    if (!t) return;
    // Default routing is through Atlas; an "Aria, ..." prefix still reaches Aria
    // directly (the workforce chat parses the prefix).
    const m = t.match(/^(aria|nova|opus|atlas)\b[,:]?\s*(.*)$/i);
    const id = m ? m[1].toLowerCase() : 'atlas';
    const body = m ? m[2].trim() : t;
    router.push(`/workforce/${id}?ask=${encodeURIComponent(body || t)}`);
  }

  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderLeft: `3px solid ${ATLAS_COLOR}`, borderRadius: '16px', boxShadow: 'var(--shadow)', padding: '20px 22px', marginBottom: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
        <div style={{ width: '40px', height: '40px', borderRadius: '11px', overflow: 'hidden', flexShrink: 0 }}>
          <EmployeeAvatar id="atlas" size={40} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>Atlas</span>
            <span style={{ fontSize: '10px', color: ATLAS_COLOR, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', border: `1px solid ${ATLAS_COLOR}40`, borderRadius: '5px', padding: '1px 6px' }}>Chief of Staff</span>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-dim)' }}>Your morning brief</p>
        </div>
        <button
          onClick={runBrief}
          disabled={streaming}
          style={{ flexShrink: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '7px 13px', fontSize: '12px', fontWeight: 600, color: streaming ? 'var(--text-dim)' : 'var(--text-secondary)', cursor: streaming ? 'default' : 'pointer' }}
        >
          {streaming ? 'Briefing…' : brief ? 'Refresh' : 'Brief me'}
        </button>
      </div>

      <div style={{ fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap', minHeight: brief || streaming ? '40px' : '0', marginBottom: brief || streaming ? '16px' : '0' }}>
        {brief || (streaming ? 'Pulling the whole board together…' : '')}
      </div>

      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { ask(input); setInput(''); } }}
          placeholder="Ask Atlas anything — he answers or routes it to the right teammate"
          style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '11px 14px', fontSize: '13px', color: 'var(--text-primary)', outline: 'none' }}
        />
        <button
          onClick={() => { ask(input); setInput(''); }}
          disabled={input.trim() === ''}
          style={{ flexShrink: 0, background: input.trim() === '' ? 'var(--border)' : 'var(--accent)', color: input.trim() === '' ? 'var(--text-dim)' : '#fff', border: 'none', borderRadius: '10px', padding: '11px 18px', fontSize: '13px', fontWeight: 700, cursor: input.trim() === '' ? 'default' : 'pointer' }}
        >
          Ask
        </button>
      </div>
    </div>
  );
}
