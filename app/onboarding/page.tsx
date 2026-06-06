'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isOnboardingComplete } from '@/lib/data';
import { IntakeChat } from '@/components/IntakeChat';

// Onboarding v2: the intake IS a conversation with Atlas, the Chief of Staff —
// not a form. He researches the site, interviews the owner, and writes the
// company brain every employee reads. (Old 7-question form removed.)
const PILLARS = [
  { label: 'Your website', sub: 'Atlas reviews it before asking anything' },
  { label: 'Who you serve', sub: 'Your ideal customer — and who to skip' },
  { label: 'What you sell', sub: 'Offer, pricing, the transformation' },
  { label: 'How you sound', sub: 'Brand voice, proof, and your logo' },
  { label: 'Your #1 goal', sub: 'What the team orients around for 90 days' },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (await isOnboardingComplete()) {
        if (!cancelled) router.replace('/dashboard');
        return;
      }
      if (!cancelled) setReady(true);
    })();
    return () => { cancelled = true; };
  }, [router]);

  if (!ready) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: 800, color: '#fff' }}>S</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: 'var(--bg)' }}>

      {/* Left panel — brand + what Atlas will cover (hidden on phones) */}
      <div className="onb-aside" style={{ width: '380px', flexShrink: 0, background: 'var(--surface)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', padding: '40px', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '44px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: '800', color: '#fff' }}>S</div>
            <span style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)', letterSpacing: '0.5px' }}>SURGE</span>
          </div>

          <h2 style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Meet your Chief of Staff</h2>
          <p style={{ fontSize: '15px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '32px' }}>
            Atlas will interview you to set up your AI workforce. A few minutes of conversation — no forms.
          </p>

          {PILLARS.map((p) => (
            <div key={p.label} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '18px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent)', flexShrink: 0, marginTop: '6px' }} />
              <div>
                <div style={{ fontSize: '13.5px', color: 'var(--text-primary)', fontWeight: 600 }}>{p.label}</div>
                <div style={{ fontSize: '12.5px', color: 'var(--text-dim)', lineHeight: 1.5 }}>{p.sub}</div>
              </div>
            </div>
          ))}
        </div>

        <p style={{ fontSize: '12px', color: 'var(--text-dim)', lineHeight: 1.6 }}>
          Everything you confirm becomes your company&rsquo;s shared brain — what makes Aria, Nova, and Opus work for <em>your</em> business, not a generic one.
        </p>
      </div>

      {/* Right panel — the live conversation with Atlas */}
      <div className="onb-main" style={{ flex: 1, display: 'flex', justifyContent: 'center', padding: '32px 40px', height: '100vh' }}>
        <IntakeChat />
      </div>
    </div>
  );
}
