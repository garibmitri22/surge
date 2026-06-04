'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getEmployees, getActivity, getTasks, getDashboardStats, getCompanyProfile, type DashboardStats } from '@/lib/data';
import type { Employee, ActivityItem, Task } from '@/lib/mockData';
import { EmployeeAvatar } from '@/components/EmployeeAvatar';

function ScoreRing({ score }: { score: number }) {
  const [drawn, setDrawn] = useState(false);
  const r = 54;
  const circ = 2 * Math.PI * r;
  const offset = circ - (drawn ? score / 100 : 0) * circ;
  const color = score >= 80 ? '#6366f1' : score >= 60 ? '#eab308' : '#ef4444';
  useEffect(() => { setTimeout(() => setDrawn(true), 150); }, []);
  return (
    <svg width="130" height="130" viewBox="0 0 130 130">
      <circle cx="65" cy="65" r={r} fill="none" stroke="#e5e7eb" strokeWidth="8" />
      <circle cx="65" cy="65" r={r} fill="none" stroke={color} strokeWidth="8"
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        transform="rotate(-90 65 65)" style={{ transition: 'stroke-dashoffset 1.2s ease' }} />
      <text x="65" y="60" textAnchor="middle" fill={color} fontSize="28" fontWeight="800" fontFamily="var(--font-geist-mono)">{score}</text>
      <text x="65" y="76" textAnchor="middle" fill="#9ca3af" fontSize="9" fontFamily="var(--font-geist-sans)" letterSpacing="1">PERFORMANCE</text>
    </svg>
  );
}

const empColors: Record<string, string> = { aria: '#a78bfa', nova: '#34d399', opus: '#60a5fa' };

const scoreBreakdown = [
  { label: 'Task Completion', score: 91, weight: '30%' },
  { label: 'Lead Generation', score: 87, weight: '25%' },
  { label: 'Content Output', score: 84, weight: '20%' },
  { label: 'Response Speed', score: 79, weight: '15%' },
  { label: 'Data Accuracy', score: 88, weight: '10%' },
];

