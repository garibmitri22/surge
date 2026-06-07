import { createSupabaseServerClient } from '@/lib/supabase-server';
import { resolveCanonicalCompanyId } from '@/lib/company-resolve';
import { after } from 'next/server';

// 300s (Pro ceiling). MUST be a static literal — a computed value fails Next's build-time
// segment-config validation. This endpoint only ACKs + kicks the run in after(), so it
// returns in well under a second regardless; the long ceiling just covers the after() kick.
export const maxDuration = 300;

// A claim older than this (with activated_at still null) means the prior activation run was
// killed before it could finish or clean up — safe to reclaim and retry. Set above the 60s
// serverless wall so we never yank a claim out from under a run that's genuinely in flight.
const STALE_CLAIM_MS = 90_000;

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

  // Resolve the user's ONE canonical company (not "most recent" — a stale re-onboarding
  // draft must never be the one we activate).
  const canonicalId = await resolveCanonicalCompanyId(supabase, user.id);
  const { data: company } = canonicalId
    ? await supabase.from('companies').select('id, onboarding_complete, activated_at').eq('id', canonicalId).maybeSingle()
    : { data: null };
  if (!company) return Response.json({ ok: false, reason: 'no_company' }, { status: 400 });
  if (!company.onboarding_complete) return Response.json({ ok: false, reason: 'not_onboarded' }, { status: 400 });
  if (company.activated_at) return Response.json({ ok: true, already: true });

  const companyId = company.id;
  const now = Date.now();
  const today = new Date().toISOString().slice(0, 10);

  // Atomic claim: a deterministic id means a concurrent/duplicate activation collides here
  // (PK 23505) so Aria's first run kicks exactly once.
  const taskId = 'act_' + companyId;
  const claimRow = {
    id: taskId, company_id: companyId, title: 'Find & score your first leads',
    assignee_id: 'aria', priority: 'high', project: 'Day-one activation', status: 'queued',
    created_at: today, due_date: today, sort_order: now,
  };
  const { error: claimErr } = await supabase.from('tasks').insert(claimRow);
  if (claimErr) {
    if (claimErr.code !== '23505') {
      return Response.json({ ok: false, reason: 'claim_failed', message: claimErr.message }, { status: 400 });
    }
    // A claim already exists. STALE-CLAIM RECLAIM: on Vercel Hobby the run can exceed the
    // 60s wall and be killed mid-flight — taking THIS endpoint down with it before its
    // failure-cleanup runs, leaving the claim behind with activated_at still null. Without
    // this, every later load would 23505 → "already in_progress" → never retry (the stuck-
    // at-3 bug). So: if the existing claim is older than the wall (a prior run must have
    // died — activated_at is still null, checked above), delete + re-create it and proceed
    // with a fresh run. A genuinely in-flight run (claim younger than the wall) still bails.
    const { data: existing } = await supabase
      .from('tasks').select('sort_order').eq('id', taskId).eq('company_id', companyId).maybeSingle();
    const claimAgeMs = existing?.sort_order ? now - Number(existing.sort_order) : Infinity;
    if (claimAgeMs < STALE_CLAIM_MS) return Response.json({ ok: true, already: true, in_progress: true });
    await supabase.from('tasks').delete().eq('id', taskId).eq('company_id', companyId);
    const { error: reclaimErr } = await supabase.from('tasks').insert(claimRow);
    if (reclaimErr) return Response.json({ ok: true, already: true, in_progress: true }); // lost a race — let the winner run
  }

  // Internal, authenticated calls (forward the session cookie) to the EXISTING engines,
  // comped via activation=true (valid only while activated_at is null — which it still is).
  const origin = new URL(request.url).origin;
  const cookie = request.headers.get('cookie') ?? '';
  const call = (path: string, payload: object) =>
    fetch(`${origin}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', cookie }, body: JSON.stringify(payload) })
      .then((r) => r.json()).catch(() => ({ ok: false }));

  // Does the owner have an uploaded past-customer list to also reactivate? (Read it now,
  // while we still have the request context, for the background kick below.)
  const { count: reactCount } = await supabase
    .from('leads').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('origin', 'reactivation');

  // ASYNC KICK — ack the browser immediately (no multi-minute hang) and fire Aria's first
  // run in the background via after(). The run ACKS fast then researches async within its
  // OWN maxDuration; it stamps companies.activated_at itself ON SUCCESS and releases this
  // act_<company> claim on failure/timeout — so activate no longer stamps or cleans up. Both
  // engines stay comped because activated_at remains null until the run finishes. The
  // dashboard shows "Aria's working…" and polls activation status + lead count, so leads
  // appear as they're written rather than all-or-nothing at the end.
  after(async () => {
    await call('/api/agent/run', { taskId, activation: true });
    if ((reactCount ?? 0) > 0) await call('/api/reactivation/draft', { activation: true });
  });

  return Response.json({ ok: true, activating: true });
}
