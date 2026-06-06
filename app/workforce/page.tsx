'use client';

import { useRouter } from 'next/navigation';
import { getEmployees, getEmployeeStats, emptyEmployeeStat, pipelineEmployees, type EmployeeStat } from '@/lib/data';
import type { Employee } from '@/lib/mockData';
import { useEffect, useState } from 'react';
import { EmployeeAvatar } from '@/components/EmployeeAvatar';
import { DEPARTMENTS, EMP_OUTCOME } from '@/lib/departments.mjs';

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

  const byId = (id: string) => employees.find((e) => e.id === id);

  return (
    <div className="page-pad" style={{ padding: '32px 36px', animation: 'fadeIn 0.3s ease' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '28px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: '800', color: 'var(--text-primary)' }}>Your Company</h1>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '4px' }}>Your AI team, by department. Working 24/7 so you don&rsquo;t have to.</p>
        </div>
        <button onClick={() => router.push('/hire')} className="btn-primary">+ Hire Employee</button>
      </div>

      {/* Org by department — feels like a company, not a flat list of agents. */}
      {DEPARTMENTS.map((dept) => {
        const members = dept.employeeIds.map(byId).filter(Boolean) as Employee[];
        if (members.length === 0) return null;
        return (
          <div key={dept.id} style={{ marginBottom: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <h2 style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '1px' }}>{dept.name}</h2>
              <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }} className="results-hero">
              {members.map((e) => {
                const st = stats[e.id] ?? emptyEmployeeStat();
                return (
                  <div key={e.id} onClick={() => router.push(`/workforce/${e.id}`)}
                    onMouseEnter={() => setHoverId(e.id)} onMouseLeave={() => setHoverId(null)}
                    className="card-hover"
                    style={{ background: 'var(--card)', border: `1px solid ${hoverId === e.id ? e.color + '50' : 'var(--border)'}`, borderRadius: '16px', padding: '22px', cursor: 'pointer', boxShadow: 'var(--shadow)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                      <div style={{ width: '48px', height: '48px', borderRadius: '12px', overflow: 'hidden', flexShrink: 0, border: `1px solid ${e.color}20` }}>
                        <EmployeeAvatar id={e.id} size={48} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)' }}>{e.name}</p>
                        <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{e.role}</p>
                      </div>
                    </div>
                    {(EMP_OUTCOME as Record<string, string>)[e.id] && <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '12px' }}>{(EMP_OUTCOME as Record<string, string>)[e.id]}</p>}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
                      <div className={`status-${e.status}`} style={{ width: '7px', height: '7px', borderRadius: '50%' }} />
                      <span style={{ fontSize: '11px', color: e.status === 'active' ? 'var(--green)' : 'var(--amber)', textTransform: 'capitalize', fontWeight: '600' }}>{e.status}</span>
                      <span style={{ fontSize: '11px', color: 'var(--text-dim)', marginLeft: '4px' }}>· {st.activeTasks} active · {st.completedTasks} done</span>
                    </div>
                    <div style={{ background: 'var(--bg)', borderRadius: '8px', padding: '10px 12px', border: '1px solid var(--border)' }}>
                      <p style={{ fontSize: '10px', color: 'var(--text-dim)', marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{st.activeTasks === 0 ? 'Status' : 'Working on'}</p>
                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>{st.activeTasks === 0 ? 'Ready for work — give the team a directive' : st.currentTask}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Expansion — the visible path to a bigger team. */}
      <div style={{ marginTop: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
          <h2 style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '1px' }}>Grow your team</h2>
          <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
          <button onClick={() => router.push('/hire')} style={{ fontSize: '11px', color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Open hiring →</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px' }}>
          {pipelineEmployees.map((e) => (
            <div key={e.id} onClick={() => router.push('/hire')} className="card-hover" style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '18px 14px', textAlign: 'center', boxShadow: 'var(--shadow)', cursor: 'pointer' }}>
              <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: e.color + '10', border: `1px dashed ${e.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '700', color: e.color + 'aa', margin: '0 auto 10px' }}>{e.avatar}</div>
              <p style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>{e.name}</p>
              <p style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '2px' }}>{e.role}</p>
              <div style={{ marginTop: '10px', background: 'var(--accent-dim)', border: '1px solid #6366f120', borderRadius: '999px', padding: '3px 10px', display: 'inline-block' }}>
                <span style={{ fontSize: '9px', color: 'var(--accent)', letterSpacing: '0.6px', textTransform: 'uppercase', fontWeight: '700' }}>Join waitlist</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
