import { createSupabaseServerClient } from '@/lib/supabase-server';

// Day-one activation — the moment onboarding completes, the team ALREADY goes to work.
// Server-side, no user action: create Aria's first task, run it COMPED (real research +
// drafts — never charged, never mock), queue a reactivation draft batch if the owner
// uploaded a list, then stamp activated_at. Idempotent + abuse-safe: a deterministic
// task id ('act_<company>') is the atomic claim — a second call collides and bails, so
// the comp fires exactly once. Nothing is sent — drafts land pending the owner's approval.

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const { data: company } = await supabase
    .from('companies').select('id, onboarding_complete, activated_at').order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (!company) return Response.json({ ok: false, reason: 'no_company' }, { status: 400 });
  if (!company.onboarding_complete) return Response.json({ ok: false, reason: 'not_onboarded' }, { status: 400 });
  if (company.activated_at) return Response.json({ ok: true, already: true });

  const companyId = company.id;
  const now = Date.now();
  const today = new Date().toISOString().slice(0, 10);

  // Atomic claim: deterministic id means a concurrent/duplicate activation collides here
  // (PK 23505) and we bail — so Aria's first run kicks exactly once.
  const taskId = 'act_' + companyId;
  const { error: claimErr } = await supabase.from('tasks').insert({
    id: taskId, company_id: companyId, title: 'Find & score your first leads',
    assignee_id: 'aria', priority: 'high', project: 'Day-one activation', status: 'queued',
    created_at: today, due_date: today, sort_order: now,
  });
  if (claimErr) {
    if (claimErr.code === '23505') return Response.json({ ok: true, already: true, in_progress: true });
    return Response.json({ ok: false, reason: 'claim_failed', message: claimErr.message }, { status: 400 });
  }

  // Internal, authenticated calls (forward the session cookie) to the EXISTING engines,
  // comped via activation=true (valid only while activated_at is null — which it still is).
  const origin = new URL(request.url).origin;
  const cookie = request.headers.get('cookie') ?? '';
  const call = (path: string, payload: object) =>
    fetch(`${origin}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', cookie }, body: JSON.stringify(payload) })
      .then((r) => r.json()).catch(() => ({ ok: false }));

  // 1. Aria's first prospecting run (real businesses for their ICP + drafts), comped.
  const run = await call('/api/agent/run', { taskId, activation: true });

  // 2. If they uploaded a past-customer list, also draft the reactivation batch (comped).
  let reactivation = null;
  const { count: reactCount } = await supabase
    .from('leads').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('origin', 'reactivation');
  if ((reactCount ?? 0) > 0) {
    reactivation = await call('/api/reactivation/draft', { activation: true });
  }

  // Stamp activated_at AFTER the comped runs (so the comp was valid during them) — this
  // closes the one-time comp window and marks day-one done.
  await supabase.from('companies').update({ activated_at: new Date().toISOString() }).eq('id', companyId);

  return Response.json({
    ok: true,
    leads: run?.created_this_run?.leads ?? 0,
    drafts: run?.created_this_run?.drafts ?? 0,
    reactivationDrafts: reactivation?.created_this_run?.drafts ?? 0,
    charged: 0,
  });
}
