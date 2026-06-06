'use client';

import { useParams, useRouter } from 'next/navigation';
import { getEmployee, getTasks, getActivity, getEmployeeStats, emptyEmployeeStat, type EmployeeStat } from '@/lib/data';
import type { Employee, Task, ActivityItem } from '@/lib/mockData';
import { useState, useEffect } from 'react';
import { EmployeeAvatar } from '@/components/EmployeeAvatar';
import { ChatPanel } from '@/components/ChatPanel';

type Tab = 'chat' | 'tasks' | 'activity' | 'responsibilities';

const priorityColors: Record<string, string> = {
  high: '#ef4444',
  medium: '#eab308',
  low: '#9ca3af',
};

const statusColors: Record<string, string> = {
  queued: '#9ca3af',
  in_progress: '#6366f1',
  completed: '#22c55e',
};

export default function EmployeePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('chat');
  // Command-bar deep link: /workforce/<id>?ask=<message> auto-sends in chat.
  // Read once at mount via a lazy initializer (no setState-in-effect).
  const [initialAsk, setInitialAsk] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return new URLSearchParams(window.location.search).get('ask');
  });
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [empTasks, setEmpTasks] = useState<Task[]>([]);
  const [empActivity, setEmpActivity] = useState<ActivityItem[]>([]);
  const [stat, setStat] = useState<EmployeeStat>(emptyEmployeeStat());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [emp, tks, acts, es] = await Promise.all([getEmployee(id), getTasks(), getActivity(), getEmployeeStats()]);
      if (cancelled) return;
      setEmployee(emp);
      setEmpTasks(tks.filter(t => t.assigneeId === id));
      setEmpActivity(acts.filter(a => a.employeeId === id));
      setStat(es[id] ?? emptyEmployeeStat());
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [id]);

  if (loading) return null;
  if (!employee) return (
    <div style={{ padding: '40px', color: 'var(--text-secondary)' }}>
      Employee not found. <button onClick={() => router.back()} style={{ color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer' }}>Go back</button>
    </div>
  );

  return (
    <div className="page-pad" style={{ padding: '32px 36px', animation: 'fadeIn 0.3s ease' }}>

      {/* Back */}
      <button onClick={() => router.push('/workforce')} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer', marginBottom: '24px', padding: 0 }}>
        ← Back to Workforce
      </button>

      {/* Employee Header */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px', boxShadow: 'var(--shadow)', padding: '28px 32px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '24px' }}>

          {/* Avatar */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '80px', height: '80px', borderRadius: '20px', overflow: 'hidden', border: `2px solid ${employee.color}30`, boxShadow: `0 4px 16px ${employee.color}20` }}>
              <EmployeeAvatar id={employee.id} size={80} />
            </div>
          </div>

          {/* Info */}
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
              <h1 style={{ fontSize: '28px', fontWeight: '800', color: 'var(--text-primary)' }}>{employee.name}</h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div className={`status-${employee.status}`} style={{ width: '7px', height: '7px', borderRadius: '50%' }} />
                <span style={{ fontSize: '12px', color: employee.status === 'active' ? 'var(--green)' : 'var(--amber)', textTransform: 'capitalize', fontWeight: '600' }}>{employee.status}</span>
              </div>
            </div>
            <p style={{ fontSize: '14px', color: employee.color, fontWeight: '600', marginBottom: '10px' }}>{employee.role}</p>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: '600px', marginBottom: '16px' }}>{employee.bio}</p>
            <div style={{ display: 'flex', gap: '24px' }}>
              <div><p style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Active Tasks</p><p style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)', fontFamily: 'var(--font-geist-mono)' }}>{stat.activeTasks}</p></div>
              <div><p style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Completed</p><p style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)', fontFamily: 'var(--font-geist-mono)' }}>{stat.completedTasks}</p></div>
              <div><p style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Current Task</p><p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{stat.currentTask}</p></div>
            </div>
          </div>

          {/* KPIs — real, from this company's data */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', minWidth: '160px' }}>
            {stat.kpis.map(kpi => (
              <div key={kpi.label} style={{ background: 'var(--surface)', borderRadius: '10px', padding: '10px 14px', border: '1px solid var(--border)' }}>
                <p style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '4px' }}>{kpi.label}</p>
                <span style={{ fontSize: '18px', fontWeight: '800', color: kpi.value === 0 ? 'var(--text-dim)' : employee.color, fontFamily: 'var(--font-geist-mono)' }}>{kpi.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px', boxShadow: 'var(--shadow)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', padding: '0 24px' }}>
          {(['chat', 'tasks', 'activity', 'responsibilities'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              padding: '14px 16px', border: 'none', background: 'transparent', cursor: 'pointer',
              fontSize: '13px', fontWeight: activeTab === tab ? '700' : '400',
              color: activeTab === tab ? employee.color : 'var(--text-secondary)',
              borderBottom: activeTab === tab ? `2px solid ${employee.color}` : '2px solid transparent',
              marginBottom: '-1px', textTransform: 'capitalize',
            }}>{tab}</button>
          ))}
        </div>

        <div style={{ padding: '20px 24px' }}>

          {/* Chat Tab */}
          {activeTab === 'chat' && (
            <ChatPanel
              employeeId={employee.id}
              name={employee.name}
              color={employee.color}
              initialAsk={initialAsk}
              onAskConsumed={() => setInitialAsk(null)}
              working={empTasks.some(t => t.status === 'in_progress')}
            />
          )}

          {/* Tasks Tab */}
          {activeTab === 'tasks' && (
            <div>
              {empTasks.length === 0 ? (
                <p style={{ color: 'var(--text-dim)', fontSize: '13px' }}>No tasks assigned.</p>
              ) : empTasks.map(t => (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: priorityColors[t.priority], flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: '500' }}>{t.title}</p>
                    <p style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '2px' }}>{t.project} · Due {t.dueDate}</p>
                  </div>
                  <span style={{ fontSize: '11px', color: statusColors[t.status], background: statusColors[t.status] + '20', padding: '3px 10px', borderRadius: '999px', fontWeight: '600', textTransform: 'capitalize', whiteSpace: 'nowrap' }}>
                    {t.status.replace('_', ' ')}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Activity Tab */}
          {activeTab === 'activity' && (
            <div>
              {empActivity.length === 0 ? (
                <p style={{ color: 'var(--text-dim)', fontSize: '13px' }}>No activity yet.</p>
              ) : empActivity.map((a, i) => (
                <div key={a.id} style={{ display: 'flex', gap: '14px', padding: '12px 0', borderBottom: i < empActivity.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', overflow: 'hidden', flexShrink: 0, marginTop: '1px' }}><EmployeeAvatar id={employee.id} size={28} /></div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{a.action}</p>
                    {a.detail && <p style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '2px' }}>{a.detail}</p>}
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--text-dim)', flexShrink: 0 }}>{a.timestamp}</span>
                </div>
              ))}
            </div>
          )}

          {/* Responsibilities Tab */}
          {activeTab === 'responsibilities' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {employee.responsibilities.map((r, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '12px 14px', background: 'var(--surface)', borderRadius: '10px', border: '1px solid var(--border)' }}>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: employee.color, marginTop: '5px', flexShrink: 0 }} />
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{r}</p>
                </div>
              ))}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
