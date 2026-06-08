import { supabase } from './supabase';
import { getMyCompanyId } from './company';

export interface ScorePart { points: number; reason: string }
export interface Lead {
  id: string;
  businessName: string;
  vertical: string;
  location: string | null;
  website: string | null;
  contactName: string | null;
  email: string | null;
  sourceUrl: string;
  score: number;
  scoreReasons: { icp_fit?: ScorePart; pain?: ScorePart; ability?: ScorePart; reachability?: ScorePart } | null;
  status: string;
  nextAction: string;
  nextActionAt: string;
  clickCount: number;
  firstClickedAt: string | null;
  bookedAt: string | null;
  // Inbound / speed-to-lead motion
  origin: string;            // 'researched' (cold B2B) | 'inbound' (this motion)
  phone: string | null;
  consentChannels: string[] | null;
  consentAt: string | null;
  source: string | null;
  firstTouchAt: string | null;
  relationship: string | null; // active-advertiser signal (cold) or past-relationship facts (reactivation)
  notes: string | null;
  createdAt: string;
}

export interface LeadMessage {
  id: string;
  direction: 'inbound' | 'outbound';
  channel: string;
  body: string | null;
  createdAt: string;
}

export interface LeadDraft {
  id: string;
  leadId: string;
  sequenceStep: number;
  subject: string;
  body: string;
  approvalStatus: string;
}

export async function getLeads(): Promise<Lead[]> {
  const companyId = await getMyCompanyId();
  if (!companyId) return [];
  const { data, error } = await supabase
    .from('leads').select('*').eq('company_id', companyId).order('score', { ascending: false });
  if (error) throw error;
  const mapped = (data ?? []).map((r) => ({
    id: r.id,
    businessName: r.business_name,
    vertical: r.vertical,
    location: r.location,
    website: r.website,
    contactName: r.contact_name,
    email: r.email,
    sourceUrl: r.source_url,
    score: r.score,
    scoreReasons: (r.score_reasons as Lead['scoreReasons']) ?? null,
    status: r.status,
    nextAction: r.next_action,
    nextActionAt: r.next_action_at,
    relationship: r.relationship ?? null,
    clickCount: r.click_count ?? 0,
    firstClickedAt: r.first_clicked_at ?? null,
    bookedAt: r.booked_at ?? null,
    origin: r.origin ?? 'researched',
    phone: r.phone ?? null,
    consentChannels: (r.consent_channels as string[] | null) ?? null,
    consentAt: r.consent_at ?? null,
    source: r.source ?? null,
    firstTouchAt: r.first_touch_at ?? null,
    notes: r.notes ?? null,
    createdAt: r.created_at,
  }));
  // Surface what needs a human NOW: un-responded inbound leads first (speed-to-lead),
  // then booked meetings, engaged, and warm (clicked); everyone else by score. Within
  // the time-sensitive tiers, freshest first.
  const rank = (l: Lead) =>
    l.origin === 'inbound' && !l.firstTouchAt ? 6 :
    l.status === 'meeting' ? 5 : l.status === 'engaged' ? 4 : l.status === 'warm' ? 3 :
    l.status === 'inbound' ? 2 : 0;
  return mapped.sort((a, b) => {
    const ra = rank(a), rb = rank(b);
    if (ra !== rb) return rb - ra;
    if (ra >= 2) return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(); // freshness
    return b.score - a.score;
  });
}

export async function getLeadMessages(leadId: string): Promise<LeadMessage[]> {
  const companyId = await getMyCompanyId();
  if (!companyId) return [];
  const { data, error } = await supabase
    .from('lead_messages').select('*').eq('company_id', companyId).eq('lead_id', leadId).order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => ({ id: r.id, direction: r.direction as 'inbound' | 'outbound', channel: r.channel, body: r.body, createdAt: r.created_at }));
}

export async function callLeadNow(leadId: string): Promise<{ ok: boolean; reason?: string; message?: string }> {
  const res = await fetch('/api/voice/call', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ leadId }) });
  try { return await res.json(); } catch { return { ok: false, reason: `HTTP ${res.status}` }; }
}

export async function getDrafts(): Promise<LeadDraft[]> {
  const companyId = await getMyCompanyId();
  if (!companyId) return [];
  const { data, error } = await supabase
    .from('lead_drafts').select('*').eq('company_id', companyId).order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    leadId: r.lead_id,
    sequenceStep: r.sequence_step,
    subject: r.subject,
    body: r.body,
    approvalStatus: r.approval_status,
  }));
}

export async function setDraftApproval(id: string, status: 'approved' | 'rejected'): Promise<void> {
  const companyId = await getMyCompanyId();
  if (!companyId) throw new Error('No company');
  const { error } = await supabase.from('lead_drafts').update({ approval_status: status }).eq('id', id).eq('company_id', companyId);
  if (error) throw error;
}

export async function getPipelineStats(): Promise<{ total: number; overdue: number }> {
  const leads = await getLeads();
  const now = Date.now();
  const overdue = leads.filter((l) => new Date(l.nextActionAt).getTime() < now && l.status !== 'disqualified' && l.status !== 'meeting').length;
  return { total: leads.length, overdue };
}

