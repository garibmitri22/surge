'use client';

import { useRouter } from 'next/navigation';
import { getEmployees, getEmployeeStats, emptyEmployeeStat, pipelineEmployees, type EmployeeStat } from '@/lib/data';
import type { Employee } from '@/lib/mockData';
import { useEffect, useState } from 'react';
import { EmployeeAvatar } from '@/components/EmployeeAvatar';
import { SINGLE_LABEL, TEAM_LABEL } from '@/lib/pricing.mjs';

const roles = [
  { id: 'aria', name: 'Aria', role: 'Sales Representative', color: '#a78bfa', desc: 'Prospects, outreach, follow-ups, meetings booked. Your full-time SDR.' },
  { id: 'nova', name: 'Nova', role: 'Marketing Director', color: '#34d399', desc: 'Content, SEO, social, campaigns. Your marketing team in one hire.' },
  { id: 'opus', name: 'Opus', role: 'Operations Assistant', color: '#60a5fa', desc: 'Inbox, SOPs, reporting, coordination. Never drop the ball again.' },
];

export default function WorkforcePage() {
  const router = useRouter();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [stats, setStats] = useState<Record<string, EmployeeStat>>({});
  const [hoverId, setHoverId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [e, s] = await Promise.all([getEmployees(), getEmployeeStats()]);
      if (!cancelled) { setEmployees(e); setStats(s); }
    })();
    return () => { cancelled = true; };
  }, []);
  const [showHire, setShowHire] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [hired, setHired] = useState(false);

  function handleHire() {
    if (!selectedRole) return;
    setHired(true);
    setTimeout(() => {
      setShowHire(false);
      setHired(false);
      setSelectedRole(null);
    }, 2500);
  }

  return (
    <div style={{ padding: '32px 36px', animation: 'fadeIn 0.3s ease' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: '800', color: 'var(--text-primary)' }}>Workforce</h1>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '4px' }}>Your AI team. Working 24/7 so you don&rsquo;t have to.</p>
        </div>
        <button onClick={() => setShowHire(true)} className="btn-primary">+ Hire Employee</button>
      </div>

      <div style={{ marginBottom: '40px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '1px' }}>Active Employees</h2>
          <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
          <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{employees.length} hired</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
          {employees.map(e => {
            const st = stats[e.id] ?? emptyEmployeeStat();
            return (
            <div key={e.id} onClick={() => router.push(`/workforce/${e.id}`)}
              onMouseEnter={() => setHoverId(e.id)} onMouseLeave={() => setHoverId(null)}
              className="card-hover"
              style={{ background: 'var(--card)', border: `1px solid ${hoverId === e.id ? e.color + '50' : 'var(--border)'}`, borderRadius: '16px', padding: '24px', cursor: 'pointer', boxShadow: 'var(--shadow)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '12px', overflow: 'hidden', flexShrink: 0, border: `1px solid ${e.color}20` }}>
                    <EmployeeAvatar id={e.id} size={48} />
                  </div>
                  <div>
                    <p style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)' }}>{e.name}</p>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{e.role}</p>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
                <div className={`status-${e.status}`} style={{ width: '7px', height: '7px', borderRadius: '50%' }} />
                <span style={{ fontSize: '11px', color: e.status === 'active' ? 'var(--green)' : 'var(--amber)', textTransform: 'capitalize', fontWeight: '600' }}>{e.status}</span>
                <span style={{ fontSize: '11px', color: 'var(--text-dim)', marginLeft: '4px' }}>· {st.activeTasks} active · {st.completedTasks} done</span>
              </div>
              <div style={{ background: 'var(--bg)', borderRadius: '8px', padding: '10px 12px', marginBottom: '16px', border: '1px solid var(--border)' }}>
                <p style={{ fontSize: '10px', color: 'var(--text-dim)', marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Now working on</p>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>{st.currentTask}</p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(st.kpis.length, 1)}, 1fr)`, gap: '8px' }}>
                {st.kpis.map(kpi => (
                  <div key={kpi.label}>
                    <p style={{ fontSize: '10px', color: 'var(--text-dim)', marginBottom: '2px' }}>{kpi.label}</p>
                    <p style={{ fontSize: '14px', fontWeight: '700', color: kpi.value === 0 ? 'var(--text-dim)' : e.color, fontFamily: 'var(--font-geist-mono)' }}>{kpi.value}</p>
                  </div>
                ))}
              </div>
            </div>
            );
          })}
        </div>
      </div>

      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '1px' }}>In Development</h2>
          <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
          <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>Coming soon</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px' }}>
          {pipelineEmployees.map(e => (
            <div key={e.id} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px 16px', textAlign: 'center', boxShadow: 'var(--shadow)', opacity: 0.55 }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: e.color + '10', border: `1px dashed ${e.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '700', color: e.color + '80', margin: '0 auto 10px' }}>{e.avatar}</div>
              <p style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)' }}>{e.name}</p>
              <p style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '2px' }}>{e.role}</p>
              <div style={{ marginTop: '10px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '999px', padding: '3px 10px', display: 'inline-block' }}>
                <span style={{ fontSize: '9px', color: 'var(--text-dim)', letterSpacing: '0.8px', textTransform: 'uppercase', fontWeight: '600' }}>Soon</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showHire && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, backdropFilter: 'blur(4px)' }}>
          <div style={{ background: 'var(--card)', borderRadius: '20px', width: '540px', boxShadow: '0 24px 64px rgba(0,0,0,0.12)', overflow: 'hidden', animation: 'fadeIn 0.2s ease' }}>
            {hired ? (
              <div style={{ padding: '60px 40px', textAlign: 'center' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎉</div>
                <h2 style={{ fontSize: '22px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '8px' }}>{roles.find(r => r.id === selectedRole)?.name} is on the team.</h2>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Onboarding your company profile now. Ready in seconds.</p>
              </div>
            ) : (
              <>
                <div style={{ padding: '24px 28px', borderBottom: '1px solid var(--border)' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)' }}>Hire an AI Employee</h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>{SINGLE_LABEL}/month per hire — or the whole team for {TEAM_LABEL}/mo. Cancel any time. Up in 60 seconds.</p>
                </div>
                <div style={{ padding: '24px 28px' }}>
                  <p style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>Select a role</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
                    {roles.map(r => (
                      <div key={r.id} onClick={() => setSelectedRole(r.id)}
                        style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px', borderRadius: '12px', cursor: 'pointer', border: `1px solid ${selectedRole === r.id ? r.color + '50' : 'var(--border)'}`, background: selectedRole === r.id ? r.color + '06' : 'var(--bg)', transition: 'all 0.15s' }}>
                        <div style={{ width: '44px', height: '44px', borderRadius: '10px', overflow: 'hidden', flexShrink: 0 }}><EmployeeAvatar id={r.id} size={44} /></div>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)' }}>{r.name} <span style={{ color: 'var(--text-dim)', fontWeight: '400', fontSize: '13px' }}>— {r.role}</span></p>
                          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>{r.desc}</p>
                        </div>
                        <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: `2px solid ${selectedRole === r.id ? r.color : 'var(--border)'}`, background: selectedRole === r.id ? r.color : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s' }}>
                          {selectedRole === r.id && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#fff' }} />}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ background: 'var(--bg)', borderRadius: '10px', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid var(--border)' }}>
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Monthly total</span>
                    <span style={{ fontSize: '20px', fontWeight: '800', color: 'var(--accent)', fontFamily: 'var(--font-geist-mono)' }}>{SINGLE_LABEL}<span style={{ fontSize: '13px', fontWeight: '400', color: 'var(--text-dim)' }}>/mo</span></span>
                  </div>
                </div>
                <div style={{ padding: '16px 28px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button onClick={() => setShowHire(false)} className="btn-ghost">Cancel</button>
                  <button onClick={handleHire} disabled={!selectedRole} className="btn-primary" style={{ opacity: selectedRole ? 1 : 0.4 }}>Confirm Hire</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
