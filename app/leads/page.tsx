'use client';

import { useEffect, useState } from 'react';
import { getLeads, getDrafts, getLeadMessages, callLeadNow, type Lead, type LeadDraft, type LeadMessage } from '@/lib/leads';

const VERTICAL_LABEL: Record<string, string> = { med_spa: 'Med Spa', real_estate: 'Real Estate', gym: 'Gym', other: 'Other' };
const STATUS_COLOR: Record<string, string> = {
  new: '#9ca3af', inbound: '#0d9488', engaged: '#0891b2', qualified: '#6366f1', drafted: '#8b5cf6', contacted: '#0891b2',
  warm: '#ea580c', replied: '#16a34a', meeting: '#16a34a', disqualified: '#9ca3af', recycled: '#d97706',
};
const fmtDate = (s: string | null) => (s ? new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '');

// Trust stamp: where a lead came from + how recently it was verified. Makes "7 leads"
// read as real, not demo. Derived from the real source/source_url — never invented.
function sourceLabel(l: Lead): string {
  if (l.origin === 'inbound') {
    return ({ surge_form: 'Web form', meta_lead_ads: 'Meta Ad', google_lead_form: 'Google Ad', click_to_call: 'Call' } as Record<string, string>)[l.source || ''] || 'Inbound';
  }
  const u = (l.sourceUrl || '').toLowerCase();
  if (/google|maps|g\.co/.test(u)) return 'Google Maps';
  if (/linkedin/.test(u)) return 'LinkedIn';
  if (/facebook|instagram|fb\.com/.test(u)) return 'Social';
  if (/yelp/.test(u)) return 'Yelp';
  return u ? 'Website' : 'Research';
}
function agoLabel(iso: string, nowTs: number): string {
  if (!iso || !nowTs) return '';
  const ms = nowTs - new Date(iso).getTime();
  if (ms < 0) return 'just now';
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// Speed-to-lead: human time from capture → first outbound touch.
function timeToFirstTouch(createdAt: string, firstTouchAt: string | null): string {
  if (!firstTouchAt) return 'not yet';
  const ms = new Date(firstTouchAt).getTime() - new Date(createdAt).getTime();
  if (ms < 0) return '—';
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m`;
  return `${Math.round(ms / 3_600_000)}h`;
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [drafts, setDrafts] = useState<LeadDraft[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [vFilter, setVFilter] = useState('all');
  const [sFilter, setSFilter] = useState('all');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [threads, setThreads] = useState<Record<string, LeadMessage[]>>({});
  const [callMsg, setCallMsg] = useState<Record<string, string>>({});

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
  const warmCount = leads.filter((l) => ['warm', 'meeting'].includes(l.status)).length;
  const inboundCount = leads.filter((l) => ['inbound', 'engaged'].includes(l.status)).length;

  // Expand a lead; lazily load its SMS/call thread (inbound leads have one).
  function toggle(id: string) {
    const open = expanded === id;
    setExpanded(open ? null : id);
    if (!open && !threads[id]) {
      getLeadMessages(id).then((m) => setThreads((prev) => ({ ...prev, [id]: m }))).catch(() => {});
    }
  }

  async function call(id: string) {
    setCallMsg((prev) => ({ ...prev, [id]: 'Calling your phone…' }));
    const r = await callLeadNow(id);
    setCallMsg((prev) => ({ ...prev, [id]: r.ok ? 'Calling your phone — pick up to connect.' : (r.message || 'Calling isn’t set up yet.') }));
  }

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
        <div style={{ display: 'flex', gap: '10px' }}>
          {inboundCount > 0 && (
            <div style={{ background: '#0d948810', border: '1px solid #0d948840', borderRadius: '12px', padding: '12px 18px', textAlign: 'right' }}>
              <p style={{ fontSize: '24px', fontWeight: '800', color: '#0d9488', fontFamily: 'var(--font-geist-mono)', lineHeight: 1 }}>{inboundCount}</p>
              <p style={{ fontSize: '10px', color: '#0d9488', textTransform: 'uppercase', letterSpacing: '0.6px', marginTop: '4px' }}>Inbound</p>
            </div>
          )}
          {warmCount > 0 && (
            <div style={{ background: '#ea580c10', border: '1px solid #ea580c40', borderRadius: '12px', padding: '12px 18px', textAlign: 'right' }}>
              <p style={{ fontSize: '24px', fontWeight: '800', color: '#ea580c', fontFamily: 'var(--font-geist-mono)', lineHeight: 1 }}>{warmCount}</p>
              <p style={{ fontSize: '10px', color: '#ea580c', textTransform: 'uppercase', letterSpacing: '0.6px', marginTop: '4px' }}>🔥 Warm / booked</p>
            </div>
          )}
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '12px 18px', textAlign: 'right' }}>
            <p style={{ fontSize: '24px', fontWeight: '800', color: 'var(--accent)', fontFamily: 'var(--font-geist-mono)', lineHeight: 1 }}>{leads.length}</p>
            <p style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.6px', marginTop: '4px' }}>In pipeline</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <FilterRow label="Vertical" value={vFilter} setValue={setVFilter} options={['all', 'med_spa', 'real_estate', 'gym', 'other']} fmt={(o) => (o === 'all' ? 'All' : VERTICAL_LABEL[o])} />
        <FilterRow label="Status" value={sFilter} setValue={setSFilter} options={['all', 'qualified', 'drafted', 'contacted', 'warm', 'meeting', 'replied', 'disqualified']} fmt={(o) => (o === 'all' ? 'All' : o)} />
      </div>

      {loaded && leads.length === 0 ? (
        <div style={{ background: 'var(--card)', border: '1px dashed var(--border)', borderRadius: '16px', padding: '48px', textAlign: 'center' }}>
          <p style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '6px' }}>No leads yet</p>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '420px', margin: '0 auto', lineHeight: 1.5 }}>
            Give Aria a prospecting task on the Tasks page, then hit <strong>Run</strong>. She researches real businesses, scores them, and they show up here ranked.
          </p>
        </div>
      ) : (
        <div className="leads-scroll" style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px', boxShadow: 'var(--shadow)' }}>
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
            const engaged = ['warm', 'meeting'].includes(l.status);
            return (
              <div key={l.id} style={{ borderBottom: '1px solid var(--border)', borderLeft: engaged ? '3px solid #ea580c' : '3px solid transparent', background: engaged ? '#ea580c08' : 'transparent' }}>
                <div
                  onClick={() => toggle(l.id)}
                  className="table-row"
                  style={{ display: 'grid', gridTemplateColumns: '1fr 110px 90px 110px 1.4fr', gap: '12px', padding: '14px 20px', alignItems: 'center', cursor: 'pointer' }}
                >
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {l.businessName}
                      {l.origin === 'inbound' && <span title={`Inbound · ${l.source || 'form'}`} style={{ marginLeft: '6px', fontSize: '9px', color: '#0d9488', background: '#0d948818', borderRadius: '5px', padding: '1px 5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Inbound</span>}
                      {l.clickCount > 0 && <span title={`Clicked ${l.clickCount}× · last ${fmtDate(l.firstClickedAt)}`} style={{ marginLeft: '6px', fontSize: '10px', color: '#ea580c', fontWeight: 700 }}>🔥 {l.clickCount}</span>}
                    </p>
                    <p style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{l.origin === 'inbound' ? (l.phone || l.location || '—') : (l.location || '—')}</p>
                    <p style={{ fontSize: '10px', color: 'var(--green)', marginTop: '1px' }}>✓ {sourceLabel(l)} · verified {agoLabel(l.createdAt, nowTs)}</p>
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

                    {(l.clickCount > 0 || l.bookedAt) && (
                      <div style={{ marginTop: '12px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        {l.clickCount > 0 && (
                          <span style={{ fontSize: '11.5px', color: '#ea580c', background: '#ea580c12', border: '1px solid #ea580c30', borderRadius: '999px', padding: '4px 12px', fontWeight: 600 }}>
                            🔥 Clicked {l.clickCount}×{l.firstClickedAt ? ` · first ${fmtDate(l.firstClickedAt)}` : ''}
                          </span>
                        )}
                        {l.bookedAt && (
                          <span style={{ fontSize: '11.5px', color: '#16a34a', background: '#16a34a12', border: '1px solid #16a34a30', borderRadius: '999px', padding: '4px 12px', fontWeight: 600 }}>
                            📅 Booked {fmtDate(l.bookedAt)}
                          </span>
                        )}
                      </div>
                    )}

                    {l.origin === 'inbound' && (
                      <div style={{ marginTop: '14px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '10px', padding: '12px 14px' }}>
                        <div style={{ display: 'flex', gap: '18px', flexWrap: 'wrap', marginBottom: '10px' }}>
                          <div>
                            <p style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Consent</p>
                            <p style={{ fontSize: '12px', color: l.consentAt ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
                              {l.consentAt ? `${(l.consentChannels || []).join(', ') || 'none'} · ${fmtDate(l.consentAt)}` : 'No consent on file'}
                            </p>
                          </div>
                          <div>
                            <p style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Time to first touch</p>
                            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>{timeToFirstTouch(l.createdAt, l.firstTouchAt)}</p>
                          </div>
                          <div style={{ marginLeft: 'auto' }}>
                            <button onClick={() => call(l.id)} disabled={!l.phone} style={{ background: '#0d9488', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '12px', fontWeight: 700, cursor: l.phone ? 'pointer' : 'default' }}>📞 Call now</button>
                          </div>
                        </div>
                        {callMsg[l.id] && <p style={{ fontSize: '11px', color: 'var(--text-dim)', marginBottom: '8px' }}>{callMsg[l.id]}</p>}
                        {/* Conversation thread */}
                        {(threads[l.id]?.length ?? 0) === 0 ? (
                          <p style={{ fontSize: '12px', color: 'var(--text-dim)' }}>No messages yet{l.firstTouchAt ? '.' : ' — Aria responds the moment SMS is set up.'}</p>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {threads[l.id].map((m) => (
                              <div key={m.id} style={{ alignSelf: m.direction === 'outbound' ? 'flex-end' : 'flex-start', maxWidth: '78%', background: m.direction === 'outbound' ? 'var(--accent)' : 'var(--surface)', color: m.direction === 'outbound' ? '#fff' : 'var(--text-primary)', border: m.direction === 'outbound' ? 'none' : '1px solid var(--border)', borderRadius: '12px', padding: '7px 11px', fontSize: '12.5px', lineHeight: 1.45 }}>
                                {m.channel === 'call' ? `📞 ${m.body}` : m.body}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

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
