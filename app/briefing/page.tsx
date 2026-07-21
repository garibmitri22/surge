'use client';

import { useEffect, useState } from 'react';
import { getCompanyProfile, getTasks, getActivity, getWorkforceStats, getWorkforceScore, getUserDisplay, type WorkforceStats, type WorkforceScore } from '@/lib/data';
import { getLeads, getDrafts } from '@/lib/leads';
import type { Task, ActivityItem } from '@/lib/mockData';
import { EmployeeAvatar } from '@/components/EmployeeAvatar';

const weekDates = (() => {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1) - 7);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    start: monday.toLocaleDateString('en-US', { month: 'long', day: 'numeric' }),
    end: sunday.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
  };
})();

interface AttentionItem { label: string; priority: 'high' | 'medium'; owner: string }

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px', boxShadow: 'var(--shadow)', overflow: 'hidden', marginBottom: '16px' }}>
      <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
        <h2 style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{title}</h2>
      </div>
      <div style={{ padding: '8px 0' }}>{children}</div>
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return <p style={{ fontSize: '13px', color: 'var(--text-dim)', padding: '14px 24px', lineHeight: 1.5 }}>{text}</p>;
}

export default function BriefingPage() {
  const [companyName, setCompanyName] = useState('Your Company');
  const [stats, setStats] = useState<WorkforceStats | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [attention, setAttention] = useState<AttentionItem[]>([]);
  const [score, setScore] = useState<WorkforceScore | null>(null);
  const [userFirst, setUserFirst] = useState('there');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [p, ws, sc, tks, acts, leads, drafts, who] = await Promise.all([
        getCompanyProfile(), getWorkforceStats(), getWorkforceScore(), getTasks(), getActivity(), getLeads(), getDrafts(), getUserDisplay(),
      ]);
      if (cancelled) return;
      setUserFirst(who.firstName);
      if (p?.companyName) setCompanyName(p.companyName);
      setStats(ws);
      setScore(sc);
      setTasks(tks);
      setActivity(acts);

      // Attention items are computed from REAL signals only — never invented.
      const items: AttentionItem[] = [];
      const pending = drafts.filter(d => d.approvalStatus === 'pending').length;
      if (pending > 0) items.push({ label: `${pending} outreach draft${pending > 1 ? 's' : ''} waiting on your approval before anything sends`, priority: 'high', owner: 'Aria' });
      const now = Date.now();
      const overdue = leads.filter(l => new Date(l.nextActionAt).getTime() < now && l.status !== 'disqualified' && l.status !== 'meeting').length;
      if (overdue > 0) items.push({ label: `${overdue} lead${overdue > 1 ? 's have' : ' has'} an overdue next action`, priority: 'high', owner: 'Aria' });
      setAttention(items);
    })();
    return () => { cancelled = true; };
  }, []);

  const completed = tasks.filter(t => t.status === 'completed');
  const planned = tasks.filter(t => t.status === 'queued' || t.status === 'in_progress');
  // Accomplishments come from the real activity log (most recent first).
  const accomplishments = activity.slice(0, 6);

  const bannerStats = [
    { label: 'Tasks Completed', value: stats?.completedTasks ?? 0 },
    { label: 'Leads Found', value: stats?.leadsFound ?? 0 },
    { label: 'Qualified', value: stats?.qualifiedLeads ?? 0 },
    { label: 'Meetings Booked', value: stats?.meetingsBooked ?? 0 },
  ];

  return (
    <div className="page-pad" style={{ padding: '32px 36px', maxWidth: '800px', animation: 'fadeIn 0.3s ease' }}>

      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: '800', color: '#fff' }}>S</div>
          <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-dim)', letterSpacing: '0.5px' }}>SURGE — WEEKLY CEO BRIEFING</span>
        </div>
        <h1 style={{ fontSize: '28px', fontWeight: '800', color: 'var(--text-primary)', lineHeight: 1.2, marginBottom: '6px' }}>
          Good morning, {userFirst}.
        </h1>
        <p suppressHydrationWarning style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
          Week of {weekDates.start} – {weekDates.end} · {companyName}
        </p>
      </div>

      {/* Score banner — locked until the real score formula + first week of data */}
      <div style={{ background: 'var(--accent)', borderRadius: '16px', padding: '20px 28px', marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>Workforce Performance Score</p>
          <p style={{ fontSize: '42px', fontWeight: '800', color: '#fff', fontFamily: 'var(--font-geist-mono)', lineHeight: 1 }}>{score?.score != null ? score.score : '—'}</p>
          <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.8)', marginTop: '4px' }}>
            {score?.score != null ? 'Live, from your team’s real work this period.' : 'Your score unlocks after your team’s first week of real work.'}
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', textAlign: 'right' }}>
          {bannerStats.map(s => (
            <div key={s.label}>
              <p style={{ fontSize: '22px', fontWeight: '800', color: '#fff', fontFamily: 'var(--font-geist-mono)' }}>{s.value}</p>
              <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* What your team accomplished — real activity log */}
      <Section title="What Your Team Accomplished">
        {accomplishments.length === 0 ? (
          <EmptyRow text="Nothing logged this week yet. The moment your team completes real work, it shows up here — no placeholder wins." />
        ) : accomplishments.map((a, i) => {
          return (
            <div key={a.id} style={{ display: 'flex', gap: '14px', padding: '14px 24px', borderBottom: i < accomplishments.length - 1 ? '1px solid var(--border)' : 'none', alignItems: 'flex-start' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '9px', overflow: 'hidden', flexShrink: 0 }}>
                <EmployeeAvatar id={a.employeeId} size={32} />
              </div>
              <div>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{a.action}</p>
                {a.detail && <p style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '2px' }}>{a.detail}</p>}
              </div>
            </div>
          );
        })}
      </Section>

      {/* Needs your attention — real signals (pending drafts, overdue leads) */}
      <Section title="Needs Your Attention">
        {attention.length === 0 ? (
          <EmptyRow text="Nothing needs you right now. When a draft is waiting for approval or a lead goes overdue, it lands here." />
        ) : attention.map((item, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 24px', borderBottom: i < attention.length - 1 ? '1px solid var(--border)' : 'none' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: item.priority === 'high' ? 'var(--red)' : 'var(--amber)', flexShrink: 0 }} />
            <p style={{ flex: 1, fontSize: '13px', color: 'var(--text-secondary)' }}>{item.label}</p>
            <span style={{ fontSize: '11px', color: 'var(--text-dim)', background: 'var(--bg)', border: '1px solid var(--border)', padding: '2px 10px', borderRadius: '999px', flexShrink: 0 }}>{item.owner}</span>
          </div>
        ))}
      </Section>

      {/* Planned — real queued/in-progress tasks */}
      <Section title="Planned & In Progress">
        {planned.length === 0 ? (
          <EmptyRow text="No work scheduled yet. Assign a task or ask Atlas to get the team moving." />
        ) : planned.slice(0, 8).map((t, i) => (
          <div key={t.id} style={{ display: 'flex', gap: '14px', padding: '14px 24px', borderBottom: i < Math.min(planned.length, 8) - 1 ? '1px solid var(--border)' : 'none', alignItems: 'center' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '8px', overflow: 'hidden', flexShrink: 0 }}>
              <EmployeeAvatar id={t.assigneeId} size={28} />
            </div>
            <p style={{ flex: 1, fontSize: '13px', color: 'var(--text-secondary)' }}>{t.title}</p>
            <span style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'capitalize', flexShrink: 0 }}>{t.status.replace('_', ' ')}</span>
          </div>
        ))}
      </Section>

      {completed.length > 0 && (
        <p style={{ fontSize: '12px', color: 'var(--text-dim)', textAlign: 'center', padding: '4px 0 12px' }}>
          {completed.length} task{completed.length > 1 ? 's' : ''} completed all-time.
        </p>
      )}

      {/* Footer */}
      <div style={{ textAlign: 'center', padding: '20px 0' }}>
        <p style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
          Sent every Monday at 8:00 AM · Surge AI Workforce Platform
        </p>
      </div>
    </div>
  );
}
