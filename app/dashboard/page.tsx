'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getEmployees, getActivity, getTasks, getWorkforceStats, getWorkforceScore, getEmployeeStats, emptyEmployeeStat, getCompanyProfile, getUserDisplay, type WorkforceStats, type WorkforceScore, type EmployeeStat } from '@/lib/data';
import type { Employee, ActivityItem, Task } from '@/lib/mockData';
import { EmployeeAvatar } from '@/components/EmployeeAvatar';
import { AtlasBrief } from '@/components/AtlasBrief';
import { HoursWidget } from '@/components/HoursWidget';
import { DEPARTMENTS } from '@/lib/departments.mjs';

const empColors: Record<string, string> = { aria: '#a78bfa', nova: '#34d399', opus: '#60a5fa', atlas: '#f59e0b' };

// What each teammate actually does — outcome language, not vibes (CEO reframe).
const empDesc: Record<string, string> = {
  aria: 'Finds and ranks new leads, drafts personalized outreach, and follows up automatically — so no prospect slips through.',
  nova: 'Creates on-brand social posts, content, and campaign ideas you approve in one click.',
  opus: 'Organizes tasks, prepares meeting briefs, and keeps every follow-up on track.',
  atlas: 'Runs your morning briefing, routes work across the team, and flags what needs your decision.',
};

