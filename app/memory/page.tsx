'use client';

import { useEffect, useState } from 'react';
import { getMemoryEntries, createMemoryEntry, deleteMemoryEntry } from '@/lib/data';
import type { MemoryEntry, MemoryType } from '@/lib/mockData';

const typeColors: Record<MemoryType, string> = {
  company: '#6366f1',
  customer: '#34d399',
  process: '#f59e0b',
  sop: '#60a5fa',
  note: '#9ca3af',
};

const typeLabels: Record<MemoryType, string> = {
  company: 'Company',
  customer: 'Customer',
  process: 'Process',
  sop: 'SOP',
  note: 'Note',
};

// Intake + Atlas write types beyond the original five (icp, offer, voice, goal,
// brand, rapport, decision, open-loop, idea, ...). Render any unknown type
// gracefully instead of crashing.
const colorFor = (t: string): string => typeColors[t as MemoryType] ?? '#9ca3af';
const labelFor = (t: string): string =>
  typeLabels[t as MemoryType] ?? (t.charAt(0).toUpperCase() + t.slice(1).replace(/[-_]/g, ' '));

export default function MemoryPage() {
  const [entries, setEntries] = useState<MemoryEntry[]>([]);
  const [filterType, setFilterType] = useState<MemoryType | 'all'>('all');
  const [showModal, setShowModal] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [form, setForm] = useState({ type: 'note' as MemoryType, title: '', content: '', tags: '' });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await getMemoryEntries();
      if (!cancelled) setEntries(data);
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = filterType === 'all' ? entries : entries.filter(e => e.type === filterType);

  async function addEntry() {
    if (!form.title || !form.content) return;
    const entry = await createMemoryEntry({
      type: form.type,
      title: form.title,
      content: form.content,
      tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
    });
    setEntries(prev => [entry, ...prev]);
    setForm({ type: 'note', title: '', content: '', tags: '' });
    setShowModal(false);
  }

  const [deletingId, setDeletingId] = useState<string | null>(null);
  async function removeEntry(id: string) {
    if (deletingId) return;
    if (!confirm('Delete this from the company brain? Your AI team will no longer use it. This cannot be undone.')) return;
    setDeletingId(id);
    try {
      await deleteMemoryEntry(id);
      setEntries(prev => prev.filter(e => e.id !== id));
      setExpandedId(prev => (prev === id ? null : prev));
    } catch {
      alert('Could not delete that entry. Please try again.');
    } finally {
      setDeletingId(null);
    }
  }

  const typeCounts = entries.reduce((acc, e) => {
    acc[e.type] = (acc[e.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="page-pad" style={{ padding: '32px 36px', animation: 'fadeIn 0.3s ease' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: '800', color: 'var(--text-primary)' }}>Memory</h1>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '4px' }}>The company brain. Everything your AI team knows about your business.</p>
        </div>
        <button onClick={() => setShowModal(true)} style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '10px', padding: '10px 20px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>
          + Add Memory
        </button>
      </div>

      {/* Type Breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px', marginBottom: '24px' }}>
        {(Object.keys(typeLabels) as MemoryType[]).map(type => (
          <button key={type} onClick={() => setFilterType(filterType === type ? 'all' : type)}
            style={{
              background: filterType === type ? typeColors[type] + '20' : 'var(--card)',
              border: `1px solid ${filterType === type ? typeColors[type] + '50' : 'var(--border)'}`,
              borderRadius: '10px', padding: '14px', cursor: 'pointer', textAlign: 'left',
            }}>
            <p style={{ fontSize: '18px', fontWeight: '800', color: typeColors[type], fontFamily: 'var(--font-geist-mono)' }}>{typeCounts[type] || 0}</p>
            <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>{typeLabels[type]}</p>
          </button>
        ))}
      </div>

      {/* Entries */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {filtered.length === 0 ? (
          <p style={{ color: 'var(--text-dim)', fontSize: '13px', padding: '20px 0' }}>No entries of this type yet.</p>
        ) : filtered.map(entry => {
          const expanded = expandedId === entry.id;
          return (
            <div
              key={entry.id}
              onClick={() => setExpandedId(expanded ? null : entry.id)}
              style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', boxShadow: 'var(--shadow)', padding: '18px 20px', cursor: 'pointer', transition: 'border-color 0.15s', borderColor: expanded ? colorFor(entry.type) + '40' : 'var(--border)' }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: colorFor(entry.type) + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: '11px', fontWeight: '700', color: colorFor(entry.type) }}>{labelFor(entry.type).slice(0, 2).toUpperCase()}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                    <p style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>{entry.title}</p>
                    <span style={{ fontSize: '10px', color: colorFor(entry.type), background: colorFor(entry.type) + '15', padding: '2px 8px', borderRadius: '999px', fontWeight: '600' }}>{labelFor(entry.type)}</span>
                  </div>
                  {!expanded && <p style={{ fontSize: '12px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.content}</p>}
                  {expanded && <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, marginTop: '6px' }}>{entry.content}</p>}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                    {(entry.tags ?? []).map(tag => (
                      <span key={tag} style={{ fontSize: '10px', color: 'var(--text-dim)', background: 'var(--surface)', border: '1px solid var(--border)', padding: '2px 8px', borderRadius: '999px' }}>#{tag}</span>
                    ))}
                    <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--text-dim)' }}>Updated {entry.updatedAt}</span>
                    {expanded && (
                      <button
                        onClick={(e) => { e.stopPropagation(); removeEntry(entry.id); }}
                        disabled={deletingId === entry.id}
                        style={{ fontSize: '11px', color: '#ef4444', background: '#ef444415', border: '1px solid #ef444430', borderRadius: '7px', padding: '4px 10px', cursor: deletingId === entry.id ? 'default' : 'pointer', fontWeight: '600' }}
                      >
                        {deletingId === entry.id ? 'Deleting…' : 'Delete'}
                      </button>
                    )}
                  </div>
                </div>
                <span style={{ color: 'var(--text-dim)', fontSize: '14px', flexShrink: 0 }}>{expanded ? '▲' : '▼'}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Memory Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: '#00000080', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px', boxShadow: 'var(--shadow)', width: '520px', overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)' }}>Add to Memory</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '3px' }}>Store knowledge your AI employees can access</p>
            </div>
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>Type</label>
                  <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value as MemoryType }))} style={inputStyle}>
                    {(Object.keys(typeLabels) as MemoryType[]).map(t => <option key={t} value={t}>{typeLabels[t]}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Title *</label>
                  <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g. ICP Definition" style={inputStyle} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Content *</label>
                <textarea value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))} placeholder="What should your AI employees know?" rows={4}
                  style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit', lineHeight: '1.5' }} />
              </div>
              <div>
                <label style={labelStyle}>Tags (comma separated)</label>
                <input value={form.tags} onChange={e => setForm(p => ({ ...p, tags: e.target.value }))} placeholder="e.g. sales, ICP, targeting" style={inputStyle} />
              </div>
            </div>
            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={() => setShowModal(false)} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 20px', color: 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
              <button onClick={addEntry} style={{ background: 'var(--accent)', border: 'none', borderRadius: '8px', padding: '8px 20px', color: '#fff', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>Save to Memory</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const labelStyle: React.CSSProperties = { fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '6px' };
const inputStyle: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '9px 12px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none', width: '100%' };
