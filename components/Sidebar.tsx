'use client';

import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getCompanyProfile, isOnboardingComplete, getUserDisplay } from '@/lib/data';
import { supabase } from '@/lib/supabase';
import { SINGLE_LABEL } from '@/lib/pricing.mjs';

const nav = [
  { href: '/dashboard', label: 'Dashboard', icon: '⬡' },
  { href: '/workforce', label: 'Workforce', icon: '◈' },
  { href: '/tasks', label: 'Tasks', icon: '◻' },
  { href: '/leads', label: 'Leads', icon: '◇' },
  { href: '/memory', label: 'Memory', icon: '◎' },
  { href: '/briefing', label: 'Briefing', icon: '◉' },
  { href: '/settings', label: 'Settings', icon: '◌' },
];

export default function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const [companyName, setCompanyName] = useState('Your Company');
  const [user, setUser] = useState<{ name: string; initial: string }>({ name: 'Account', initial: 'U' });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const complete = await isOnboardingComplete();
      if (cancelled) return;
      if (!complete) {
        router.replace('/onboarding');
        return;
      }
      const [profile, who] = await Promise.all([getCompanyProfile(), getUserDisplay()]);
      if (cancelled) return;
      if (profile?.companyName) setCompanyName(profile.companyName);
      setUser({ name: who.name, initial: who.initial });
    })();
    return () => { cancelled = true; };
  }, [router]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <aside style={{ width: '220px', flexShrink: 0, background: 'var(--surface)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', height: '100vh', position: 'sticky', top: 0 }}>
      <div style={{ padding: '28px 24px 20px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: '800', color: '#fff' }}>S</div>
          <div>
            <div style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)', letterSpacing: '0.5px' }}>SURGE</div>
            <div style={{ fontSize: '10px', color: 'var(--text-dim)', letterSpacing: '0.8px', textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px' }}>{companyName}</div>
          </div>
        </div>
      </div>

      <nav style={{ padding: '16px 12px', flex: 1 }}>
        <div style={{ fontSize: '10px', color: 'var(--text-dim)', letterSpacing: '1px', textTransform: 'uppercase', padding: '0 12px', marginBottom: '8px' }}>Platform</div>
        {nav.map(item => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link key={item.href} href={item.href} onClick={onNavigate} style={{ textDecoration: 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', borderRadius: '8px', marginBottom: '2px', background: active ? 'var(--accent-dim)' : 'transparent', border: active ? '1px solid #6366f118' : '1px solid transparent', color: active ? 'var(--accent)' : 'var(--text-secondary)', fontSize: '13px', fontWeight: active ? '600' : '400', cursor: 'pointer', transition: 'all 0.15s' }}>
                <span style={{ fontSize: '14px', opacity: active ? 1 : 0.6 }}>{item.icon}</span>
                {item.label}
                {active && <div style={{ marginLeft: 'auto', width: '4px', height: '4px', borderRadius: '50%', background: 'var(--accent)' }} />}
              </div>
            </Link>
          );
        })}
      </nav>

      <div style={{ padding: '0 12px 12px' }}>
        <Link href="/workforce" onClick={onNavigate} style={{ textDecoration: 'none' }}>
          <div style={{ background: 'var(--accent-dim)', border: '1px solid #6366f120', borderRadius: '10px', padding: '12px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '16px', color: 'var(--accent)' }}>+</span>
            <div>
              <p style={{ fontSize: '12px', fontWeight: '700', color: 'var(--accent)' }}>Hire an Employee</p>
              <p style={{ fontSize: '10px', color: 'var(--text-dim)' }}>{SINGLE_LABEL}/mo per hire</p>
            </div>
          </div>
        </Link>
      </div>

      <div style={{ padding: '12px 16px 16px', borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '8px', background: 'var(--bg)', border: '1px solid var(--border)' }}>
          <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '700', color: '#fff' }}>{user.initial}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</div>
            <div style={{ fontSize: '10px', color: 'var(--text-dim)' }}>Owner</div>
          </div>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--green)' }} />
        </div>
        <button onClick={handleSignOut} style={{ width: '100%', marginTop: '8px', background: 'transparent', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
          <span style={{ fontSize: '13px' }}>⏻</span> Sign Out
        </button>
      </div>
    </aside>
  );
}
