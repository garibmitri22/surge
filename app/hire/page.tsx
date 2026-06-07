'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { HIRE_CATALOG } from '@/lib/departments.mjs';
import { getMyCompanyId } from '@/lib/data';
import { supabase } from '@/lib/supabase';
import { EmployeeAvatar } from '@/components/EmployeeAvatar';
import { FOUNDING_LABEL } from '@/lib/pricing.mjs';

const EMP_COLOR: Record<string, string> = { aria: '#a78bfa', nova: '#34d399', opus: '#60a5fa', atlas: '#f59e0b' };

type Role = { status: 'active' | 'soon' | 'waitlist'; id?: string; name?: string; role: string; desc: string; included?: boolean };

// The hiring catalog — staff your company, department by department. Active roles can
// be hired now; future roles are honestly "Coming soon"; pipeline roles are "Join
// waitlist" (the visible expansion path). Hiring an active employee enables them.
export default function HirePage() {
  const router = useRouter();
  const [hired, setHired] = useState<string[]>([]);
  const [waitlisted, setWaitlisted] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [celebrate, setCelebrate] = useState<{ name: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const id = await getMyCompanyId();
      if (!id || cancelled) return;
      const [{ data: co }, { data: w }] = await Promise.all([
        supabase.from('companies').select('hired_employees').eq('id', id).maybeSingle(),
        supabase.from('waitlist_signups').select('role_id').eq('company_id', id),
      ]);
      if (cancelled) return;
      setHired(co?.hired_employees ?? []);
      setWaitlisted((w ?? []).map((r) => r.role_id));
    })();
    return () => { cancelled = true; };
  }, []);

  async function hire(id: string, name: string) {
    if (busy) return;
    setBusy(id);
    try {
      const res = await fetch('/api/hire', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ employeeId: id }) });
      const r = await res.json().catch(() => ({ ok: false }));
      if (r.ok) { setHired(r.hired_employees ?? [...hired, id]); setCelebrate({ name }); setTimeout(() => setCelebrate(null), 2600); }
    } finally { setBusy(null); }
  }

  async function joinWaitlist(id: string) {
    if (busy) return;
    setBusy(id);
    try {
      const res = await fetch('/api/hire/waitlist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roleId: id }) });
      const r = await res.json().catch(() => ({ ok: false }));
      if (r.ok) setWaitlisted((w) => [...new Set([...w, id])]);
    } finally { setBusy(null); }
  }

  return (
    <div className="page-pad" style={{ padding: '32px 36px', animation: 'fadeIn 0.3s ease' }}>
      <button onClick={() => router.push('/workforce')} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer', marginBottom: '18px', padding: 0 }}>← Back to Workforce</button>
      <div style={{ marginBottom: '6px' }}>
        <h1 style={{ fontSize: '26px', fontWeight: '800', color: 'var(--text-primary)' }}>Build your team</h1>
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '4px', maxWidth: '640px', lineHeight: 1.5 }}>
          One done-for-you AI sales team — {FOUNDING_LABEL}/mo founding rate, and you pay nothing until qualified appointments are booked. Atlas, your Chief of Staff, is included.
        </p>
      </div>

      {HIRE_CATALOG.map((group) => (
        <div key={group.deptId} style={{ marginTop: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
            <h2 style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '1px' }}>{group.dept}</h2>
            <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }} className="results-hero">
            {(group.roles as Role[]).map((r, i) => {
              const color = (r.id && EMP_COLOR[r.id]) || '#6366f1';
              const isHired = r.id && hired.includes(r.id);
              const isIncluded = r.included; // Atlas
              const onWaitlist = r.id && waitlisted.includes(r.id);
              return (
                <div key={r.id || `${group.deptId}-${i}`} className="card-hover" style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '14px', boxShadow: 'var(--shadow)', padding: '18px', opacity: r.status === 'soon' ? 0.7 : 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
                    <div style={{ width: '44px', height: '44px', borderRadius: '11px', overflow: 'hidden', flexShrink: 0, border: `1px solid ${color}20` }}>
                      {r.status === 'active' && r.id ? <EmployeeAvatar id={r.id} size={44} /> : (
                        <div style={{ width: '100%', height: '100%', background: r.status === 'waitlist' ? `${color}10` : 'var(--bg)', border: `1px dashed ${color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, color: `${color}99` }}>{(r.name || r.role)[0]}</div>
                      )}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>{r.name || r.role}</p>
                      <p style={{ fontSize: '12px', color: 'var(--text-dim)' }}>{r.role}</p>
                    </div>
                  </div>
                  <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '14px', minHeight: '36px' }}>{r.desc}</p>

                  {r.status === 'active' && (
                    isIncluded ? (
                      <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--green)' }}>✓ Included with every plan</span>
                    ) : isHired ? (
                      <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--green)' }}>✓ On your team</span>
                    ) : (
                      <button onClick={() => hire(r.id!, r.name || r.role)} disabled={busy === r.id} style={{ width: '100%', background: color, color: '#fff', border: 'none', borderRadius: '10px', padding: '10px', fontSize: '13px', fontWeight: 700, cursor: busy === r.id ? 'default' : 'pointer' }}>
                        {busy === r.id ? 'Hiring…' : `Hire ${r.name}`}
                      </button>
                    )
                  )}
                  {r.status === 'soon' && (
                    <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.6px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '999px', padding: '4px 12px', display: 'inline-block' }}>Coming soon</span>
                  )}
                  {r.status === 'waitlist' && (
                    onWaitlist ? (
                      <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent)' }}>✓ On the waitlist</span>
                    ) : (
                      <button onClick={() => joinWaitlist(r.id!)} disabled={busy === r.id} style={{ width: '100%', background: 'var(--surface)', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: '10px', padding: '10px', fontSize: '13px', fontWeight: 600, cursor: busy === r.id ? 'default' : 'pointer' }}>
                        {busy === r.id ? 'Joining…' : 'Join waitlist'}
                      </button>
                    )
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {celebrate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, backdropFilter: 'blur(4px)', animation: 'fadeIn 0.2s ease' }}>
          <div style={{ background: 'var(--card)', borderRadius: '20px', padding: '52px 44px', textAlign: 'center', boxShadow: '0 24px 64px rgba(0,0,0,0.16)', maxWidth: '420px' }}>
            <div style={{ fontSize: '48px', marginBottom: '14px' }}>🎉</div>
            <h2 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px' }}>{celebrate.name} is on the team.</h2>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>They already know your business from your company profile — ready to work right now.</p>
          </div>
        </div>
      )}
    </div>
  );
}