// ---- Manual CRM: the owner gets the wheel ---------------------------------------------------
// Owner-meaningful pipeline stages for the MOVE control (the full enum has a few system-only
// states too). 'won'/'lost'/'disqualified' are terminal. The label keeps copy in one place.
export const LEAD_STAGES = ['new', 'qualified', 'contacted', 'warm', 'meeting', 'won', 'lost', 'disqualified'] as const;
export function stageLabel(s: string): string {
  return ({ new: 'New', qualified: 'Qualified', drafted: 'Drafted', contacted: 'Contacted', warm: 'Warm', replied: 'Replied', meeting: 'Meeting', won: 'Won', lost: 'Lost', disqualified: 'Disqualified', recycled: 'Recycled', inbound: 'Inbound', engaged: 'Engaged' } as Record<string, string>)[s] || s;
}

async function logActivity(companyId: string, action: string, detail: string | null): Promise<void> {
  // Owner actions show in the activity feed; attributed to Atlas (the owner's chief of staff).
  await supabase.from('activity_log').insert({
    id: 'a' + Date.now() + Math.floor(Math.random() * 1000),
    company_id: companyId, employee_id: 'atlas', action, detail, timestamp: new Date().toISOString(), sort_order: Date.now(),
  }).then(() => {}, () => {});
}

// MOVE: set a lead's stage by hand. This is an OVERRIDE — manual_override=true tells Aria to
// respect it (no auto-recycle, no click re-promotion). Resilient if the column isn't live yet.
export async function updateLeadStatus(id: string, status: string, businessName?: string): Promise<void> {
  const companyId = await getMyCompanyId();
  if (!companyId) throw new Error('No company');
  let { error } = await supabase.from('leads').update({ status, manual_override: true }).eq('id', id).eq('company_id', companyId);
  if (error && (error.code === 'PGRST204' || error.code === '42703' || /manual_override/.test(error.message || ''))) {
    ({ error } = await supabase.from('leads').update({ status }).eq('id', id).eq('company_id', companyId));
  }
  if (error) throw error;
  await logActivity(companyId, `You moved ${businessName || 'a lead'} to ${stageLabel(status)}`, null);
}

// EDIT: correct Aria's data on a lead (name / email / phone / notes).
export async function updateLeadFields(
  id: string,
  fields: { businessName?: string; email?: string; phone?: string; notes?: string },
  businessName?: string,
): Promise<void> {
  const companyId = await getMyCompanyId();
  if (!companyId) throw new Error('No company');
  const row: { business_name?: string; email?: string | null; phone?: string | null; notes?: string | null } = {};
  if (fields.businessName !== undefined) row.business_name = fields.businessName.trim();
  if (fields.email !== undefined) row.email = fields.email.trim() || null;
  if (fields.phone !== undefined) row.phone = fields.phone.trim() || null;
  if (fields.notes !== undefined) row.notes = fields.notes.trim() || null;
  if (Object.keys(row).length === 0) return;
  const { error } = await supabase.from('leads').update(row).eq('id', id).eq('company_id', companyId);
  if (error) throw error;
  await logActivity(companyId, `You edited ${fields.businessName?.trim() || businessName || 'a lead'}`, null);
}

// DELETE: permanently remove a lead (cascades its drafts/links/messages). Replaces the SQL-editor
// workaround — the owner never touches raw SQL to clear junk again.
export async function deleteLead(id: string, businessName?: string): Promise<void> {
  const companyId = await getMyCompanyId();
  if (!companyId) throw new Error('No company');
  const { error } = await supabase.from('leads').delete().eq('id', id).eq('company_id', companyId);
  if (error) throw error;
  await logActivity(companyId, `You removed ${businessName || 'a lead'}`, null);
}

// BULK move/delete — clean a batch at once (all RLS-scoped to the owner's company).
export async function bulkMoveLeads(ids: string[], status: string): Promise<void> {
  const companyId = await getMyCompanyId();
  if (!companyId || ids.length === 0) return;
  let { error } = await supabase.from('leads').update({ status, manual_override: true }).in('id', ids).eq('company_id', companyId);
  if (error && (error.code === 'PGRST204' || error.code === '42703' || /manual_override/.test(error.message || ''))) {
    ({ error } = await supabase.from('leads').update({ status }).in('id', ids).eq('company_id', companyId));
  }
  if (error) throw error;
  await logActivity(companyId, `You moved ${ids.length} lead${ids.length === 1 ? '' : 's'} to ${stageLabel(status)}`, null);
}
export async function bulkDeleteLeads(ids: string[]): Promise<void> {
  const companyId = await getMyCompanyId();
  if (!companyId || ids.length === 0) return;
  const { error } = await supabase.from('leads').delete().in('id', ids).eq('company_id', companyId);
  if (error) throw error;
  await logActivity(companyId, `You removed ${ids.length} lead${ids.length === 1 ? '' : 's'}`, null);
}

export async function runTask(taskId: string): Promise<{
  ok: boolean;
  error?: string;
  quota_exceeded?: boolean;
  created_this_run?: { leads: number; drafts: number };
  usage?: { runs_used?: number; runs_limit?: number; period?: string; est_cost_usd?: number };
  message?: string;
}> {
  const res = await fetch('/api/agent/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ taskId }),
  });
  try { return await res.json(); } catch { return { ok: false, error: `HTTP ${res.status}` }; }
}
