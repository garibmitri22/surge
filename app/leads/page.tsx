'use client';

import { useEffect, useState } from 'react';
import { getLeads, getDrafts, type Lead, type LeadDraft } from '@/lib/leads';

const VERTICAL_LABEL: Record<string, string> = { med_spa: 'Med Spa', real_estate: 'Real Estate', gym: 'Gym', other: 'Other' };
const STATUS_COLOR: Record<string, string> = {
  new: '#9ca3af', qualified: '#6366f1', drafted: '#8b5cf6', contacted: '#0891b2',
  replied: '#16a34a', meeting: '#16a34a', disqualified: '#9ca3af', recycled: '#d97706',
};

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [drafts, setDrafts] = useState<LeadDraft[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [vFilter, setVFilter] = useState('all');
  const [sFilter, setSFilter] = useState('all');
  const [expanded, setExpanded] = useState<string | null>(null);

  const [overdueCount, setOverdueCount] = useState(0);
  const [nowTs, setNowTs] = useState(0); // load-time clock; keeps Date.now() out of render
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [l, d] = await Promise.all([getLeads(), getDrafts()]);
      if (cancelled) return;
      const now = Date.now();
      setLeads(l); setDrafts(d); setLoaded(true); setNowTs(now);
      setOverdueCount(l.filter((x) => new Date(x.nextActionAt).getTime() < now && !['disqualified', 'meeting', 'recycled'].includes(x.status)).length);
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = leads.filter((l) => (vFilter === 'all' || l.vertical === vFilter) && (sFilter === 'all' || l.status === sFilter));

  const [notes, setNotes] = useState<Record<string, string>>({});
  // Approve = consent to send. The server attempts delivery (warmup + CAN-SPAM +
  // suppression gated) and tells us what happened (sent / queued / why-not).
  async function decide(id: string, action: 'approve' | 'reject') {
    setDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, approvalStatus: action === 'approve' ? 'approved' : 'rejected' } : d)));
    try {
      const res = await fetch('/api/leads/approve', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draftId: id, action }),
      });
      const r = await res.json().catch(() => ({}));
      if (r.status) setDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, approvalStatus: r.status } : d)));
      if (r.message) setNotes((prev) => ({ ...prev, [id]: r.message }));
    } catch {
      setNotes((prev) => ({ ...prev, [id]: 'Something went wrong — please try again.' }));
    }
  }

  return (
    <div className="page-pad" style={{ padding: '32px 36px', animation: 'fadeIn 0.3s ease' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: '800', color: 'var(--text-primary)' }}>Leads</h1>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Aria&apos;s pipeline — real businesses, scored and ranked.{' '}
            {overdueCount > 0 && <span style={{ color: 'var(--red)', fontWeight: '600' }}>{overdueCount} overdue action{overdueCount > 1 ? 's' : ''}.</span>}
          </p>
        </div>
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '12px 18px', textAlign: 'right' }}>
          <p style={{ fontSize: '24px', fontWeight: '800', color: 'var(--accent)', fontFamily: 'var(--font-geist-mono)', lineHeight: 1 }}>{leads.length}</p>
          <p style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.6px', marginTop: '4px' }}>In pipeline</p>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <FilterRow label="Vertical" value={vFilter} setValue={setVFilter} options={['all', 'med_spa', 'real_estate', 'gym', 'other']} fmt={(o) => (o === 'all' ? 'All' : VERTICAL_LABEL[o])} />
        <FilterRow label="Status" value={sFilter} setValue={setSFilter} options={['all', 'qualified', 'drafted', 'contacted', 'replied', 'meeting', 'disqualified']} fmt={(o) => (o === 'all' ? 'All' : o)} />
      </div>

      {loaded && leads.length === 0 ? (
        <div style={{ background: 'var(--card)', border: '1px dashed var(--border)', borderRadius: '16px', padding: '48px', textAlign: 'center' }}>
          <p style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '6px' }}>No leads yet</p>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '420px', margin: '0 auto', lineHeight: 1.5 }}>
            Give Aria a prospecting task on the Tasks page, then hit <strong>Run</strong>. She researches real businesses, scores them, and they show up here ranked.
          </p>
        </div>
      ) : (
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px', boxShadow: 'var(--shadow)', overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px 90px 110px 1.4fr', gap: '12px', padding: '12px 20px', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
            {['Business', 'Vertical', 'Score', 'Status', 'Next action'].map((h) => (
              <p key={h} style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: '700' }}>{h}</p>
            ))}
          </div>
          {filtered.length === 0 ? (
            <p style={{ padding: '32px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '13px' }}>No leads match these filters.</p>
          ) : filtered.map((l) => {
            const overdue = nowTs > 0 && new Date(l.nextActionAt).getTime() < nowTs && l.status !== 'disqualified' && l.status !== 'meeting';
            const open = expanded === l.id;
            const leadDrafts = drafts.filter((d) => d.leadId === l.id);
            return (
              <div key={l.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <div
                  onClick={() => setExpanded(open ? null : l.id)}
                  className="table-row"
                  style={{ display: 'grid', gridTemplateColumns: '1fr 110px 90px 110px 1.4fr', gap: '12px', padding: '14px 20px', alignItems: 'center', cursor: 'pointer' }}
                >
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.businessName}</p>
                    <p style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{l.location || '—'}</p>
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{VERTICAL_LABEL[l.vertical] || l.vertical}</span>
                  <span style={{ fontSize: '15px', fontWeight: '800', color: 'var(--accent)', fontFamily: 'var(--font-geist-mono)' }}>{l.score}</span>
                  <span style={{ fontSize: '11px', color: STATUS_COLOR[l.status] || 'var(--text-dim)', background: (STATUS_COLOR[l.status] || '#9ca3af') + '18', padding: '3px 8px', borderRadius: '999px', fontWeight: '600', textTransform: 'capitalize', justifySelf: 'start' }}>{l.status}</span>
                  <span style={{ fontSize: '12px', color: overdue ? 'var(--red)' : 'var(--text-secondary)', fontWeight: overdue ? '600' : '400' }}>
                    {l.nextAction} <span style={{ color: overdue ? 'var(--red)' : 'var(--text-dim)' }}>· {l.nextActionAt?.slice(0, 10)}{overdue ? ' (overdue)' : ''}</span>
                  </span>
                </div>
                {open && (
                  <div style={{ padding: '4px 20px 18px', background: 'var(--bg)', animation: 'fadeIn 0.2s ease' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', margin: '12px 0' }}>
                      {(['icp_fit', 'pain', 'ability', 'reachability'] as const).map((k) => {
                        const p = l.scoreReasons?.[k];
                        return (
                          <div key={k} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '10px', padding: '10px 12px' }}>
                            <p style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{k.replace('_', ' ')} <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{p ? p.points : '–'}</span></p>
                            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: 1.4 }}>{p?.reason || '—'}</p>
                          </div>
                        );
                      })}
                    </div>
                    {l.website && <a href={l.website.startsWith('http') ? l.website : `https://${l.website}`} target="_blank" rel="noreferrer" style={{ fontSize: '12px', color: 'var(--accent)', marginRight: '14px' }}>Website ↗</a>}
                    {l.sourceUrl && <a href={l.sourceUrl} target="_blank" rel="noreferrer" style={{ fontSize: '12px', color: 'var(--text-dim)' }}>Source ↗</a>}

                    {leadDrafts.length > 0 && (
                      <div style={{ marginTop: '14px' }}>
                        <p style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '8px' }}>Email drafts</p>
                        {leadDrafts.map((d) => (
                          <div key={d.id} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '10px', padding: '12px 14px', marginBottom: '8px' }}>
                            <p style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)' }}>Step {d.sequenceStep}: {d.subject}</p>
                            <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', margin: '6px 0 10px', lineHeight: 1.5 }}>{d.body}</p>
                            {d.approvalStatus === 'pending' ? (
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <button onClick={() => decide(d.id, 'approve')} className="btn-primary" style={{ padding: '6px 14px', fontSize: '12px' }}>Approve &amp; send</button>
                                <button onClick={() => decide(d.id, 'reject')} className="btn-ghost" style={{ padding: '6px 14px', fontSize: '12px' }}>Reject</button>
                              </div>
                            ) : (
                              <span style={{ fontSize: '11px', color: d.approvalStatus === 'sent' ? 'var(--green)' : d.approvalStatus === 'approved' ? 'var(--amber)' : 'var(--text-dim)', fontWeight: '600', textTransform: 'capitalize' }}>
                                {d.approvalStatus === 'sent' ? 'Sent ✓' : d.approvalStatus}
                              </span>
                            )}
                            {notes[d.id] && <p style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '6px', lineHeight: 1.5 }}>{notes[d.id]}</p>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FilterRow({ label, value, setValue, options, fmt }: { label: string; value: string; setValue: (v: string) => void; options: string[]; fmt: (o: string) => string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <span style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.6px', marginRight: '2px' }}>{label}</span>
      {options.map((o) => (
        <button key={o} onClick={() => setValue(o)} style={{
          padding: '5px 12px', borderRadius: '7px', border: 'none', cursor: 'pointer', fontSize: '12px',
          fontWeight: value === o ? '700' : '400', textTransform: 'capitalize',
          background: value === o ? 'var(--accent)' : 'var(--card)', color: value === o ? '#fff' : 'var(--text-secondary)',
          borderColor: 'var(--border)',
        }}>{fmt(o)}</button>
      ))}
    </div>
  );
}
