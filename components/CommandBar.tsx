'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { EmployeeAvatar } from '@/components/EmployeeAvatar';

const EMPLOYEES: { id: string; name: string }[] = [
  { id: 'aria', name: 'Aria' },
  { id: 'nova', name: 'Nova' },
  { id: 'opus', name: 'Opus' },
];

// "Aria, do X" / "nova: do Y" / "opus do Z" → { id, ask }
function parse(input: string): { id: string; ask: string } {
  const m = input.trim().match(/^(aria|nova|opus)\b[,:]?\s*(.*)$/i);
  if (m) return { id: m[1].toLowerCase(), ask: m[2].trim() };
  return { id: 'aria', ask: input.trim() }; // default to Aria
}

export default function CommandBar() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  function go(input: string) {
    const text = input.trim();
    if (!text) return;
    const { id, ask } = parse(text);
    setOpen(false);
    setValue('');
    const url = ask ? `/workforce/${id}?ask=${encodeURIComponent(ask)}` : `/workforce/${id}`;
    router.push(url);
  }

  if (!open) return null;

  return (
    <div
      onClick={() => setOpen(false)}
      style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.35)', backdropFilter: 'blur(4px)', zIndex: 500, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '14vh', animation: 'fadeIn 0.15s ease' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', maxWidth: '560px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px', boxShadow: 'var(--shadow-md)', overflow: 'hidden', animation: 'fadeIn 0.2s ease' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontSize: '15px', color: 'var(--text-dim)' }}>⌘</span>
          <input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') go(value); }}
            placeholder="Talk to your team —  e.g.  Aria, rank my top 50 leads and book them"
            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: '15px', color: 'var(--text-primary)' }}
          />
          <kbd style={{ fontSize: '10px', color: 'var(--text-dim)', border: '1px solid var(--border)', borderRadius: '6px', padding: '2px 6px' }}>esc</kbd>
        </div>
        <div style={{ padding: '8px' }}>
          <p style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.8px', padding: '6px 10px' }}>Route to</p>
          {EMPLOYEES.map((e) => (
            <button
              key={e.id}
              onClick={() => {
                // If the user already typed a message, keep it; otherwise just open the chat.
                const { ask } = parse(value);
                const hasName = /^(aria|nova|opus)\b/i.test(value.trim());
                const askText = hasName ? ask : value.trim();
                router.push(askText ? `/workforce/${e.id}?ask=${encodeURIComponent(askText)}` : `/workforce/${e.id}`);
                setOpen(false);
                setValue('');
              }}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '12px', padding: '10px', borderRadius: '10px', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}
              onMouseEnter={(ev) => ((ev.currentTarget as HTMLElement).style.background = 'var(--surface)')}
              onMouseLeave={(ev) => ((ev.currentTarget as HTMLElement).style.background = 'transparent')}
            >
              <div style={{ width: '28px', height: '28px', borderRadius: '50%', overflow: 'hidden', flexShrink: 0 }}>
                <EmployeeAvatar id={e.id} size={28} />
              </div>
              <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>{e.name}</span>
              <span style={{ fontSize: '12px', color: 'var(--text-dim)', marginLeft: 'auto' }}>Open chat →</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
