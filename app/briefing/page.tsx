'use client';

import { useEffect, useState } from 'react';
import { getCompanyProfile, getTasks, getDashboardStats, type DashboardStats } from '@/lib/data';
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

const highlights = [
  { emp: 'Aria', color: '#a78bfa', win: 'Booked 28 discovery calls — 22% above target. Fintech segment responding best to the direct email sequence.' },
  { emp: 'Nova', color: '#34d399', win: 'Published 31 pieces of content. Organic traffic up 24% MoM. The SEO keyword cluster is gaining traction.' },
  { emp: 'Opus', color: '#60a5fa', win: 'Saved 47 hours of manual work. Onboarding SOP v2 is complete and ready for review.' },
];

const attentionItems = [
  { label: 'No email sequence scheduled for the SMB segment', priority: 'high', owner: 'Aria' },
  { label: 'September editorial calendar needs your sign-off before Nova publishes', priority: 'medium', owner: 'Nova' },
  { label: '3 inbox threads flagged as urgent — waiting on your reply', priority: 'high', owner: 'Opus' },
];

const planned = [
  { emp: 'Aria', color: '#a78bfa', task: 'Launch SMB outreach sequence — 50 prospects targeted' },
  { emp: 'Nova', color: '#34d399', task: 'Publish September content calendar + 4 LinkedIn posts' },
  { emp: 'Opus', color: '#60a5fa', task: 'Weekly performance report + inbox triage' },
];

export default function BriefingPage() {
  const [companyName, setCompanyName] = useState('Your Company');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [completedCount, setCompletedCount] = useState(0);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [p, ds, tks] = await Promise.all([getCompanyProfile(), getDashboardStats(), getTasks()]);
      if (cancelled) return;
      if (p?.companyName) setCompanyName(p.companyName);
      setStats(ds);
      setCompletedCount(tks.filter(t => t.status === 'completed').length);
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div style={{ padding: '32px 36px', maxWidth: '800px', animation: 'fadeIn 0.3s ease' }}>

      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: '800', color: '#fff' }}>S</div>
          <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-dim)', letterSpacing: '0.5px' }}>SURGE — WEEKLY CEO BRIEFING</span>
        </div>
        <h1 style={{ fontSize: '28px', fontWeight: '800', color: 'var(--text-primary)', lineHeight: 1.2, marginBottom: '6px' }}>
          Good morning, Mitri.
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
          Week of {weekDates.start} – {weekDates.end} · {companyName}
        </p>
      </div>

      {/* Score banner */}
      <div style={{ background: 'var(--accent)', borderRadius: '16px', padding: '20px 28px', marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>Workforce Performance Score</p>
          <p style={{ fontSize: '42px', fontWeight: '800', color: '#fff', fontFamily: 'var(--font-geist-mono)', lineHeight: 1 }}>{stats?.workforceScore ?? 0}</p>
          <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.8)', marginTop: '4px' }}>Up 4 points from last week. Best score since launch.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', textAlign: 'right' }}>
          {[
            { label: 'Tasks Completed', value: completedCount },
            { label: 'Hours Saved', value: stats ? `${stats.hoursSaved}h` : '—' },
            { label: 'Meetings Booked', value: stats?.meetingsBooked ?? 0 },
            { label: 'Leads Generated', value: stats?.leadsGenerated ?? 0 },
          ].map(s => (
            <div key={s.label}>
              <p style={{ fontSize: '22px', fontWeight: '800', color: '#fff', fontFamily: 'var(--font-geist-mono)' }}>{s.value}</p>
              <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* What your team accomplished */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px', boxShadow: 'var(--shadow)', overflow: 'hidden', marginBottom: '16px' }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
          <h2 style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>What Your Team Accomplished</h2>
        </div>
        <div style={{ padding: '8px 0' }}>
          {highlights.map((h, i) => (
            <div key={h.emp} style={{ display: 'flex', gap: '14px', padding: '16px 24px', borderBottom: i < highlights.length - 1 ? '1px solid var(--border)' : 'none', alignItems: 'flex-start' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', overflow: 'hidden', flexShrink: 0, border: `1px solid ${h.color}20` }}>
                <EmployeeAvatar id={h.emp.toLowerCase()} size={36} />
              </div>
              <div>
                <p style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '3px' }}>{h.emp}</p>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{h.win}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Needs your attention */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px', boxShadow: 'var(--shadow)', overflow: 'hidden', marginBottom: '16px' }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
          <h2 style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Needs Your Attention</h2>
        </div>
        <div style={{ padding: '8px 0' }}>
          {attentionItems.map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 24px', borderBottom: i < attentionItems.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: item.priority === 'high' ? 'var(--red)' : 'var(--amber)', flexShrink: 0 }} />
              <p style={{ flex: 1, fontSize: '13px', color: 'var(--text-secondary)' }}>{item.label}</p>
              <span style={{ fontSize: '11px', color: 'var(--text-dim)', background: 'var(--bg)', border: '1px solid var(--border)', padding: '2px 10px', borderRadius: '999px', flexShrink: 0 }}>{item.owner}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Planned this week */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px', boxShadow: 'var(--shadow)', overflow: 'hidden', marginBottom: '16px' }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
          <h2 style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Planned This Week</h2>
        </div>
        <div style={{ padding: '8px 0' }}>
          {planned.map((p, i) => (
            <div key={p.emp} style={{ display: 'flex', gap: '14px', padding: '14px 24px', borderBottom: i < planned.length - 1 ? '1px solid var(--border)' : 'none', alignItems: 'center' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '8px', overflow: 'hidden', flexShrink: 0 }}>
                <EmployeeAvatar id={p.emp.toLowerCase()} size={28} />
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{p.emp}</span> — {p.task}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div style={{ textAlign: 'center', padding: '20px 0' }}>
        <p style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
          Sent every Monday at 8:00 AM · Surge AI Workforce Platform
        </p>
      </div>
    </div>
  );
}
