'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getContentPieces, setContentStatus, updateContentBody, runStudio, type ContentPiece, type ContentStatus } from '@/lib/content';
import { PresenceOrb } from '@/components/PresenceOrb';

const NOVA = '#34d399';
const TYPE_LABEL: Record<string, string> = { post: 'Social Post', script: 'Video Script', ugc_brief: 'UGC Brief', caption: 'Caption' };
const TYPE_ORDER = ['post', 'script', 'ugc_brief', 'caption'];
const PLATFORM_LABEL: Record<string, string> = { instagram: 'Instagram', tiktok: 'TikTok', linkedin: 'LinkedIn', x: 'X', generic: 'Any' };
const STATUS_COLOR: Record<string, string> = { draft: '#6366f1', approved: '#16a34a', archived: '#9ca3af' };

const IDEAS = [
  'a LinkedIn post on the cost of a bad hire',
  'a 20-second TikTok script with a scroll-stopping hook',
  'a UGC brief for a founder testimonial (illustrative)',
  'three Instagram captions for our launch',
];

export default function StudioPage() {
  const router = useRouter();
  const [pieces, setPieces] = useState<ContentPiece[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [angle, setAngle] = useState('');
  const [generating, setGenerating] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'info' | 'warn'; text: string } | null>(null);
  const [filter, setFilter] = useState('all');
  const [editing, setEditing] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editBody, setEditBody] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  async function refresh() {
    const p = await getContentPieces();
    setPieces(p);
    setLoaded(true);
  }
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const p = await getContentPieces();
      if (!cancelled) { setPieces(p); setLoaded(true); }
    })();
    return () => { cancelled = true; };
  }, []);

  async function generate(useAngle: string) {
    if (generating) return;
    setGenerating(true);
    setNotice(null);
    try {
      const r = await runStudio(useAngle);
      if (r.ok) {
        setAngle('');
        await refresh();
        setNotice({ kind: 'info', text: `Nova drafted ${r.created_this_run?.pieces ?? 0} new piece${(r.created_this_run?.pieces ?? 0) === 1 ? '' : 's'} — review them below.` });
      } else if (r.reason === 'no_brand_voice') {
        setNotice({ kind: 'warn', text: r.message || 'Nova needs your brand voice first.' });
      } else if (r.out_of_hours) {
        setNotice({ kind: 'warn', text: r.message || 'Out of hours this month.' });
      } else {
        setNotice({ kind: 'warn', text: r.message || r.error || 'Nova hit a snag — try again.' });
      }
    } catch {
      setNotice({ kind: 'warn', text: 'Something went wrong — please try again.' });
    } finally {
      setGenerating(false);
    }
  }

  async function decide(id: string, status: ContentStatus) {
    setPieces((prev) => prev.map((p) => (p.id === id ? { ...p, status } : p)));
    try { await setContentStatus(id, status); } catch { refresh(); }
  }

  function startEdit(p: ContentPiece) { setEditing(p.id); setEditTitle(p.title); setEditBody(p.body); }
  async function saveEdit(id: string) {
    setPieces((prev) => prev.map((p) => (p.id === id ? { ...p, title: editTitle, body: editBody } : p)));
    setEditing(null);
    try { await updateContentBody(id, editTitle, editBody); } catch { refresh(); }
  }

  async function copy(p: ContentPiece) {
    try { await navigator.clipboard.writeText(`${p.title}\n\n${p.body}`); setCopied(p.id); setTimeout(() => setCopied(null), 1500); } catch { /* clipboard blocked */ }
  }

  const visible = pieces.filter((p) => (filter === 'all' ? p.status !== 'archived' : p.status === filter));
  const grouped = TYPE_ORDER.map((t) => ({ type: t, items: visible.filter((p) => p.type === t) })).filter((g) => g.items.length > 0);
  const orbState = generating ? 'thinking' : 'idle';

  return (
    <div className="page-pad" style={{ padding: '32px 36px', animation: 'fadeIn 0.3s ease' }}>
      {/* Nova identity */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <PresenceOrb employeeId="nova" state={orbState} size={64} aria-label="Nova presence" />
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ fontSize: '24px', fontWeight: '800', color: 'var(--text-primary)' }}>Nova&rsquo;s Studio</h1>
            <span style={{ fontSize: '10px', color: NOVA, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', border: `1px solid ${NOVA}40`, borderRadius: '5px', padding: '2px 7px' }}>Marketing Director</span>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            {generating ? 'Drafting on-brand content from your brand voice…' : 'On-brand content from your company brain — drafts you approve in one click. Nothing is published.'}
          </p>
        </div>
      </div>

      {/* Create affordance */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderLeft: `3px solid ${NOVA}`, borderRadius: '16px', boxShadow: 'var(--shadow)', padding: '18px 20px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            value={angle}
            onChange={(e) => setAngle(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') generate(angle); }}
            disabled={generating}
            placeholder="Give Nova an angle — e.g. &ldquo;a LinkedIn post on firing your worst hire&rdquo;"
            style={{ flex: 1, minWidth: '240px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '11px 14px', fontSize: '13px', color: 'var(--text-primary)', outline: 'none' }}
          />
          <button
            onClick={() => generate(angle)}
            disabled={generating}
            style={{ flexShrink: 0, background: generating ? 'var(--border)' : NOVA, color: generating ? 'var(--text-dim)' : '#06281c', border: 'none', borderRadius: '10px', padding: '11px 18px', fontSize: '13px', fontWeight: 700, cursor: generating ? 'default' : 'pointer' }}
          >
            {generating ? 'Drafting…' : 'Draft a batch'}
          </button>
          <button
            onClick={() => generate('')}
            disabled={generating}
            title="Let Nova pick strong on-brand angles"
            style={{ flexShrink: 0, background: 'var(--surface)', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: '10px', padding: '11px 16px', fontSize: '13px', fontWeight: 600, cursor: generating ? 'default' : 'pointer' }}
          >
            Surprise me
          </button>
        </div>
        {notice && (
          <p style={{ fontSize: '12.5px', color: notice.kind === 'warn' ? 'var(--amber)' : 'var(--text-secondary)', marginTop: '12px', lineHeight: 1.5 }}>{notice.text}</p>
        )}
      </div>

      {/* Filters */}
      {pieces.length > 0 && (
        <div style={{ display: 'flex', gap: '6px', marginBottom: '16px' }}>
          {['all', 'draft', 'approved', 'archived'].map((f) => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: '5px 12px', borderRadius: '7px', border: '1px solid var(--border)', cursor: 'pointer', fontSize: '12px',
              fontWeight: filter === f ? 700 : 400, textTransform: 'capitalize',
              background: filter === f ? NOVA : 'var(--card)', color: filter === f ? '#06281c' : 'var(--text-secondary)',
            }}>{f === 'all' ? 'Active' : f}</button>
          ))}
        </div>
      )}

      {/* Empty state */}
      {loaded && pieces.length === 0 ? (
        <div style={{ background: 'var(--card)', border: '1px dashed var(--border)', borderRadius: '16px', padding: '44px', textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '14px' }}>
            <PresenceOrb employeeId="nova" state={generating ? 'thinking' : 'idle'} size={84} />
          </div>
          <p style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '6px' }}>Nova hasn&rsquo;t made anything yet</p>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '460px', margin: '0 auto 14px', lineHeight: 1.6 }}>
            Give her an angle and she&rsquo;ll draft a batch in your brand voice — {IDEAS.slice(0, 3).join(', ')}, and more. Everything is a draft you approve.
          </p>
          <button onClick={() => generate('')} disabled={generating} style={{ background: NOVA, color: '#06281c', border: 'none', borderRadius: '10px', padding: '11px 22px', fontSize: '13px', fontWeight: 700, cursor: generating ? 'default' : 'pointer' }}>
            {generating ? 'Drafting…' : 'Draft my first batch'}
          </button>
        </div>
      ) : (
        grouped.map((g) => (
          <div key={g.type} style={{ marginBottom: '22px' }}>
            <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: '10px' }}>{TYPE_LABEL[g.type]}s · {g.items.length}</p>
            <div style={{ display: 'grid', gap: '12px' }}>
              {g.items.map((p) => (
                <div key={p.id} className="card-hover" style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '14px', boxShadow: 'var(--shadow)', padding: '16px 18px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: NOVA, background: `${NOVA}18`, borderRadius: '6px', padding: '2px 8px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{PLATFORM_LABEL[p.platform] || p.platform}</span>
                    <span style={{ fontSize: '11px', color: STATUS_COLOR[p.status], background: `${STATUS_COLOR[p.status]}18`, borderRadius: '999px', padding: '2px 10px', fontWeight: 600, textTransform: 'capitalize' }}>{p.status}</span>
                    <span style={{ flex: 1 }} />
                    {copied === p.id && <span style={{ fontSize: '11px', color: 'var(--green)' }}>Copied ✓</span>}
                  </div>

                  {editing === p.id ? (
                    <>
                      <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} style={{ width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 12px', fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px', outline: 'none' }} />
                      <textarea value={editBody} onChange={(e) => setEditBody(e.target.value)} rows={6} style={{ width: '100%', resize: 'vertical', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.5, outline: 'none', fontFamily: 'inherit' }} />
                      <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                        <button onClick={() => saveEdit(p.id)} style={{ background: NOVA, color: '#06281c', border: 'none', borderRadius: '8px', padding: '7px 16px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>Save</button>
                        <button onClick={() => setEditing(null)} style={{ background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: '8px', padding: '7px 16px', fontSize: '12px', cursor: 'pointer' }}>Cancel</button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>{p.title}</p>
                      <p style={{ fontSize: '13px', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.55, marginBottom: '12px' }}>{p.body}</p>
                      {p.brief && <p style={{ fontSize: '11px', color: 'var(--text-dim)', marginBottom: '12px', fontStyle: 'italic' }}>Angle: {p.brief}</p>}
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {p.status !== 'approved' && <button onClick={() => decide(p.id, 'approved')} style={btn(NOVA, '#06281c')}>Approve</button>}
                        <button onClick={() => copy(p)} style={btnGhost()}>Copy</button>
                        <button onClick={() => startEdit(p)} style={btnGhost()}>Edit</button>
                        {p.status !== 'archived' && <button onClick={() => decide(p.id, 'archived')} style={btnGhost()}>Archive</button>}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {loaded && pieces.length > 0 && visible.length === 0 && (
        <p style={{ fontSize: '13px', color: 'var(--text-dim)', textAlign: 'center', padding: '24px' }}>Nothing here. <button onClick={() => setFilter('all')} style={{ color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer' }}>Show active</button></p>
      )}

      <div style={{ textAlign: 'center', padding: '8px 0 4px' }}>
        <button onClick={() => router.push('/workforce/nova')} style={{ fontSize: '12px', color: 'var(--text-dim)', background: 'none', border: 'none', cursor: 'pointer' }}>Chat with Nova →</button>
      </div>
    </div>
  );
}

function btn(bg: string, fg: string): React.CSSProperties {
  return { background: bg, color: fg, border: 'none', borderRadius: '8px', padding: '7px 16px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' };
}
function btnGhost(): React.CSSProperties {
  return { background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: '8px', padding: '7px 14px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' };
}
