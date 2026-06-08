'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCompanyProfile, resetOnboarding, getHoursSummary, getMyCompanyId, getAvgDealValue, setAvgDealValue, type CompanyProfile, type HoursSummary } from '@/lib/data';
import { supabase } from '@/lib/supabase';
import { FOUNDING_LABEL, OFFER_NAME, formatHours } from '@/lib/pricing.mjs';
import { useVoiceMuted, setVoiceMuted } from '@/lib/voice-prefs';

export default function SettingsPage() {
  const router = useRouter();
  const voiceMuted = useVoiceMuted();
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [hours, setHours] = useState<HoursSummary | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [address, setAddress] = useState('');
  const [addrState, setAddrState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [bookingUrl, setBookingUrl] = useState('');
  const [bookingState, setBookingState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [phoneState, setPhoneState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [fullName, setFullName] = useState('');
  const [nameState, setNameState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [avgDeal, setAvgDeal] = useState('');
  const [avgDealState, setAvgDealState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [tendlc, setTendlc] = useState('none');
  const [captureUrl, setCaptureUrl] = useState('');
  const [copiedCapture, setCopiedCapture] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [p, h, id] = await Promise.all([getCompanyProfile(), getHoursSummary(), getMyCompanyId()]);
      if (cancelled) return;
      setProfile(p); setHours(h); setCompanyId(id);
      try { const { data: { user } } = await supabase.auth.getUser(); if (!cancelled) setFullName(String(user?.user_metadata?.full_name || user?.user_metadata?.name || '')); } catch { /* ignore */ }
      try { const v = await getAvgDealValue(); if (!cancelled && v) setAvgDeal(String(v)); } catch { /* ignore */ }
      if (id) {
        const { data } = await supabase.from('companies').select('physical_address, booking_url, owner_phone, tendlc_status').eq('id', id).maybeSingle();
        if (cancelled) return;
        if (data?.physical_address) setAddress(data.physical_address);
        if (data?.booking_url) setBookingUrl(data.booking_url);
        if (data?.owner_phone) setOwnerPhone(data.owner_phone);
        if (data?.tendlc_status) setTendlc(data.tendlc_status);
        try { const r = await fetch('/api/inbound/capture-link').then((x) => x.json()); if (!cancelled && r.ok) setCaptureUrl(r.url); } catch { /* ignore */ }
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

  async function saveBookingUrl() {
    if (!companyId) return;
    setBookingState('saving');
    await supabase.from('companies').update({ booking_url: bookingUrl.trim() || null }).eq('id', companyId);
    setBookingState('saved');
    setTimeout(() => setBookingState('idle'), 2000);
  }

  async function saveAvgDeal() {
    setAvgDealState('saving');
    const n = parseFloat(avgDeal.replace(/[^0-9.]/g, ''));
    await setAvgDealValue(Number.isFinite(n) && n > 0 ? n : null);
    setAvgDealState('saved');
    setTimeout(() => setAvgDealState('idle'), 2000);
  }

  async function saveName() {
    setNameState('saving');
    await supabase.auth.updateUser({ data: { full_name: fullName.trim() } });
    setNameState('saved');
    setTimeout(() => setNameState('idle'), 2000);
  }

  async function saveOwnerPhone() {
    if (!companyId) return;
    setPhoneState('saving');
    await supabase.from('companies').update({ owner_phone: ownerPhone.trim() || null }).eq('id', companyId);
    setPhoneState('saved');
    setTimeout(() => setPhoneState('idle'), 2000);
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
    <div className="page-pad" style={{ padding: '32px 36px', animation: 'fadeIn 0.3s ease' }}>
      <div style={{ marginBottom: '32px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: '800', color: 'var(--text-primary)' }}>Settings</h1>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '4px' }}>Your company profile. This is what your AI workforce knows about your business.</p>
        </div>
        <button onClick={handleSignOut} style={{ flexShrink: 0, background: 'transparent', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 16px', color: 'var(--text-secondary)', fontSize: '13px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
          <span style={{ fontSize: '14px' }}>⏻</span> Sign Out
        </button>
      </div>

      {/* Your Name — what the team calls you (fixes the email-handle leak in greetings) */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px', boxShadow: 'var(--shadow)', overflow: 'hidden', marginBottom: '20px' }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)' }}>Your Name</h2>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>How your team greets you across the app.</p>
        </div>
        <div style={{ padding: '20px 24px', display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g. Mitri" style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '11px 14px', fontSize: '13px', color: 'var(--text-primary)', outline: 'none' }} />
          <button onClick={saveName} disabled={nameState === 'saving'} style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 18px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>
            {nameState === 'saving' ? 'Saving…' : nameState === 'saved' ? 'Saved ✓' : 'Save'}
          </button>
        </div>
      </div>

      {/* Voice — the per-agent ElevenLabs TTS toggle (accessibility: mute the whole team's voice) */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px', boxShadow: 'var(--shadow)', overflow: 'hidden', marginBottom: '20px' }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)' }}>Voice</h2>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>Your team can read their replies aloud — each employee has a distinct voice. Tap the speaker on any message to listen; nothing ever plays on its own.</p>
        </div>
        <div style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
          <div>
            <p style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 600 }}>Mute all voices</p>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>{voiceMuted ? 'Voice is off — the speaker buttons are hidden.' : 'Voice is on — speaker buttons appear on replies.'}</p>
          </div>
          <button
            onClick={() => setVoiceMuted(!voiceMuted)}
            role="switch"
            aria-checked={voiceMuted}
            aria-label="Mute all agent voices"
            style={{ flexShrink: 0, width: '46px', height: '26px', borderRadius: '999px', border: '1px solid var(--border)', background: voiceMuted ? 'var(--surface)' : 'var(--accent)', position: 'relative', cursor: 'pointer', transition: 'background 0.15s ease' }}
          >
            <span style={{ position: 'absolute', top: '2px', left: voiceMuted ? '2px' : '22px', width: '20px', height: '20px', borderRadius: '50%', background: '#fff', transition: 'left 0.15s ease', boxShadow: '0 1px 2px rgba(0,0,0,0.2)' }} />
          </button>
        </div>
      </div>

      {/* Average deal value — powers the honest pipeline estimate (counts × this number) */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px', boxShadow: 'var(--shadow)', overflow: 'hidden', marginBottom: '20px' }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)' }}>Average deal / job value</h2>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>Your typical revenue per closed customer. Turns real lead counts into an estimated pipeline figure on your dashboard — left blank, we show counts only (never a made-up number).</p>
        </div>
        <div style={{ padding: '20px 24px', display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '15px', color: 'var(--text-dim)' }}>$</span>
          <input value={avgDeal} onChange={(e) => setAvgDeal(e.target.value)} inputMode="numeric" placeholder="e.g. 15000" style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '11px 14px', fontSize: '13px', color: 'var(--text-primary)', outline: 'none' }} />
          <button onClick={saveAvgDeal} disabled={avgDealState === 'saving'} style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 18px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>
            {avgDealState === 'saving' ? 'Saving…' : avgDealState === 'saved' ? 'Saved ✓' : 'Save'}
          </button>
        </div>
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
            const name = OFFER_NAME;
            const price = FOUNDING_LABEL;
            const detail = `Your AI sales team, run by Atlas · ${hours ? formatHours(hours.allowance) : '70h'} of team time a month · pay nothing until appointments are booked`;
            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '20px', background: 'var(--accent-dim)', border: '1px solid #6366f130', borderRadius: '12px' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: '800', color: '#fff' }}>S</div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)' }}>{name}</p>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{detail}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: '22px', fontWeight: '800', color: 'var(--accent)', fontFamily: 'var(--font-geist-mono)' }}>{price}</p>
                  <p style={{ fontSize: '11px', color: 'var(--text-dim)' }}>/mo · founding rate</p>
                </div>
              </div>
            );
          })()}
          {hours && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', padding: '0 4px' }}>
              {hours.unlimited ? (
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Unlimited team time (internal account)</span>
              ) : (
                <>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{formatHours(hours.balance)} of team time left this month</span>
                  <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>{formatHours(hours.thisMonthUsed)} used · overtime available anytime</span>
                </>
              )}
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

      {/* Booking link — where a warm prospect lands after they click the CTA */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px', boxShadow: 'var(--shadow)', overflow: 'hidden', marginBottom: '20px' }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)' }}>Booking Link</h2>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>Where a prospect goes when they click the call-to-action in Aria&rsquo;s emails. Leave blank to use Surge&rsquo;s built-in interest page.</p>
        </div>
        <div style={{ padding: '20px 24px' }}>
          <input
            value={bookingUrl}
            onChange={(e) => setBookingUrl(e.target.value)}
            placeholder="https://calendly.com/your-team/intro"
            style={{ width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '12px 14px', fontSize: '13px', color: 'var(--text-primary)', outline: 'none' }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '12px' }}>
            <button onClick={saveBookingUrl} disabled={bookingState === 'saving'} style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 18px', fontSize: '13px', fontWeight: '700', cursor: bookingState === 'saving' ? 'default' : 'pointer' }}>
              {bookingState === 'saving' ? 'Saving…' : bookingState === 'saved' ? 'Saved ✓' : 'Save link'}
            </button>
            {!bookingUrl.trim() && <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>Using Surge&rsquo;s hosted interest page.</span>}
          </div>
        </div>
      </div>

      {/* Speed-to-Lead — inbound capture form + telephony (Phase 1) */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px', boxShadow: 'var(--shadow)', overflow: 'hidden', marginBottom: '20px' }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)' }}>Speed-to-Lead (Inbound)</h2>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>Capture inbound leads and have Aria text them back instantly. Texting requires Twilio + 10DLC registration (carrier/legal requirement).</p>
        </div>
        <div style={{ padding: '20px 24px' }}>
          {/* Capture link */}
          <p style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Your capture form link</p>
          {captureUrl ? (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '18px' }}>
              <input readOnly value={captureUrl} style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '9px 12px', fontSize: '12px', color: 'var(--text-secondary)', outline: 'none' }} />
              <button onClick={() => { navigator.clipboard?.writeText(captureUrl); setCopiedCapture(true); setTimeout(() => setCopiedCapture(false), 1500); }} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '9px 14px', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer' }}>{copiedCapture ? 'Copied ✓' : 'Copy'}</button>
            </div>
          ) : <p style={{ fontSize: '12px', color: 'var(--text-dim)', marginBottom: '18px' }}>Generating…</p>}

          {/* Owner phone for one-tap Call */}
          <p style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Your phone (for one-tap Call)</p>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '18px' }}>
            <input value={ownerPhone} onChange={(e) => setOwnerPhone(e.target.value)} placeholder="+1 555 555 5555" style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '9px 12px', fontSize: '13px', color: 'var(--text-primary)', outline: 'none' }} />
            <button onClick={saveOwnerPhone} disabled={phoneState === 'saving'} style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 16px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>{phoneState === 'saving' ? 'Saving…' : phoneState === 'saved' ? 'Saved ✓' : 'Save'}</button>
          </div>

          {/* 10DLC status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>SMS sending status:</span>
            <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'capitalize', color: tendlc === 'registered' ? 'var(--green)' : 'var(--amber)', background: tendlc === 'registered' ? '#16a34a18' : '#f59e0b18', borderRadius: '999px', padding: '3px 10px' }}>
              {tendlc === 'registered' ? 'Registered — Aria can text' : tendlc === 'pending' ? '10DLC pending' : 'Not set up'}
            </span>
            {tendlc !== 'registered' && <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>Leads are captured now; texting turns on once 10DLC is registered.</span>}
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
