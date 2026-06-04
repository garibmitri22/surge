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
  return (data ?? []).map((r) => ({
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
  }));
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