function ScoreRing({ score }: { score: number }) {
  const [drawn, setDrawn] = useState(false);
  const r = 54;
  const circ = 2 * Math.PI * r;
  const offset = circ - (drawn ? score / 100 : 0) * circ;
  // Recalibrated so an early, real account reads as "building," not a red failing grade:
  // green when strong, amber mid, indigo (accent) while building — never red.
  const color = score >= 70 ? '#22c55e' : score >= 40 ? '#f59e0b' : '#6366f1';
  useEffect(() => { const t = setTimeout(() => setDrawn(true), 150); return () => clearTimeout(t); }, []);
  return (
    <svg width="130" height="130" viewBox="0 0 130 130">
      <circle cx="65" cy="65" r={r} fill="none" stroke="var(--border)" strokeWidth="8" />
      <circle cx="65" cy="65" r={r} fill="none" stroke={color} strokeWidth="8"
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        transform="rotate(-90 65 65)" style={{ transition: 'stroke-dashoffset 1.2s ease' }} />
      <text x="65" y="60" textAnchor="middle" fill={color} fontSize="30" fontWeight="800" fontFamily="var(--font-geist-mono)">{score}</text>
      <text x="65" y="78" textAnchor="middle" fill="var(--text-dim)" fontSize="9" letterSpacing="1">PERFORMANCE</text>
    </svg>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const [tickIndex, setTickIndex] = useState(0);
  const [companyName, setCompanyName] = useState('');
  const [userFirst, setUserFirst] = useState('there');
  const [greeting] = useState(() => {
    const h = new Date().getHours();
    return h >= 17 ? 'Good evening' : h >= 12 ? 'Good afternoon' : 'Good morning';
  });
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [activityLog, setActivityLog] = useState<ActivityItem[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [stats, setStats] = useState<WorkforceStats | null>(null);
  const [score, setScore] = useState<WorkforceScore | null>(null);
  const [empStats, setEmpStats] = useState<Record<string, EmployeeStat>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [emps, acts, tks, ws, sc, es, profile, who] = await Promise.all([
        getEmployees(), getActivity(), getTasks(), getWorkforceStats(), getWorkforceScore(), getEmployeeStats(), getCompanyProfile(), getUserDisplay(),
      ]);
      if (cancelled) return;
      setEmployees(emps);
      setActivityLog(acts);
      setTasks(tks);
      setStats(ws);
      setScore(sc);
      setEmpStats(es);
      setUserFirst(who.firstName);
      if (profile?.companyName) setCompanyName(profile.companyName);
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (activityLog.length === 0) return;
    const t = setInterval(() => setTickIndex(i => (i + 1) % activityLog.length), 3500);
    return () => clearInterval(t);
  }, [activityLog.length]);

  // Proactive heartbeat: once a day, when the owner opens the app, run the Lead
  // Lifeline sweep (overdue -> recovery task, dead leads recycled). If it changed
  // anything, refresh the surfaces that show it. Idempotent server-side too.
  const sweptRef = useRef(false);
  useEffect(() => {
    if (sweptRef.current) return;
    sweptRef.current = true;
    const key = `surge-heartbeat-${new Date().toISOString().slice(0, 10)}`;
    if (typeof window === 'undefined' || localStorage.getItem(key)) return;
    (async () => {
      try {
        const res = await fetch('/api/heartbeat', { method: 'POST' });
        const r = await res.json().catch(() => ({}));
        localStorage.setItem(key, '1');
        if (r && (r.taskCreated || r.recycleCount)) {
          const [acts, tks, sc] = await Promise.all([getActivity(), getTasks(), getWorkforceScore()]);
          setActivityLog(acts); setTasks(tks); setScore(sc);
        }
      } catch { /* heartbeat is best-effort */ }
    })();
  }, []);

  const fresh = stats !== null && !stats.hasActivity;

  const currentTick = activityLog[tickIndex];
  const tickEmp = currentTick ? employees.find(e => e.id === currentTick.employeeId) : undefined;
  const recentTasks = tasks.filter(t => t.status === 'in_progress').slice(0, 3);

  return (
    <div className="page-pad" style={{ padding: '32px 36px', minHeight: '100vh', animation: 'fadeIn 0.3s ease' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '28px' }}>
        <div>
          <p suppressHydrationWarning style={{ fontSize: '12px', color: 'var(--text-dim)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '6px' }}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
          <h1 suppressHydrationWarning style={{ fontSize: '26px', fontWeight: '800', color: 'var(--text-primary)', lineHeight: 1.2 }}>
            {greeting}, {userFirst}.{companyName && <span style={{ color: 'var(--accent)' }}> {companyName}</span>} HQ
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '6px', maxWidth: '640px', lineHeight: 1.5 }}>
            Your AI workforce is finding leads, drafting outreach, and following up with prospects — around the clock.{' '}
            <span style={{ color: 'var(--green)', fontWeight: '600' }}>
              {employees.filter(e => e.status === 'active').length} online
            </span>{' '}
            now.
          </p>
        </div>
        <button onClick={() => router.push('/hire')} style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '10px', padding: '10px 20px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap' }}>
          + Hire Employee
        </button>
      </div>

      {/* Results — the hero. Real, verifiable counts (never invented $/ROI). */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }} className="results-hero">
        {[
          { label: 'Leads Found', value: stats?.leadsFound ?? 0, color: '#ec4899' },
          { label: 'Qualified', value: stats?.qualifiedLeads ?? 0, color: '#a78bfa' },
          { label: 'Outreach Drafted', value: stats?.pendingDrafts ?? 0, color: '#f59e0b' },
          { label: 'Meetings Booked', value: stats?.meetingsBooked ?? 0, color: '#60a5fa' },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '14px', boxShadow: 'var(--shadow)', padding: '18px 20px' }}>
            <p style={{ fontSize: '34px', fontWeight: '800', color: s.value === 0 ? 'var(--text-dim)' : s.color, fontFamily: 'var(--font-geist-mono)', lineHeight: 1 }}>{s.value}</p>
            <p style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.6px', marginTop: '8px', fontWeight: 600 }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Atlas — Chief of Staff: the dashboard centerpiece (brief + his input) */}
      <AtlasBrief />

      {/* Team hours fuel gauge (hidden until the hours migration is applied) */}
      <HoursWidget />

      {/* Live Ticker — real activity, honest empty state */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '10px', padding: '11px 20px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: currentTick ? 'var(--green)' : 'var(--text-dim)', flexShrink: 0, animation: currentTick ? 'pulse-green 2s infinite' : 'none' }} />
        <span style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '1px', flexShrink: 0 }}>Live</span>
        <p key={tickIndex} style={{ flex: 1, fontSize: '13px', color: 'var(--text-secondary)', animation: 'fadeIn 0.5s ease', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {currentTick ? (
            <>
              <span style={{ color: empColors[currentTick.employeeId] || '#6366f1', fontWeight: '600' }}>{tickEmp?.name}</span>
              {` — ${currentTick.action}`}
            </>
          ) : 'No activity yet. Give your team a directive and their work shows up here in real time.'}
        </p>
        {currentTick && <span style={{ fontSize: '11px', color: 'var(--text-dim)', flexShrink: 0 }}>{currentTick.timestamp}</span>}
      </div>

      {/* Main grid */}
      <div className="grid-side" style={{ marginBottom: '20px' }}>

        {/* Workforce Score — real number from real data, or an honest "getting started" */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px', boxShadow: 'var(--shadow)', padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
            {score?.score != null ? <ScoreRing score={score.score} /> : (
              <div style={{ width: '130px', height: '130px', borderRadius: '50%', border: '8px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: '40px', fontWeight: '800', color: 'var(--text-dim)', fontFamily: 'var(--font-geist-mono)' }}>—</span>
              </div>
            )}
            <p style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>Team Health</p>
            <p style={{ fontSize: '11px', color: 'var(--text-dim)', textAlign: 'center', lineHeight: 1.5 }}>
              {score?.score != null ? 'Building — climbs as your team books meetings.' : 'Unlocks once your team has real work to measure.'}
            </p>
          </div>

          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '14px', boxShadow: 'var(--shadow)', padding: '16px 18px' }}>
            <p style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>Score Breakdown</p>
            {score?.score != null && score.components.length > 0 ? (
              score.components.map(c => (
                <div key={c.key} style={{ marginBottom: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{c.label}</span>
                    <span style={{ fontSize: '11px', color: 'var(--accent)', fontFamily: 'var(--font-geist-mono)', fontWeight: '700' }}>{c.value}</span>
                  </div>
                  <div style={{ height: '3px', background: 'var(--border)', borderRadius: '999px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: 'var(--accent)', borderRadius: '999px', width: `${c.value}%`, transition: 'width 1s ease' }} />
                  </div>
                </div>
              ))
            ) : (
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                Once your team logs real work, the score breaks down task execution, pipeline, and momentum here.
              </p>
            )}
          </div>
        </div>

        {/* Active Tasks (the verifiable results live in the hero row up top) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {fresh && (
            <div style={{ background: 'var(--accent-dim)', border: '1px solid var(--border)', borderRadius: '10px', padding: '10px 16px' }}>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                These start at zero on purpose. The moment Aria runs a prospecting task or Nova ships content, real numbers land here. Ask Atlas to get the team moving.
              </p>
            </div>
          )}

          {/* Active tasks quick view */}
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '14px', boxShadow: 'var(--shadow)', overflow: 'hidden', flex: 1 }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Active Tasks</p>
              <button onClick={() => router.push('/tasks')} style={{ fontSize: '11px', color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: '600' }}>View all →</button>
            </div>
            {recentTasks.length === 0 ? (
              <div style={{ padding: '18px', textAlign: 'center' }}>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>No tasks in progress yet.</p>
                <p style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '2px' }}>Assign one below and your team gets to work.</p>
              </div>
            ) : recentTasks.map((t, i) => {
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
      <div className="grid-half">

        {/* Workforce Status */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px', boxShadow: 'var(--shadow)', overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Your Company</p>
            <button onClick={() => router.push('/workforce')} style={{ fontSize: '11px', color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: '600' }}>View all →</button>
          </div>
          {DEPARTMENTS.map(dept => {
            const members = dept.employeeIds.map(id => employees.find(e => e.id === id)).filter(Boolean) as Employee[];
            if (members.length === 0) return null;
            return (
              <div key={dept.id}>
                <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.8px', padding: '10px 20px 4px', background: 'var(--bg)' }}>{dept.name}</p>
                {members.map(e => {
                  const st = empStats[e.id] ?? emptyEmployeeStat();
                  const idle = st.activeTasks === 0;
                  return (
                  <div key={e.id} onClick={() => router.push(`/workforce/${e.id}`)} className="table-row" style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', gap: '14px', cursor: 'pointer' }}>
                    <div style={{ width: '34px', height: '34px', borderRadius: '10px', overflow: 'hidden', flexShrink: 0, border: `1px solid ${e.color}20` }}><EmployeeAvatar id={e.id} size={34} /></div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                        <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>{e.name}</span>
                        <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>{e.role}</span>
                      </div>
                      {empDesc[e.id] && <p style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.45, marginBottom: '3px' }}>{empDesc[e.id]}</p>}
                      <p style={{ fontSize: '11px', color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {idle ? 'Ready for work — give the team a directive' : <><span style={{ fontWeight: 600 }}>Working on:</span> {st.currentTask}</>}
                      </p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0, marginTop: '2px' }}>
                      <div className={`status-${e.status}`} style={{ width: '7px', height: '7px', borderRadius: '50%' }} />
                      <span style={{ fontSize: '10px', color: e.status === 'active' ? 'var(--green)' : e.status === 'idle' ? 'var(--amber)' : 'var(--text-dim)', textTransform: 'capitalize' }}>{e.status}</span>
                    </div>
                  </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Activity Feed — real, honest empty state */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px', boxShadow: 'var(--shadow)', overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
            <p style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Activity Feed</p>
          </div>
          {activityLog.length === 0 ? (
            <div style={{ padding: '28px 20px', textAlign: 'center' }}>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>Nothing logged yet.</p>
              <p style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '2px' }}>Every action your team takes will appear here as it happens.</p>
            </div>
          ) : (
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
          )}
        </div>
      </div>
    </div>
  );
}
