import { supabase } from './supabase';
import { getMyCompanyId } from './company';

// Nova's Studio data layer — mirrors lib/leads.ts. Content lives in our DB (the moat);
// P1 is draft → approve/edit/archive, nothing published.

export type ContentType = 'post' | 'script' | 'ugc_brief' | 'caption';
export type ContentStatus = 'draft' | 'approved' | 'archived';

export interface ContentPiece {
  id: string;
  type: ContentType;
  platform: string;
  title: string;
  body: string;
  status: ContentStatus;
  brief: string | null;
  createdAt: string;
}

export async function getContentPieces(): Promise<ContentPiece[]> {
  const companyId = await getMyCompanyId();
  if (!companyId) return [];
  const { data, error } = await supabase
    .from('content_pieces').select('*').eq('company_id', companyId).order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    type: r.type as ContentType,
    platform: r.platform,
    title: r.title,
    body: r.body,
    status: r.status as ContentStatus,
    brief: r.brief,
    createdAt: r.created_at,
  }));
}

export async function setContentStatus(id: string, status: ContentStatus): Promise<void> {
  const companyId = await getMyCompanyId();
  if (!companyId) throw new Error('No company');
  const { error } = await supabase
    .from('content_pieces').update({ status }).eq('id', id).eq('company_id', companyId);
  if (error) throw error;
}

export async function updateContentBody(id: string, title: string, body: string): Promise<void> {
  const companyId = await getMyCompanyId();
  if (!companyId) throw new Error('No company');
  const { error } = await supabase
    .from('content_pieces').update({ title, body }).eq('id', id).eq('company_id', companyId);
  if (error) throw error;
}

export interface StudioRunResult {
  ok: boolean;
  reason?: string;
  message?: string;
  out_of_hours?: boolean;
  created_this_run?: { pieces: number };
  error?: string;
}

export async function runStudio(angle: string): Promise<StudioRunResult> {
  const res = await fetch('/api/studio/run', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ angle }),
  });
  try { return await res.json(); } catch { return { ok: false, error: `HTTP ${res.status}` }; }
}
