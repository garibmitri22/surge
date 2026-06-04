'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { saveCompanyProfile, isOnboardingComplete } from '@/lib/data';

const steps = [
  {
    id: 'companyName',
    question: "What's your company name?",
    subtitle: 'This is how your AI team will identify your business.',
    type: 'text',
    placeholder: 'e.g. Acme Corp',
  },
  {
    id: 'industry',
    question: 'What industry are you in?',
    subtitle: 'Your AI employees will specialise in your space.',
    type: 'options',
    options: ['SaaS / Tech', 'Agency / Services', 'E-commerce', 'Real Estate', 'Healthcare', 'Construction / Trades', 'Finance', 'Other'],
  },
  {
    id: 'targetCustomers',
    question: 'Who are your target customers?',
    subtitle: "Aria will research and target these people. Be specific — she's listening.",
    type: 'text',
    placeholder: 'e.g. B2B SaaS companies with 10–100 employees, US-based, Series A–B',
  },
  {
    id: 'brandTone',
    question: "How should your brand sound?",
    subtitle: 'Every message Nova and Aria send will match this voice.',
    type: 'options',
    options: ['Professional & formal', 'Direct & no-nonsense', 'Friendly & conversational', 'Bold & confident', 'Technical & precise', 'Warm & human'],
  },
  {
    id: 'mainGoal',
    question: "What's your #1 goal right now?",
    subtitle: 'Your entire AI workforce will orient around this.',
    type: 'options',
    options: ['Generate more leads', 'Close more sales', 'Grow brand awareness', 'Improve operations', 'Scale without hiring', 'Launch a new product'],
  },
  {
    id: 'competitors',
    question: 'Who are your main competitors?',
    subtitle: "Aria will track them. Nova will position against them. Opus will document them.",
    type: 'text',
    placeholder: 'e.g. HubSpot, Salesforce, Monday.com',
  },
  {
    id: 'employeeCount',
    question: 'How many people are on your team today?',
    subtitle: "We'll scale your AI workforce to match your ambition.",
    type: 'options',
    options: ['Just me', '2–5', '6–20', '21–50', '50+'],
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [inputValue, setInputValue] = useState('');
  const [animating, setAnimating] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (await isOnboardingComplete() && !cancelled) router.replace('/dashboard');
    })();
    return () => { cancelled = true; };
  }, [router]);

  const step = steps[currentStep];
  const progress = ((currentStep) / steps.length) * 100;
  const isLast = currentStep === steps.length - 1;

  async function advance(value: string) {
    if (!value.trim()) return;
    const updated = { ...answers, [step.id]: value };
    setAnswers(updated);

    if (isLast) {
      setAnimating(true);
      try {
        await saveCompanyProfile({
          companyName: updated.companyName || '',
          industry: updated.industry || '',
          targetCustomers: updated.targetCustomers || '',
          brandTone: updated.brandTone || '',
          mainGoal: updated.mainGoal || '',
          competitors: updated.competitors || '',
          employeeCount: updated.employeeCount || '',
          completedAt: new Date().toISOString(),
        });
      } catch (err) {
        // Don't leave the user stuck on the "Building..." screen forever.
        setAnimating(false);
        setSaveError(
          'We could not save your company profile. Make sure the database tables have been created in Supabase, then try again.'
        );
        console.error('saveCompanyProfile failed:', err);
        return;
      }
      setTimeout(() => router.push('/dashboard'), 2000);
      return;
    }

    setAnimating(true);
    setTimeout(() => {
      setCurrentStep(s => s + 1);
      setInputValue('');
      setAnimating(false);
    }, 300);
  }

  if (animating && isLast) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', flexDirection: 'column', gap: '24px' }}>
        <div style={{ width: '64px', height: '64px', borderRadius: '16px', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', fontWeight: '800', color: '#fff' }}>S</div>
        <h2 style={{ fontSize: '24px', fontWeight: '800', color: 'var(--text-primary)', textAlign: 'center' }}>Building your AI workforce...</h2>
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', textAlign: 'center' }}>Aria, Nova, and Opus are learning about {answers.companyName}.</p>
        <div style={{ width: '240px', height: '3px', background: 'var(--border)', borderRadius: '999px', overflow: 'hidden' }}>
          <div style={{ height: '100%', background: 'var(--accent)', borderRadius: '999px', animation: 'progress-fill 2s ease forwards' }} />
        </div>
        <style>{`@keyframes progress-fill { from { width: 0% } to { width: 100% } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: 'var(--bg)' }}>

      {/* Left panel */}
      <div style={{ width: '380px', flexShrink: 0, background: 'var(--surface)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', padding: '40px', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '48px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: '800', color: '#fff' }}>S</div>
            <span style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)', letterSpacing: '0.5px' }}>SURGE</span>
          </div>

          <h2 style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '24px' }}>Setting up your workforce</h2>

          {steps.map((s, i) => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', opacity: i > currentStep ? 0.3 : 1, transition: 'opacity 0.3s' }}>
              <div style={{
                width: '24px', height: '24px', borderRadius: '50%', flexShrink: 0,
                background: i < currentStep ? 'var(--accent)' : i === currentStep ? 'var(--accent)' : 'var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: i === currentStep ? '2px solid var(--accent)' : 'none',
              }}>
                {i < currentStep
                  ? <span style={{ fontSize: '11px', color: '#fff', fontWeight: '700' }}>✓</span>
                  : <span style={{ fontSize: '10px', color: i === currentStep ? '#fff' : 'var(--text-dim)', fontWeight: '700' }}>{i + 1}</span>
                }
              </div>
              <span style={{ fontSize: '13px', color: i === currentStep ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: i === currentStep ? '600' : '400' }}>
                {s.question.replace('?', '')}
              </span>
            </div>
          ))}
        </div>

        <p style={{ fontSize: '12px', color: 'var(--text-dim)', lineHeight: 1.6 }}>
          This takes 2 minutes. Every answer directly trains your AI employees to work for <em>your</em> business — not a generic one.
        </p>
      </div>

      {/* Right panel — question */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px' }}>
        <div style={{ width: '100%', maxWidth: '540px', animation: animating ? 'fadeOut 0.3s ease forwards' : 'fadeIn 0.4s ease' }}>

          {/* Progress bar */}
          <div style={{ height: '2px', background: 'var(--border)', borderRadius: '999px', marginBottom: '48px', overflow: 'hidden' }}>
            <div style={{ height: '100%', background: 'var(--accent)', borderRadius: '999px', width: `${progress}%`, transition: 'width 0.4s ease' }} />
          </div>

          <p style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: '700', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '12px' }}>
            Step {currentStep + 1} of {steps.length}
          </p>
          <h1 style={{ fontSize: '32px', fontWeight: '800', color: 'var(--text-primary)', lineHeight: 1.2, marginBottom: '10px' }}>
            {step.question}
          </h1>
          <p style={{ fontSize: '15px', color: 'var(--text-secondary)', marginBottom: '36px', lineHeight: 1.5 }}>
            {step.subtitle}
          </p>

          {saveError && (
            <div style={{ background: '#ef444415', border: '1px solid #ef444440', borderRadius: '10px', padding: '12px 16px', marginBottom: '20px' }}>
              <p style={{ fontSize: '13px', color: '#ef4444', lineHeight: 1.5 }}>{saveError}</p>
            </div>
          )}

          {step.type === 'text' ? (
            <div>
              <input
                autoFocus
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && advance(inputValue)}
                placeholder={step.placeholder}
                style={{
                  width: '100%', background: 'var(--card)', border: '1px solid var(--border)',
                  borderRadius: '12px', padding: '16px 20px', fontSize: '16px',
                  color: 'var(--text-primary)', outline: 'none', marginBottom: '16px',
                  transition: 'border-color 0.2s',
                }}
                onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                onBlur={e => e.target.style.borderColor = 'var(--border)'}
              />
              <button
                onClick={() => advance(inputValue)}
                disabled={!inputValue.trim()}
                style={{
                  background: inputValue.trim() ? 'var(--accent)' : 'var(--border)',
                  color: inputValue.trim() ? '#fff' : 'var(--text-dim)',
                  border: 'none', borderRadius: '10px', padding: '14px 28px',
                  fontSize: '14px', fontWeight: '700', cursor: inputValue.trim() ? 'pointer' : 'default',
                  transition: 'all 0.2s',
                }}
              >
                {isLast ? 'Launch My Workforce →' : 'Continue →'}
              </button>
              <p style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '12px' }}>Press Enter to continue</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {step.options?.map(opt => (
                <button
                  key={opt}
                  onClick={() => advance(opt)}
                  style={{
                    background: 'var(--card)', border: '1px solid var(--border)',
                    borderRadius: '12px', padding: '16px 20px', fontSize: '14px',
                    color: 'var(--text-secondary)', cursor: 'pointer', textAlign: 'left',
                    fontWeight: '500', transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { (e.target as HTMLElement).style.borderColor = 'var(--accent)'; (e.target as HTMLElement).style.color = 'var(--text-primary)'; (e.target as HTMLElement).style.background = 'var(--accent-dim)'; }}
                  onMouseLeave={e => { (e.target as HTMLElement).style.borderColor = 'var(--border)'; (e.target as HTMLElement).style.color = 'var(--text-secondary)'; (e.target as HTMLElement).style.background = 'var(--card)'; }}
                >
                  {opt}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <style>{`@keyframes fadeOut { from { opacity: 1; transform: translateY(0) } to { opacity: 0; transform: translateY(-8px) } }`}</style>
    </div>
  );
}
