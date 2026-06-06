import { createSupabaseServerClient } from '@/lib/supabase-server';

// Join the waitlist for a pipeline employee (the visible expansion path). Owner-auth.
// Idempotent: one signup per role per company (PK). Captured for demand signal.
const PIPELINE_IDS = ['recruiter', 'cs', 'ea', 'pm', 'finance'];

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  let body: { roleId?: string };
  try { body = await request.json(); } catch { return new Response('Invalid JSON', { status: 400 }); }
  const roleId = (body.roleId || '').trim();
  if (!PIPELINE_IDS.includes(roleId)) return Response.json({ ok: false, reason: 'bad_role' }, { status: 400 });

  const { data: company } = await supabase
    .from('companies').select('id').order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (!company) return new Response('Complete onboarding first', { status: 400 });

  // Idempotent insert (ignore the duplicate-key error on a repeat signup).
  const { error } = await supabase.from('waitlist_signups').insert({ company_id: company.id, role_id: roleId });
  if (error && error.code !== '23505') return Response.json({ ok: false, reason: 'insert_failed', message: error.message }, { status: 400 });
  return Response.json({ ok: true, roleId });
}
