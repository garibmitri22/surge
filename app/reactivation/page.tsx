'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getLeads, type Lead } from '@/lib/leads';
import { SEGMENT_LABEL } from '@/lib/reactivation.mjs';

// Database Reactivation — the demo screen. Upload the owner's past-customer list, let
// Aria draft segmented win-back outreach (approve on /leads), and watch the results
// headline fill in from REAL data. Email leads on the established relationship; SMS only
// where consent exists (gated server-side).

const ACCENT = '#0ea5e9';

export default function ReactivationPage() {
  const router = useRouter();
  const [csv, setCsv] = useState('');
  const [importing, setImporting] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'info' | 'warn'; text: string } | null>(null);
  const [segments, setSegments] = useState<Record<string, number> | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  async function refresh() {
    try { setLeads((await getLeads()).filter((l) => l.origin === 'reactivation')); } catch { /* ignore */ }
  }
  useEffect(() => {
    let cancelled = false;
    (async () => { const l = (await getLeads()).filter((x) => x.origin === 'reactivation'); if (!cancelled) setLeads(l); })();
    return () => { cancelled = true; };
  }, []);

  async function runImport() {
    if (importing || !csv.trim()) return;
    setImporting(true); setNotice(null);
    try {
      const res = await fetch('/api/reactivation/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ csv }) });
      const r = await res.json().catch(() => ({ ok: false }));
      if (r.ok) {
        setSegments(r.segments || {});
        setNotice({ kind: 'info', text: `Imported ${r.created} contact${r.created === 1 ? '' : 's'}${r.skipped ? `, skipped ${r.skipped} duplicate${r.skipped === 1 ? '' : 's'}` : ''}. Now let Aria draft the outreach.` });
        setCsv('');
        await refresh();
      } else {
        setNotice({ kind: 'warn', text: r.message || 'Could not import — check the columns (needs at least name + email or phone).' });
      }
    } catch { setNotice({ kind: 'warn', text: 'Something went wrong — please try again.' }); }
    finally { setImporting(false); }
  }

  async function runDraft() {
    if (drafting) return;
    setDrafting(true); setNotice(null);
    try {
      const res = await fetch('/api/reactivation/draft', { method: 'POST' });
      const r = await res.json().catch(() => ({ ok: false }));
      if (r.ok) {
        await refresh();
        setNotice({ kind: 'info', text: `Aria drafted ${r.created_this_run?.drafts ?? 0} reactivation message${(r.created_this_run?.drafts ?? 0) === 1 ? '' : 's'}. Review & approve them on the Leads page.` });
      } else if (r.out_of_hours) {
        setNotice({ kind: 'warn', text: r.message || 'Out of hours this month.' });
      } else {
        setNotice({ kind: 'warn', text: r.message || r.error || 'Aria hit a snag — try again.' });
      }
    } catch { setNotice({ kind: 'warn', text: 'Something went wrong — please try again.' }); }
    finally { setDrafting(false); }
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setCsv(String(reader.result || ''));
    reader.readAsText(f);
  }

  // Results headline — real counts from the reactivation pipeline.
  const rebooked = leads.filter((l) => l.status === 'meeting').length;
  const replied = leads.filter((l) => ['warm', 'replied', 'engaged'].includes(l.status)).length;
  const drafted = leads.filter((l) => ['drafted', 'contacted'].includes(l.status)).length;

  return (
    <div className="page-pad" style={{ padding: '32px 36px', animation: 'fadeIn 0.3s ease' }}>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '800', color: 'var(--text-primary)' }}>Database Reactivation</h1>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px', maxWidth: '640px', lineHeight: 1.5 }}>
          Point Aria at your existing customers and old quotes. She drafts personalized win-back outreach you approve — revenue from people who already know you. Email leads the way; texting only where you have consent.
        </p>
      </div>

      {/* Results headline — real data */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' }} className="results-hero">
        {[
          { label: 'Rebooked (meetings)', value: rebooked, color: '#16a34a' },
          { label: 'Replied / warm', value: replied, color: '#ea580c' },
          { label: 'Outreach drafted', value: drafted, color: ACCENT },
        ].map((s) => (
          <div key={s.label} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '14px', boxShadow: 'var(--shadow)', padding: '18px 20px' }}>
            <p style={{ fontSize: '32px', fontWeight: '800', color: s.value === 0 ? 'var(--text-dim)' : s.color, fontFamily: 'var(--font-geist-mono)', lineHeight: 1 }}>{s.value}</p>
            <p style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.6px', marginTop: '8px', fontWeight: 600 }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Import */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderLeft: `3px solid ${ACCENT}`, borderRadius: '16px', boxShadow: 'var(--shadow)', padding: '20px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>Import your list</p>
          <button onClick={() => fileRef.current?.click()} style={{ fontSize: '12px', color: ACCENT, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Upload CSV</button>
          <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={onFile} style={{ display: 'none' }} />
        </div>
        <p style={{ fontSize: '11.5px', color: 'var(--text-dim)', marginBottom: '8px', lineHeight: 1.5 }}>Paste or upload a CSV with a header row. Columns we read: name, email, phone, last visit, amount, status, and an SMS-consent column (yes/no). Email-only contacts are fine.</p>
        <textarea
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          placeholder={'name,email,phone,last visit,amount,status,sms consent\nJane Doe,jane@email.com,+15551234,2024-09-01,4200,past customer,yes'}
          rows={5}
          style={{ width: '100%', resize: 'vertical', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '11px 14px', fontSize: '12.5px', color: 'var(--text-primary)', outline: 'none', fontFamily: 'var(--font-geist-mono)', lineHeight: 1.5 }}
        />
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '12px' }}>
          <button onClick={runImport} disabled={importing || !csv.trim()} style={{ background: importing || !csv.trim() ? 'var(--border)' : ACCENT, color: importing || !csv.trim() ? 'var(--text-dim)' : '#fff', border: 'none', borderRadius: '10px', padding: '11px 18px', fontSize: '13px', fontWeight: 700, cursor: importing || !csv.trim() ? 'default' : 'pointer' }}>
            {importing ? 'Importing…' : 'Import contacts'}
          </button>
          <button onClick={runDraft} disabled={drafting || leads.length === 0} title={leads.length === 0 ? 'Import contacts first' : 'Aria drafts win-back outreach'} style={{ background: 'var(--surface)', color: leads.length === 0 ? 'var(--text-dim)' : 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: '10px', padding: '11px 18px', fontSize: '13px', fontWeight: 600, cursor: drafting || leads.length === 0 ? 'default' : 'pointer' }}>
            {drafting ? 'Aria is drafting…' : 'Have Aria draft outreach'}
          </button>
        </div>
        {notice && <p style={{ fontSize: '12.5px', color: notice.kind === 'warn' ? 'var(--amber)' : 'var(--text-secondary)', marginTop: '12px', lineHeight: 1.5 }}>{notice.text}</p>}
      </div>

      {/* Segment counts */}
      {segments && Object.keys(segments).length > 0 && (
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '20px' }}>
          {Object.entries(segments).map(([seg, n]) => (
            <div key={seg} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '12px 18px' }}>
              <p style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-geist-mono)' }}>{n}</p>
              <p style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{(SEGMENT_LABEL as Record<string, string>)[seg] || seg}</p>
            </div>
          ))}
        </div>
      )}

      {leads.length === 0 ? (
        <div style={{ background: 'var(--card)', border: '1px dashed var(--border)', borderRadius: '16px', padding: '40px', textAlign: 'center' }}>
          <p style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>No reactivation contacts yet</p>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '440px', margin: '0 auto', lineHeight: 1.6 }}>Upload a past-customer or old-quote list above. Aria segments it, drafts win-back outreach in your voice, and you approve before anything sends.</p>
        </div>
      ) : (
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
          {leads.length} reactivation contact{leads.length === 1 ? '' : 's'} imported.{' '}
          <button onClick={() => router.push('/leads')} style={{ color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Review & approve drafts on Leads →</button>
        </p>
      )}
    </div>
  );
}
