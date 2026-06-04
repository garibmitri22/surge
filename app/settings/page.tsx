'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCompanyProfile, resetOnboarding, CompanyProfile } from '@/lib/data';
import { supabase } from '@/lib/supabase';

export default function SettingsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<CompanyProfile | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const p = await getCompanyProfile();
      if (!cancelled) setProfile(p);
    })();
    return () => { cancelled = true; };
  }, []);

  async function handleReset() {
    if (confirm('This will restart the onboarding interview. Your AI workforce will be re-trained on your new answers. Continue?')) {
      await resetOnboarding();
      router.push('/onboarding');
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  const fields = profile ? [
    { label: 'Company Name', value: profile.companyName },
    { label: 'Industry', value: profile.industry },
    { label: 'Target Customers', value: profile.targetCustomers },
    { label: 'Brand Tone', value: profile.brandTone },
    { label: 'Primary Goal', value: profile.mainGoal },
    { label: 'Competitors', value: profile.competitors },
    { label: 'Team Size', value: profile.employeeCount },
  ] : [];

  return (
    <div style={{ padding: '32px 36px', animation: 'fadeIn 0.3s ease' }}>
      <div style={{ marginBottom: '32px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: '800', color: 'var(--text-primary)' }}>Settings</h1>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '4px' }}>Your company profile. This is what your AI workforce knows about your business.</p>
        </div>
        <button onClick={handleSignOut} style={{ flexShrink: 0, background: 'transparent', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 16px', color: 'var(--text-secondary)', fontSize: '13px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
          <span style={{ fontSize: '14px' }}>⏻</span> Sign Out
        </button>
      </div>

      {/* Company Profile */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px', boxShadow: 'var(--shadow)', overflow: 'hidden', marginBottom: '20px' }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)' }}>Company Profile</h2>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>Your AI employees read this on every task they perform.</p>
          </div>
          <button onClick={handleReset} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: '8px', padding: '7px 16px', color: 'var(--text-secondary)', fontSize: '12px', cursor: 'pointer' }}>
            Re-run Onboarding
          </button>
        </div>
        <div style={{ padding: '8px 0' }}>
          {fields.map(f => (
            <div key={f.label} style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '16px', padding: '14px 24px', borderBottom: '1px solid var(--border)' }}>
              <p style={{ fontSize: '12px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: '600', paddingTop: '1px' }}>{f.label}</p>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{f.value || '—'}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Workforce Plan */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px', boxShadow: 'var(--shadow)', overflow: 'hidden', marginBottom: '20px' }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)' }}>Workforce Plan</h2>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>Current subscription and billing.</p>
        </div>
        <div style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '20px', background: 'var(--accent-dim)', border: '1px solid #6366f130', borderRadius: '12px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: '800', color: '#fff' }}>S</div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)' }}>Growth Plan</p>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>3 AI employees · Unlimited tasks · Priority support</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: '22px', fontWeight: '800', color: 'var(--accent)', fontFamily: 'var(--font-geist-mono)' }}>$897</p>
              <p style={{ fontSize: '11px', color: 'var(--text-dim)' }}>per month</p>
            </div>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '12px', textAlign: 'center' }}>Billing coming soon. You're on the founder's free plan.</p>
        </div>
      </div>

      {/* Danger Zone */}
      <div style={{ background: 'var(--card)', border: '1px solid #ef444430', borderRadius: '16px', overflow: 'hidden' }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #ef444430' }}>
          <h2 style={{ fontSize: '14px', fontWeight: '700', color: '#ef4444' }}>Danger Zone</h2>
        </div>
        <div style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: '600' }}>Reset all company data</p>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>Clears your company profile and restarts onboarding.</p>
          </div>
          <button onClick={handleReset} style={{ background: '#ef444420', border: '1px solid #ef444440', borderRadius: '8px', padding: '8px 18px', color: '#ef4444', fontSize: '13px', cursor: 'pointer', fontWeight: '600' }}>Reset</button>
        </div>
      </div>
    </div>
  );
}