export default function Dashboard() {
  const router = useRouter();
  const [tickIndex, setTickIndex] = useState(0);
  const [companyName, setCompanyName] = useState('');
  const [greeting, setGreeting] = useState('Good morning');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [activityLog, setActivityLog] = useState<ActivityItem[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [emps, acts, tks, ds, profile] = await Promise.all([
        getEmployees(), getActivity(), getTasks(), getDashboardStats(), getCompanyProfile(),
      ]);
      if (cancelled) return;
      setEmployees(emps);
      setActivityLog(acts);
      setTasks(tks);
      setDashboardStats(ds);
      if (profile?.companyName) setCompanyName(profile.companyName);
    })();
    const h = new Date().getHours();
    if (h >= 12 && h < 17) setGreeting('Good afternoon');
    else if (h >= 17) setGreeting('Good evening');
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (activityLog.length === 0) return;
    const t = setInterval(() => setTickIndex(i => (i + 1) % activityLog.length), 3500);
    return () => clearInterval(t);
  }, [activityLog.length]);

  const stats = [
    { label: 'Active Tasks', value: dashboardStats?.activeTasks ?? 0, color: '#6366f1', icon: '◻' },
    { label: 'Revenue Influenced', value: dashboardStats?.revenueInfluenced ?? '—', color: '#34d399', icon: '◈' },
    { label: 'Hours Saved', value: dashboardStats ? `${dashboardStats.hoursSaved}h` : '—', color: '#60a5fa', icon: '⬡' },
    { label: 'Meetings Booked', value: dashboardStats?.meetingsBooked ?? 0, color: '#f59e0b', icon: '◎' },
    { label: 'Leads Generated', value: dashboardStats?.leadsGenerated ?? 0, color: '#ec4899', icon: '◌' },
    { label: 'Active Projects', value: dashboardStats?.activeProjects ?? 0, color: '#8b5cf6', icon: '◉' },
  ];

  const currentTick = activityLog[tickIndex];
  const tickEmp = currentTick ? employees.find(e => e.id === currentTick.employeeId) : undefined;
  const recentTasks = tasks.filter(t => t.status === 'in_progress').slice(0, 3);

  return (
    <div style={{ padding: '32px 36px', minHeight: '100vh', animation: 'fadeIn 0.3s ease' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '28px' }}>
        <div>
          <p style={{ fontSize: '12px', color: 'var(--text-dim)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '6px' }}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
          <h1 style={{ fontSize: '26px', fontWeight: '800', color: 'var(--text-primary)', lineHeight: 1.2 }}>
            {greeting}, Mitri.{companyName && <span style={{ color: 'var(--accent)' }}> {companyName}</span>} HQ
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '6px' }}>
            Your AI workforce is active.{' '}
            <span style={{ color: 'var(--green)', fontWeight: '600' }}>
              {employees.filter(e => e.status === 'active').length} online
            </span>{' '}
            right now.
          </p>
        </div>
        <button onClick={() => router.push('/workforce')} style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '10px', padding: '10px 20px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap' }}>
          + Hire Employee
        </button>
      </div>

      {/* Live Ticker */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '10px', padding: '11px 20px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--green)', flexShrink: 0, animation: 'pulse-green 2s infinite' }} />
        <span style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '1px', flexShrink: 0 }}>Live</span>
        <p key={tickIndex} style={{ flex: 1, fontSize: '13px', color: 'var(--text-secondary)', animation: 'fadeIn 0.5s ease', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          <span style={{ color: empColors[currentTick?.employeeId] || '#6366f1', fontWeight: '600' }}>{tickEmp?.name}</span>
          {currentTick ? ` — ${currentTick.action}` : ''}
        </p>
        <span style={{ fontSize: '11px', color: 'var(--text-dim)', flexShrink: 0 }}>{currentTick?.timestamp}</span>
      </div>

      {/* Main grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: '20px', marginBottom: '20px' }}>

        {/* Score + Breakdown */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px', boxShadow: 'var(--shadow)', padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
            <ScoreRing score={dashboardStats?.workforceScore ?? 0} />
            <p style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>Workforce Score</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '11px', color: 'var(--green)', fontWeight: '600' }}>▲ +4 pts</span>
              <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>vs last week</span>
            </div>
          </div>

          {/* Score breakdown */}
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '14px', boxShadow: 'var(--shadow)', padding: '16px 18px' }}>
            <p style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>Score Breakdown</p>
            {scoreBreakdown.map(b => (
              <div key={b.label} style={{ marginBottom: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{b.label}</span>
                  <span style={{ fontSize: '11px', color: 'var(--accent)', fontFamily: 'var(--font-geist-mono)', fontWeight: '700' }}>{b.score}</span>
                </div>
                <div style={{ height: '3px', background: 'var(--border)', borderRadius: '999px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: 'var(--accent)', borderRadius: '999px', width: `${b.score}%`, transition: 'width 1s ease' }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Stats + Active Tasks */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
            {stats.map(s => (
              <div key={s.label} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', boxShadow: 'var(--shadow)', padding: '16px 18px' }}>
                <p style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '8px' }}>{s.label}</p>
                <p style={{ fontSize: '26px', fontWeight: '800', color: s.color, fontFamily: 'var(--font-geist-mono)', lineHeight: 1 }}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Active tasks quick view */}
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '14px', boxShadow: 'var(--shadow)', overflow: 'hidden', flex: 1 }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Active Tasks</p>
              <button onClick={() => router.push('/tasks')} style={{ fontSize: '11px', color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: '600' }}>View all →</button>
            </div>
            {recentTasks.map((t, i) => {
              const emp = employees.find(e => e.id === t.assigneeId);
              return (
                <div key={t.id} style={{ padding: '12px 18px', borderBottom: i < recentTasks.length - 1 ? '1px solid var(--border)' : 'none', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#6366f1', flexShrink: 0 }} />
                  <p style={{ flex: 1, fontSize: '13px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</p>
                  {emp && (
                    <div style={{ width: '22px', height: '22px', borderRadius: '50%', overflow: 'hidden', flexShrink: 0 }}><EmployeeAvatar id={emp.id} size={22} /></div>
                  )}
                </div>
              );
            })}
            <div style={{ padding: '12px 18px' }}>
              <button onClick={() => router.push('/tasks')} style={{ width: '100%', background: 'var(--surface)', border: '1px dashed var(--border)', borderRadius: '8px', padding: '9px', color: 'var(--text-dim)', fontSize: '12px', cursor: 'pointer', fontWeight: '600' }}>
                + Assign a Task
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom: Workforce + Activity */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>

        {/* Workforce Status */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px', boxShadow: 'var(--shadow)', overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Workforce</p>
            <button onClick={() => router.push('/workforce')} style={{ fontSize: '11px', color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: '600' }}>View all →</button>
          </div>
          {employees.map(e => (
            <div key={e.id} onClick={() => router.push(`/workforce/${e.id}`)} style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '14px', cursor: 'pointer' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', overflow: 'hidden', flexShrink: 0, border: `1px solid ${e.color}20` }}><EmployeeAvatar id={e.id} size={36} /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                  <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>{e.name}</span>
                  <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>{e.role}</span>
                </div>
                <p style={{ fontSize: '11px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.currentTask}</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
                <div className={`status-${e.status}`} style={{ width: '7px', height: '7px', borderRadius: '50%' }} />
                <span style={{ fontSize: '10px', color: e.status === 'active' ? 'var(--green)' : e.status === 'idle' ? 'var(--amber)' : 'var(--text-dim)', textTransform: 'capitalize' }}>{e.status}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Activity Feed */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px', boxShadow: 'var(--shadow)', overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
            <p style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Activity Feed</p>
          </div>
          <div style={{ overflowY: 'auto', maxHeight: '340px' }}>
            {activityLog.map((item, i) => {
              const e = employees.find(x => x.id === item.employeeId);
              return (
                <div key={item.id} style={{ padding: '11px 20px', borderBottom: i < activityLog.length - 1 ? '1px solid var(--border)' : 'none', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <div style={{ width: '26px', height: '26px', borderRadius: '50%', overflow: 'hidden', flexShrink: 0, marginTop: '1px' }}>{e ? <EmployeeAvatar id={e.id} size={26} /> : <div style={{ width: 26, height: 26, background: '#e5e7eb', borderRadius: '50%' }} />}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>{item.action}</p>
                    {item.detail && <p style={{ fontSize: '10px', color: 'var(--text-dim)', marginTop: '2px' }}>{item.detail}</p>}
                  </div>
                  <span style={{ fontSize: '10px', color: 'var(--text-dim)', flexShrink: 0, marginTop: '2px', whiteSpace: 'nowrap' }}>{item.timestamp}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
