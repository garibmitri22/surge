'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCompanyProfile, resetOnboarding, getHoursSummary, getMyCompanyId, type CompanyProfile, type HoursSummary } from '@/lib/data';
import { supabase } from '@/lib/supabase';
import { SINGLE_LABEL, TEAM_LABEL, formatHours } from '@/lib/pricing.mjs';

export default function SettingsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [hours, setHours] = useState<HoursSummary | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [address, setAddress] = useState('');
  const [addrState, setAddrState] = useState<'idle' | 'saving' | 'saved'>('idle');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [p, h, id] = await Promise.all([getCompanyProfile(), getHoursSummary(), getMyCompanyId()]);
      if (cancelled) return;
      setProfile(p); setHours(h); setCompanyId(id);
      if (id) {
        const { data } = await supabase.from('companies').select('physical_address').eq('id', id).maybeSingle();
        if (!cancelled && data?.physical_address) setAddress(data.physical_address);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function saveAddress() {
    if (!companyId) return;
    setAddrState('saving');
    await supabase.from('companies').update({ physical_address: address.trim() || null }).eq('id', companyId);
    setAddrState('saved');
    setTimeout(() => setAddrState('idle'), 2000);
  }

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
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>Your plan and team hours.</p>
        </div>
        <div style={{ padding: '24px' }}>
          {(() => {
            const isTeam = hours?.plan === 'team';
            const name = isTeam ? 'Team' : 'Single Employee';
            const price = isTeam ? TEAM_LABEL : SINGLE_LABEL;
            const detail = isTeam
              ? `Aria, Nova & Opus, run by Atlas · ${hours ? formatHours(hours.allowance) : '200h'} of team time a month`
              : `One AI employee, run by Atlas · ${hours ? formatHours(hours.allowance) : '70h'} of team time a month`;
            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '20px', background: 'var(--accent-dim)', border: '1px solid #6366f130', borderRadius: '12px' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: '800', color: '#fff' }}>S</div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)' }}>{name} Plan</p>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{detail}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: '22px', fontWeight: '800', color: 'var(--accent)', fontFamily: 'var(--font-geist-mono)' }}>{price}</p>
                  <p style={{ fontSize: '11px', color: 'var(--text-dim)' }}>per month</p>
                </div>
              </div>
            );
          })()}
          {hours && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', padding: '0 4px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{formatHours(hours.balance)} of team time left this month</span>
              <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>{formatHours(hours.thisMonthUsed)} used · overtime available anytime</span>
            </div>
          )}
          <p style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '12px', textAlign: 'center' }}>Billing coming soon. You&rsquo;re on the founder&rsquo;s free plan.</p>
        </div>
      </div>

      {/* Sending & Compliance — the CAN-SPAM physical address (required before any send) */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px', boxShadow: 'var(--shadow)', overflow: 'hidden', marginBottom: '20px' }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)' }}>Sending &amp; Compliance</h2>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>Your business mailing address. Required by law in every email, so Aria can&rsquo;t send until it&rsquo;s set.</p>
        </div>
        <div style={{ padding: '20px 24px' }}>
          <textarea
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder={'Acme Inc.\n123 Main St, Suite 400\nHouston, TX 77002'}
            rows={3}
            style={{ width: '100%', resize: 'vertical', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '12px 14px', fontSize: '13px', color: 'var(--text-primary)', outline: 'none', fontFamily: 'inherit', lineHeight: 1.5 }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '12px' }}>
            <button onClick={saveAddress} disabled={addrState === 'saving'} style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 18px', fontSize: '13px', fontWeight: '700', cursor: addrState === 'saving' ? 'default' : 'pointer' }}>
              {addrState === 'saving' ? 'Saving…' : addrState === 'saved' ? 'Saved ✓' : 'Save address'}
            </button>
            {!address.trim() && <span style={{ fontSize: '12px', color: 'var(--amber)' }}>Outbound email is blocked until this is set.</span>}
          </div>
        </div>
      </div>

      {/* Timesheet — the full hours ledger */}
      {hours && hours.ledger.length > 0 && (
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px', boxShadow: 'var(--shadow)', overflow: 'hidden', marginBottom: '20px' }}>
          <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)' }}>
            <h2 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)' }}>Timesheet</h2>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>Every hour granted and worked.</p>
          </div>
          <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
            {hours.ledger.map((e, i) => (
              <div key={e.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '14px', alignItems: 'center', padding: '12px 24px', borderBottom: i < hours.ledger.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <div>
                  <p style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{e.reason}</p>
                  <p style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{new Date(e.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}{e.employeeId ? ` · ${e.employeeId}` : ''}</p>
                </div>
                <span style={{ fontSize: '13px', fontWeight: 700, fontFamily: 'var(--font-geist-mono)', color: e.delta >= 0 ? 'var(--green)' : 'var(--text-secondary)' }}>
                  {e.delta >= 0 ? '+' : ''}{formatHours(e.delta)}
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-dim)', fontFamily: 'var(--font-geist-mono)', minWidth: '48px', textAlign: 'right' }}>{formatHours(e.balanceAfter)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

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
