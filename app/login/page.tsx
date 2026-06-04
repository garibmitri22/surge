'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const canSubmit = email.trim() !== '' && password !== '' && !loading;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    router.push('/dashboard');
    router.refresh();
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
          <h1 style={{ fontSize: '22px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '4px' }}>Welcome back</h1>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '24px' }}>Sign in to your AI workforce.</p>

          <form onSubmit={handleSubmit}>
            <label style={labelStyle}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" autoComplete="email" autoFocus style={{ ...inputStyle, marginBottom: '16px' }} />

            <label style={labelStyle}>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" style={{ ...inputStyle, marginBottom: error ? '12px' : '20px' }} />

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
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        </div>

        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', textAlign: 'center', marginTop: '20px' }}>
          New here?{' '}
          <Link href="/signup" style={{ color: 'var(--accent)', fontWeight: '600', textDecoration: 'none' }}>Create an account</Link>
        </p>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = { fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: '600', display: 'block', marginBottom: '6px' };
const inputStyle: React.CSSProperties = { width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '11px 14px', fontSize: '14px', color: 'var(--text-primary)', outline: 'none' };
