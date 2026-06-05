import { createSupabaseServerClient } from '@/lib/supabase-server';
import { deliverDraft } from '@/lib/email.mjs';

// Owner approves (or rejects) a drafted email. Approval is consent to send: we mark
// the draft approved and attempt delivery immediately. Warmup caps, the suppression
// list, and the CAN-SPAM address gate all live inside sendEmail/deliverDraft — if the
// daily warmup cap is hit, the draft stays 'approved' and the heartbeat drip sends it
// on a later day. Nothing sends without explicit approval. (CEO mandate.)
export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  let body: { draftId?: string; action?: string };
  try { body = await request.json(); } catch { return new Response('Invalid JSON', { status: 400 }); }
  const draftId = (body.draftId || '').trim();
  const action = (body.action || '').trim();
  if (!draftId || !['approve', 'reject'].includes(action)) return new Response('draftId and action (approve|reject) required', { status: 400 });

  const { data: company } = await supabase
    .from('companies').select('id').order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (!company) return new Response('No company', { status: 400 });

  // Verify the draft belongs to this company (RLS also enforces it).
  const { data: draft } = await supabase
    .from('lead_drafts').select('id').eq('id', draftId).eq('company_id', company.id).maybeSingle();
  if (!draft) return new Response('Draft not found', { status: 404 });

  if (action === 'reject') {
    await supabase.from('lead_drafts').update({ approval_status: 'rejected' }).eq('id', draftId);
    return Response.json({ ok: true, status: 'rejected' });
  }

  // Approve = queued to send. Mark approved, then try to deliver now (warmup-gated).
  await supabase.from('lead_drafts').update({ approval_status: 'approved' }).eq('id', draftId);
  const r = await deliverDraft(supabase, company.id, draftId);
  if (r.ok) return Response.json({ ok: true, status: 'sent' });
  // Couldn't send yet — stays approved. Tell the owner why, in plain terms.
  const reason = (r as { reason?: string }).reason ?? '';
  const REASONS: Record<string, string> = {
    email_not_configured: 'Email isn’t connected yet — approved and will send once it’s live.',
    no_physical_address: 'Add your business mailing address in Settings to send (required by law). Approved for now.',
    no_recipient_email: 'This lead has no email address yet. Approved, but can’t send until one is found.',
    suppressed: 'This recipient unsubscribed — not sending. Marked approved.',
    warmup_cap: 'Aria is at today’s warmup send limit. Approved — it sends on the next available day.',
    provider_error: 'The email provider rejected the send (the domain may still be verifying). Approved; we’ll retry.',
  };
  return Response.json({ ok: true, status: 'approved', sent: false, reason, message: REASONS[reason] ?? 'Approved; will send when possible.' });
}
