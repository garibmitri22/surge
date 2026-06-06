'use client';

import { useState, use } from 'react';

// Hosted interest page (v1 default destination when the customer hasn't set their own
// booking_url). Public — a prospect who clicked the CTA lands here and leaves their
// details + a time preference. Submitting posts to /api/book/[token], which flips the
// lead to 'meeting' and pings the owner. Light theme, on-brand, zero dependencies.

export default function BookPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [timePref, setTimePref] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');

  async function submit() {
    if (state === 'sending') return;
    setState('sending');
    try {
      const res = await fetch(`/api/book/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, timePref }),
      });
      const r = await res.json().catch(() => ({ ok: false }));
      setState(r.ok ? 'done' : 'error');
    } catch {
      setState('error');
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ width: '100%', maxWidth: '440px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: '18px', boxShadow: '0 8px 30px rgba(0,0,0,0.06)', padding: '32px' }}>
        {state === 'done' ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '40px', marginBottom: '8px' }}>✅</div>
            <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#111827', marginBottom: '8px' }}>You&rsquo;re on the calendar</h1>
            <p style={{ fontSize: '14px', color: '#6b7280', lineHeight: 1.6 }}>Thanks{name ? `, ${name}` : ''} — we&rsquo;ll be in touch shortly to confirm a time{timePref ? ` (${timePref})` : ''}.</p>
          </div>
        ) : (
          <>
            <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#111827', marginBottom: '6px' }}>Let&rsquo;s find a time</h1>
            <p style={{ fontSize: '14px', color: '#6b7280', lineHeight: 1.6, marginBottom: '22px' }}>Leave your details and when works best — we&rsquo;ll confirm a quick call.</p>

            <Field label="Your name">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe"
                style={inputStyle} />
            </Field>
            <Field label="Email">
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@business.com" type="email"
                style={inputStyle} />
            </Field>
            <Field label="When works best?">
              <input value={timePref} onChange={(e) => setTimePref(e.target.value)} placeholder="Weekday mornings, this week"
                style={inputStyle} />
            </Field>

            <button onClick={submit} disabled={state === 'sending' || (!name && !email)}
              style={{ width: '100%', marginTop: '8px', background: (state === 'sending' || (!name && !email)) ? '#c7c9d1' : '#6366f1', color: '#fff', border: 'none', borderRadius: '12px', padding: '13px', fontSize: '15px', fontWeight: 700, cursor: (state === 'sending' || (!name && !email)) ? 'default' : 'pointer' }}>
              {state === 'sending' ? 'Sending…' : 'Request my call'}
            </button>
            {state === 'error' && <p style={{ fontSize: '13px', color: '#ef4444', marginTop: '12px', textAlign: 'center' }}>Something went wrong — please try again.</p>}
            <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '18px', textAlign: 'center' }}>Powered by Surge</p>
          </>
        )}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '10px',
  padding: '12px 14px', fontSize: '14px', color: '#111827', outline: 'none', fontFamily: 'inherit',
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '16px' }}>
      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>{label}</label>
      {children}
    </div>
  );
}
