'use client';

import { useEffect, useState } from 'react';
import { getTasks, getEmployees, createTask, updateTaskStatus } from '@/lib/data';
import { runTask } from '@/lib/leads';
import type { Task, Employee } from '@/lib/mockData';

const priorityColors: Record<string, string> = {
  high: '#ef4444',
  medium: '#eab308',
  low: '#9ca3af',
};

const statusColors: Record<string, string> = {
  queued: '#9ca3af',
  in_progress: '#6366f1',
  completed: '#22c55e',
};

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [running, setRunning] = useState<string | null>(null);
  const [runNote, setRunNote] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'queued' | 'in_progress' | 'completed'>('all');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ title: '', assigneeId: '', priority: 'medium' as Task['priority'], project: '', dueDate: '' });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [tks, emps] = await Promise.all([getTasks(), getEmployees()]);
      if (cancelled) return;
      setTasks(tks);
      setEmployees(emps);
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = filter === 'all' ? tasks : tasks.filter(t => t.status === filter);

  const stats = {
    total: tasks.length,
    in_progress: tasks.filter(t => t.status === 'in_progress').length,
    queued: tasks.filter(t => t.status === 'queued').length,
    completed: tasks.filter(t => t.status === 'completed').length,
  };

  async function addTask() {
    if (!form.title || !form.assigneeId) return;
    const newTask = await createTask({
      title: form.title,
      assigneeId: form.assigneeId,
      priority: form.priority,
      project: form.project,
      dueDate: form.dueDate,
    });
    setTasks(prev => [newTask, ...prev]);
    setForm({ title: '', assigneeId: '', priority: 'medium', project: '', dueDate: '' });
    setShowModal(false);
  }

  async function cycleStatus(taskId: string) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    const next: Task['status'] = task.status === 'queued' ? 'in_progress' : task.status === 'in_progress' ? 'completed' : 'queued';
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: next } : t));
    await updateTaskStatus(taskId, next);
  }

  async function handleRun(taskId: string) {
    setRunning(taskId);
    setRunNote('Aria is researching real businesses — this can take a minute…');
    const r = await runTask(taskId);
    setRunning(null);
    const tks = await getTasks();
    setTasks(tks);
    if (r.ok) {
      const cost = r.usage?.est_cost_usd != null ? ` (run cost ~$${r.usage.est_cost_usd.toFixed(2)})` : '';
      setRunNote(`Done — ${r.created_this_run?.leads ?? 0} new lead(s), ${r.created_this_run?.drafts ?? 0} draft(s) this run${cost}. Open the Leads page to review.`);
    } else if (r.quota_exceeded) {
      // In-character capacity message — an upsell, not an error.
      setRunNote(r.message ?? 'This employee has hit their monthly capacity.');
    } else {
      setRunNote(`Run failed: ${r.error ?? 'unknown error'}`);
    }
  }

  return (
    <div className="page-pad" style={{ padding: '32px 36px', animation: 'fadeIn 0.3s ease' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: '800', color: 'var(--text-primary)' }}>Tasks</h1>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '4px' }}>Assign and track work across your AI workforce.</p>
        </div>
        <button onClick={() => setShowModal(true)} style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '10px', padding: '10px 20px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>
          + Assign Task
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
        {[
          { label: 'Total', value: stats.total, color: 'var(--text-primary)' },
          { label: 'In Progress', value: stats.in_progress, color: '#6366f1' },
          { label: 'Queued', value: stats.queued, color: '#9ca3af' },
          { label: 'Completed', value: stats.completed, color: '#22c55e' },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', boxShadow: 'var(--shadow)', padding: '16px 20px' }}>
            <p style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '6px' }}>{s.label}</p>
            <p style={{ fontSize: '28px', fontWeight: '800', color: s.color, fontFamily: 'var(--font-geist-mono)' }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '10px', padding: '4px', width: 'fit-content' }}>
        {(['all', 'in_progress', 'queued', 'completed'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '7px 16px', borderRadius: '7px', border: 'none', cursor: 'pointer',
            fontSize: '12px', fontWeight: filter === f ? '700' : '400',
            background: filter === f ? 'var(--accent)' : 'transparent',
            color: filter === f ? '#fff' : 'var(--text-secondary)',
            transition: 'all 0.15s',
            textTransform: 'capitalize',
          }}>{f.replace('_', ' ')}</button>
        ))}
      </div>

      {runNote && (
        <div style={{ background: 'var(--accent-dim)', border: '1px solid #6366f130', borderRadius: '10px', padding: '11px 16px', marginBottom: '14px', fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          {running && <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--accent)', animation: 'pulse-green 1.2s infinite', flexShrink: 0 }} />}
          {runNote}
        </div>
      )}

      {/* Task List */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px', boxShadow: 'var(--shadow)', overflow: 'hidden' }}>
       <div className="scroll-x">
        <div style={{ minWidth: '700px' }}>
        {/* Table header */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 110px 90px 90px 100px 60px 84px', gap: '12px', padding: '12px 20px', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
          {['Task', 'Assigned To', 'Project', 'Priority', 'Status', 'Due', 'Run'].map(h => (
            <p key={h} style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: '700' }}>{h}</p>
          ))}
        </div>

        {filtered.length === 0 ? (
          <p style={{ padding: '40px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '13px' }}>No tasks here.</p>
        ) : filtered.map((t, i) => {
          const emp = employees.find(e => e.id === t.assigneeId);
          const open = expanded === t.id;
          return (
            <div key={t.id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none', opacity: t.status === 'completed' ? 0.6 : 1 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 110px 90px 90px 100px 60px 84px', gap: '12px', padding: '14px 20px', alignItems: 'center' }}>
              <button onClick={() => setExpanded(open ? null : t.id)} title="Tap for full detail" style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', minWidth: 0 }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: priorityColors[t.priority], flexShrink: 0 }} />
                <span style={{ fontSize: '13px', color: t.status === 'completed' ? 'var(--text-secondary)' : 'var(--text-primary)', textDecoration: t.status === 'completed' ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{shortTitle(t.title)}</span>
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {emp && <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: emp.color + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', fontWeight: '700', color: emp.color }}>{emp.avatar}</div>}
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{emp?.name}</span>
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{t.project}</span>
              <span style={{ fontSize: '11px', color: priorityColors[t.priority], textTransform: 'capitalize', fontWeight: '600' }}>{t.priority}</span>
              <button onClick={() => cycleStatus(t.id)} style={{ fontSize: '11px', color: statusColors[t.status], background: statusColors[t.status] + '20', padding: '3px 10px', borderRadius: '999px', fontWeight: '600', textTransform: 'capitalize', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                {t.status.replace('_', ' ')}
              </button>
              <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{t.dueDate}</span>
              <button
                onClick={() => handleRun(t.id)}
                disabled={running !== null}
                title="Have the assigned employee execute this task"
                style={{
                  fontSize: '11px', fontWeight: '700', padding: '5px 10px', borderRadius: '7px', border: 'none',
                  background: running === t.id ? 'var(--border)' : running !== null ? 'var(--border)' : 'var(--accent)',
                  color: running !== null ? 'var(--text-dim)' : '#fff',
                  cursor: running !== null ? 'default' : 'pointer', whiteSpace: 'nowrap',
                }}
              >
                {running === t.id ? '…' : '▶ Run'}
              </button>
            </div>
            {open && (
              <div style={{ padding: '0 20px 16px 36px', background: 'var(--bg)', animation: 'fadeIn 0.2s ease' }}>
                <p style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.6, paddingTop: '4px' }}>{t.title}</p>
                <div style={{ display: 'flex', gap: '18px', flexWrap: 'wrap', marginTop: '8px', fontSize: '11px', color: 'var(--text-dim)' }}>
                  {t.project && <span>Project: <span style={{ color: 'var(--text-secondary)' }}>{t.project}</span></span>}
                  <span>Owner: <span style={{ color: 'var(--text-secondary)' }}>{emp?.name ?? t.assigneeId}</span></span>
                  <span>Priority: <span style={{ color: priorityColors[t.priority] }}>{t.priority}</span></span>
                  {t.dueDate && <span>Due: <span style={{ color: 'var(--text-secondary)' }}>{t.dueDate}</span></span>}
                </div>
              </div>
            )}
            </div>
          );
        })}
        </div>
       </div>
      </div>

      {/* Assign Task Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: '#00000080', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px', boxShadow: 'var(--shadow)', width: '480px', overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)' }}>Assign Task</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '3px' }}>Route a task to an AI employee</p>
            </div>
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={labelStyle}>Task Title *</label>
                <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Research 20 leads in fintech" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Assign To *</label>
                <select value={form.assigneeId} onChange={e => setForm(p => ({ ...p, assigneeId: e.target.value }))} style={inputStyle}>
                  <option value="">— Select employee —</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.name} — {e.role}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>Project</label>
                  <input value={form.project} onChange={e => setForm(p => ({ ...p, project: e.target.value }))} placeholder="e.g. Q3 Outreach" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Priority</label>
                  <select value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value as Task['priority'] }))} style={inputStyle}>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>
              <div>
                <label style={labelStyle}>Due Date</label>
                <input type="date" value={form.dueDate} onChange={e => setForm(p => ({ ...p, dueDate: e.target.value }))} style={inputStyle} />
              </div>
            </div>
            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={() => setShowModal(false)} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 20px', color: 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
              <button onClick={addTask} style={{ background: 'var(--accent)', border: 'none', borderRadius: '8px', padding: '8px 20px', color: '#fff', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>Assign</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Short, human row title — first clause/sentence, capped — full detail lives behind
// tap-to-expand. Reads like polished SaaS, not a database row of wall-to-wall text.
function shortTitle(title: string): string {
  const t = (title || '').trim();
  const firstClause = t.split(/[.:\n—-]/)[0].trim() || t;
  const base = firstClause.length >= 12 ? firstClause : t;
  return base.length > 60 ? base.slice(0, 57).trimEnd() + '…' : base;
}

const labelStyle: React.CSSProperties = { fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '6px' };
const inputStyle: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '9px 12px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none', width: '100%' };
