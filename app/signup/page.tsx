'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);

  const canSubmit = email.trim() !== '' && password.length >= 6 && !loading;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    // If email confirmation is disabled in Supabase, signUp returns a session
    // and we can go straight to onboarding. Otherwise, ask them to confirm.
    if (data.session) {
      router.push('/onboarding');
      router.refresh();
    } else {
      setCheckEmail(true);
      setLoading(false);
    }
  }

  if (checkEmail) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: '24px' }}>
        <div style={{ width: '100%', maxWidth: '400px', animation: 'fadeIn 0.4s ease', textAlign: 'center' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', fontWeight: '800', color: '#fff', margin: '0 auto 20px' }}>S</div>
          <h1 style={{ fontSize: '22px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '8px' }}>Check your email</h1>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            We sent a confirmation link to <strong style={{ color: 'var(--text-primary)' }}>{email.trim()}</strong>. Click it to activate your account, then sign in.
          </p>
          <Link href="/login" style={{ display: 'inline-block', marginTop: '24px', color: 'var(--accent)', fontWeight: '600', textDecoration: 'none', fontSize: '14px' }}>Go to sign in →</Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '400px', animation: 'fadeIn 0.4s ease' }}>

        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'center', marginBottom: '28px' }}>
          <div style={{ width: '34px', height: '34px', borderRadius: '9px', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '17px', fontWeight: '800', color: '#fff' }}>S</div>
          <span style={{ fontSize: '17px', fontWeight: '800', color: 'var(--text-primary)', letterSpacing: '0.5px' }}>SURGE</span>
        </div>

        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px', boxShadow: 'var(--shadow-md)', padding: '32px 28px' }}>
          <h1 style={{ fontSize: '22px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '4px' }}>Create your account</h1>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '24px' }}>Build your AI workforce in minutes.</p>

          <form onSubmit={handleSubmit}>
            <label style={labelStyle}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" autoComplete="email" autoFocus style={{ ...inputStyle, marginBottom: '16px' }} />

            <label style={labelStyle}>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 6 characters" autoComplete="new-password" style={{ ...inputStyle, marginBottom: '6px' }} />
            <p style={{ fontSize: '11px', color: 'var(--text-dim)', marginBottom: error ? '12px' : '20px' }}>Minimum 6 characters.</p>

            {error && (
              <div style={{ background: '#ef444412', border: '1px solid #ef444433', borderRadius: '9px', padding: '10px 12px', marginBottom: '16px' }}>
                <p style={{ fontSize: '12.5px', color: 'var(--red)', lineHeight: 1.45 }}>{error}</p>
              </div>
            )}

            <button type="submit" disabled={!canSubmit} style={{
              width: '100%', background: canSubmit ? 'var(--accent)' : 'var(--border)',
              color: canSubmit ? '#fff' : 'var(--text-dim)', border: 'none', borderRadius: '10px',
              padding: '12px', fontSize: '14px', fontWeight: '700',
              cursor: canSubmit ? 'pointer' : 'default', transition: 'all 0.15s ease',
            }}>
              {loading ? 'Creating account…' : 'Create Account'}
            </button>
          </form>
          <p style={{ fontSize: '11px', color: 'var(--text-dim)', textAlign: 'center', marginTop: '14px', lineHeight: 1.5 }}>
            By creating an account you agree to our{' '}
            <Link href="/legal/terms" style={{ color: 'var(--text-secondary)', textDecoration: 'underline' }}>Terms</Link>{' '}and{' '}
            <Link href="/legal/privacy" style={{ color: 'var(--text-secondary)', textDecoration: 'underline' }}>Privacy Policy</Link>.
          </p>
        </div>

        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', textAlign: 'center', marginTop: '20px' }}>
          Already have an account?{' '}
          <Link href="/login" style={{ color: 'var(--accent)', fontWeight: '600', textDecoration: 'none' }}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = { fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: '600', display: 'block', marginBottom: '6px' };
const inputStyle: React.CSSProperties = { width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '11px 14px', fontSize: '14px', color: 'var(--text-primary)', outline: 'none' };
