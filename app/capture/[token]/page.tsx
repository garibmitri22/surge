'use client';

import { useState, use } from 'react';

// Surge-hosted capture page (Adapter A — the path where WE own consent). A consumer
// from an ad lands here, leaves their details, and EXPLICITLY checks the TCPA consent
// box. We post the exact disclosure wording (+ server-stamped time/IP) so consent is
// provable. The token binds the form to one company. Light theme, mobile-first.

const DISCLOSURE =
  'By checking this box, I agree to be contacted by SMS text and phone call at the number provided, including by automated technology, about my inquiry. Consent is not a condition of purchase. Message and data rates may apply. Reply STOP to opt out at any time.';

export default function CapturePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');

  const canSubmit = consent && phone.trim().length >= 7 && state !== 'sending';

  async function submit() {
    if (!canSubmit) return;
    setState('sending');
    try {
      const res = await fetch('/api/inbound/lead', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token, source: 'surge_form', name, phone, email,
          consent: true, consent_channels: ['sms', 'call'], consent_text: DISCLOSURE,
        }),
      });
      const r = await res.json().catch(() => ({ ok: false }));
      setState(r.ok ? 'done' : 'error');
    } catch { setState('error'); }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ width: '100%', maxWidth: '440px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: '18px', boxShadow: '0 8px 30px rgba(0,0,0,0.06)', padding: '32px' }}>
        {state === 'done' ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '40px', marginBottom: '8px' }}>👋</div>
            <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#111827', marginBottom: '8px' }}>You&rsquo;re all set{name ? `, ${name.split(' ')[0]}` : ''}</h1>
            <p style={{ fontSize: '14px', color: '#6b7280', lineHeight: 1.6 }}>Expect a text from us in the next minute or two. Talk soon!</p>
          </div>
        ) : (
          <>
            <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#111827', marginBottom: '6px' }}>Get a fast response</h1>
            <p style={{ fontSize: '14px', color: '#6b7280', lineHeight: 1.6, marginBottom: '22px' }}>Leave your details and we&rsquo;ll text you right back.</p>

            <Field label="Name"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" style={inputStyle} /></Field>
            <Field label="Mobile number"><input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 555-5555" type="tel" style={inputStyle} /></Field>
            <Field label="Email (optional)"><input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" type="email" style={inputStyle} /></Field>

            <label style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', margin: '8px 0 18px', cursor: 'pointer' }}>
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ marginTop: '3px', width: '16px', height: '16px', flexShrink: 0 }} />
              <span style={{ fontSize: '11.5px', color: '#6b7280', lineHeight: 1.5 }}>{DISCLOSURE}</span>
            </label>

            <button onClick={submit} disabled={!canSubmit}
              style={{ width: '100%', background: canSubmit ? '#6366f1' : '#c7c9d1', color: '#fff', border: 'none', borderRadius: '12px', padding: '13px', fontSize: '15px', fontWeight: 700, cursor: canSubmit ? 'pointer' : 'default' }}>
              {state === 'sending' ? 'Sending…' : 'Text me back'}
            </button>
            {!consent && <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '10px', textAlign: 'center' }}>Please check the box so we can text you.</p>}
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
    <div style={{ marginBottom: '14px' }}>
      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>{label}</label>
      {children}
    </div>
  );
}
