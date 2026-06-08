'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { getLeads, getDrafts, getLeadMessages, callLeadNow, runTask, updateLeadStatus, updateLeadFields, deleteLead, bulkMoveLeads, bulkDeleteLeads, LEAD_STAGES, stageLabel, type Lead, type LeadDraft, type LeadMessage } from '@/lib/leads';
import { createTask, getTasks } from '@/lib/data';
import { RunProgress } from '@/components/RunProgress';

const VERTICAL_LABEL: Record<string, string> = { med_spa: 'Med Spa', real_estate: 'Real Estate', gym: 'Gym', other: 'Other' };
const STATUS_COLOR: Record<string, string> = {
  new: '#9ca3af', inbound: '#0d9488', engaged: '#0891b2', qualified: '#6366f1', drafted: '#8b5cf6', contacted: '#0891b2',
  warm: '#ea580c', replied: '#16a34a', meeting: '#16a34a', won: '#16a34a', lost: '#ef4444', disqualified: '#9ca3af', recycled: '#d97706',
};
const fmtDate = (s: string | null) => (s ? new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '');
const editInputStyle: CSSProperties = { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 10px', fontSize: '12.5px', color: 'var(--text-primary)', outline: 'none', width: '100%', fontFamily: 'inherit' };

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

  // Dogfooding lever: kick a fresh prospecting run from here without waiting on the one-shot
  // day-one activation. The run is async (ACKS immediately, researches in the background), so
  // we create a task, kick it, then POLL — refreshing the pipeline so leads/drafts appear as
  // they're written and finishing when the task completes.
  // Legible run state machine (shared with the dashboard + tasks). Poll the REAL counts and
  // let RunProgress derive Queued → Researching → Drafting → Done. Idle shows the kick button.
  const [runActive, setRunActive] = useState(false);
  const [runDone, setRunDone] = useState(false);
  const [runFailed, setRunFailed] = useState(false);
  const [runLeads, setRunLeads] = useState(0);   // NEW leads this run
  const [runDrafts, setRunDrafts] = useState(0); // NEW drafts this run
  async function runAriaNow() {
    if (runActive) return;
    setRunActive(true); setRunDone(false); setRunFailed(false); setRunLeads(0); setRunDrafts(0);
    const beforeLeads = leads.length, beforeDrafts = drafts.length;
    try {
      const task = await createTask({ title: 'Find & score new leads', assigneeId: 'aria', priority: 'high', project: 'Prospecting', dueDate: '' });
      const r = await runTask(task.id);
      if (!r.ok) { setRunFailed(true); setRunActive(false); return; }
      const deadline = Date.now() + 6 * 60 * 1000;
      while (Date.now() < deadline) {
        await new Promise((res) => setTimeout(res, 4000));
        const [l, d, tks] = await Promise.all([getLeads(), getDrafts(), getTasks()]);
        setLeads(l); setDrafts(d); setNowTs(Date.now());
        setRunLeads(Math.max(0, l.length - beforeLeads));
        setRunDrafts(Math.max(0, d.length - beforeDrafts));
        const t = tks.find((x) => x.id === task.id);
        if (!t || t.status === 'completed') break;
      }
      setRunDone(true); setRunActive(false); // land on a completion state, never a bare button
    } catch {
      setRunFailed(true); setRunActive(false);
    }
  }

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

  // ---- Manual CRM: the owner gets the wheel -------------------------------------------------
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<{ id: string; businessName: string; email: string; phone: string; notes: string } | null>(null);
  const [crmBusy, setCrmBusy] = useState(false);

  async function refreshLeads() {
    const [l, d] = await Promise.all([getLeads(), getDrafts()]);
    const now = Date.now();
    setLeads(l); setDrafts(d); setNowTs(now);
    setOverdueCount(l.filter((x) => new Date(x.nextActionAt).getTime() < now && !['disqualified', 'meeting', 'recycled', 'won', 'lost'].includes(x.status)).length);
  }

  function toggleSelect(id: string) {
    setSelected((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }

  // MOVE one lead's stage (optimistic; it's a manual override Aria will respect).
  async function moveLead(l: Lead, status: string) {
    if (status === l.status) return;
    setLeads((prev) => prev.map((x) => (x.id === l.id ? { ...x, status } : x)));
    try { await updateLeadStatus(l.id, status, l.businessName); } catch { /* fall through to refresh */ }
    await refreshLeads();
  }

  // DELETE one lead (confirm) — replaces the old SQL-editor workaround.
  async function removeLead(l: Lead) {
    if (typeof window !== 'undefined' && !window.confirm(`Delete "${l.businessName}"? This permanently removes the lead and its drafts.`)) return;
    setLeads((prev) => prev.filter((x) => x.id !== l.id));
    setSelected((prev) => { const n = new Set(prev); n.delete(l.id); return n; });
    if (expanded === l.id) setExpanded(null);
    try { await deleteLead(l.id, l.businessName); } catch { /* fall through */ }
    await refreshLeads();
  }

  async function saveEdit(l: Lead) {
    if (!editing || editing.id !== l.id) return;
    setCrmBusy(true);
    try {
      await updateLeadFields(l.id, { businessName: editing.businessName, email: editing.email, phone: editing.phone, notes: editing.notes }, l.businessName);
      setEditing(null); await refreshLeads();
    } catch { /* keep the form open */ } finally { setCrmBusy(false); }
  }

  async function bulkMove(status: string) {
    const ids = [...selected]; if (ids.length === 0) return;
    setCrmBusy(true);
    try { await bulkMoveLeads(ids, status); setSelected(new Set()); await refreshLeads(); } finally { setCrmBusy(false); }
  }
  async function bulkRemove() {
    const ids = [...selected]; if (ids.length === 0) return;
    if (typeof window !== 'undefined' && !window.confirm(`Delete ${ids.length} lead${ids.length === 1 ? '' : 's'}? This permanently removes them and their drafts.`)) return;
    setCrmBusy(true);
    try { await bulkDeleteLeads(ids); setSelected(new Set()); await refreshLeads(); } finally { setCrmBusy(false); }
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
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {/* Honest idle: the kick button only shows when nothing is running and nothing's waiting to be reviewed. */}
          {!runActive && !runDone && !runFailed && (
            <button onClick={runAriaNow} style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '10px', padding: '12px 18px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              ▶ Run Aria now
            </button>
          )}
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

      {/* Legible run state — alive working card → completion (review primary, run-again secondary) */}
      {(runActive || runDone || runFailed) && (
        <div style={{ marginBottom: '20px' }}>
          <RunProgress
            inFlight={runActive} completed={runDone} failed={runFailed} leads={runLeads} drafts={runDrafts}
            onReview={() => { setRunDone(false); setRunFailed(false); }} reviewLabel="See your leads"
            onRunAgain={runActive ? undefined : runAriaNow}
          />
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <FilterRow label="Vertical" value={vFilter} setValue={setVFilter} options={['all', 'med_spa', 'real_estate', 'gym', 'other']} fmt={(o) => (o === 'all' ? 'All' : VERTICAL_LABEL[o])} />
        <FilterRow label="Status" value={sFilter} setValue={setSFilter} options={['all', 'qualified', 'drafted', 'contacted', 'warm', 'meeting', 'won', 'lost', 'disqualified']} fmt={(o) => (o === 'all' ? 'All' : stageLabel(o))} />
      </div>

      {/* Bulk action bar — clean a batch at once (move or delete) */}
      {selected.size > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', background: 'var(--accent-dim)', border: '1px solid #6366f130', borderRadius: '12px', padding: '10px 16px', marginBottom: '14px' }}>
          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>{selected.size} selected</span>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Move to</span>
          <select disabled={crmBusy} defaultValue="" onChange={(e) => { if (e.target.value) { bulkMove(e.target.value); e.target.value = ''; } }}
            style={{ fontSize: '12px', padding: '6px 8px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text-primary)', cursor: 'pointer' }}>
            <option value="" disabled>Choose a stage…</option>
            {LEAD_STAGES.map((s) => <option key={s} value={s}>{stageLabel(s)}</option>)}
          </select>
          <button disabled={crmBusy} onClick={bulkRemove} style={{ fontSize: '12px', fontWeight: 700, color: 'var(--red)', background: '#ef444412', border: '1px solid #ef444440', borderRadius: '8px', padding: '6px 12px', cursor: crmBusy ? 'default' : 'pointer' }}>Delete selected</button>
          <button onClick={() => setSelected(new Set())} style={{ fontSize: '12px', color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', marginLeft: 'auto' }}>Clear</button>
        </div>
      )}

      {loaded && leads.length === 0 ? (
        <div style={{ background: 'var(--card)', border: '1px dashed var(--border)', borderRadius: '16px', padding: '48px', textAlign: 'center' }}>
          <p style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '6px' }}>No leads yet</p>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '420px', margin: '0 auto', lineHeight: 1.5 }}>
            Give Aria a prospecting task on the Tasks page, then hit <strong>Run</strong>. She researches real businesses, scores them, and they show up here ranked.
          </p>
        </div>
      ) : (
        <div className="leads-scroll" style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px', boxShadow: 'var(--shadow)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr 110px 90px 130px 1.4fr', gap: '12px', padding: '12px 20px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', alignItems: 'center' }}>
            <input type="checkbox" aria-label="Select all" checked={filtered.length > 0 && filtered.every((l) => selected.has(l.id))}
              onChange={(e) => setSelected(e.target.checked ? new Set(filtered.map((l) => l.id)) : new Set())}
              style={{ cursor: 'pointer', accentColor: 'var(--accent)', width: '15px', height: '15px' }} />
            {['Business', 'Vertical', 'Score', 'Stage', 'Next action'].map((h) => (
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
                  style={{ display: 'grid', gridTemplateColumns: '28px 1fr 110px 90px 130px 1.4fr', gap: '12px', padding: '14px 20px', alignItems: 'center', cursor: 'pointer' }}
                >
                  <input type="checkbox" checked={selected.has(l.id)} onClick={(e) => e.stopPropagation()} onChange={() => toggleSelect(l.id)} aria-label={`Select ${l.businessName}`} style={{ cursor: 'pointer', accentColor: 'var(--accent)', width: '15px', height: '15px' }} />
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {l.businessName}
                      {l.origin === 'inbound' && <span title={`Inbound · ${l.source || 'form'}`} style={{ marginLeft: '6px', fontSize: '9px', color: '#0d9488', background: '#0d948818', borderRadius: '5px', padding: '1px 5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Inbound</span>}
                      {l.origin === 'researched' && l.relationship && <span title={l.relationship} style={{ marginLeft: '6px', fontSize: '9px', color: '#2563eb', background: '#2563eb18', borderRadius: '5px', padding: '1px 5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px' }}>📣 Advertiser</span>}
                      {l.clickCount > 0 && <span title={`Clicked ${l.clickCount}× · last ${fmtDate(l.firstClickedAt)}`} style={{ marginLeft: '6px', fontSize: '10px', color: '#ea580c', fontWeight: 700 }}>🔥 {l.clickCount}</span>}
                    </p>
                    <p style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{l.origin === 'inbound' ? (l.phone || l.location || '—') : (l.location || '—')}</p>
                    <p style={{ fontSize: '10px', color: 'var(--green)', marginTop: '1px' }}>✓ {sourceLabel(l)} · verified {agoLabel(l.createdAt, nowTs)}</p>
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{VERTICAL_LABEL[l.vertical] || l.vertical}</span>
                  <span style={{ fontSize: '15px', fontWeight: '800', color: 'var(--accent)', fontFamily: 'var(--font-geist-mono)' }}>{l.score}</span>
                  <select value={l.status} onClick={(e) => e.stopPropagation()} onChange={(e) => { e.stopPropagation(); moveLead(l, e.target.value); }} title="Move this lead — Aria respects your choice"
                    style={{ fontSize: '11px', color: STATUS_COLOR[l.status] || 'var(--text-dim)', background: (STATUS_COLOR[l.status] || '#9ca3af') + '18', border: `1px solid ${(STATUS_COLOR[l.status] || '#9ca3af')}40`, padding: '4px 6px', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize', width: '100%' }}>
                    {!(LEAD_STAGES as readonly string[]).includes(l.status) && <option value={l.status}>{stageLabel(l.status)}</option>}
                    {LEAD_STAGES.map((s) => <option key={s} value={s}>{stageLabel(s)}</option>)}
                  </select>
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

                    {/* Owner controls — correct Aria's data, or remove the lead (no SQL needed) */}
                    <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid var(--border)' }}>
                      {editing?.id === l.id ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '560px' }}>
                          <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>Edit lead</p>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                            <input value={editing.businessName} onChange={(e) => setEditing({ ...editing, businessName: e.target.value })} placeholder="Business name" style={editInputStyle} />
                            <input value={editing.email} onChange={(e) => setEditing({ ...editing, email: e.target.value })} placeholder="Email" style={editInputStyle} />
                            <input value={editing.phone} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} placeholder="Phone" style={editInputStyle} />
                            <input value={editing.notes} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} placeholder="Notes" style={editInputStyle} />
                          </div>
                          <div style={{ display: 'flex', gap: '8px', marginTop: '2px' }}>
                            <button disabled={crmBusy} onClick={() => saveEdit(l)} className="btn-primary" style={{ padding: '7px 16px', fontSize: '12px' }}>Save changes</button>
                            <button onClick={() => setEditing(null)} className="btn-ghost" style={{ padding: '7px 16px', fontSize: '12px' }}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                          <button onClick={() => setEditing({ id: l.id, businessName: l.businessName, email: l.email || '', phone: l.phone || '', notes: l.notes || '' })} style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer' }}>✎ Edit lead</button>
                          <button onClick={() => removeLead(l)} style={{ fontSize: '12px', fontWeight: 600, color: 'var(--red)', background: 'none', border: 'none', cursor: 'pointer' }}>🗑 Delete lead</button>
                        </div>
                      )}
                    </div>
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
