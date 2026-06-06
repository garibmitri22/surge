import { createSupabaseServerClient } from '@/lib/supabase-server';
import { ACTIVE_EMPLOYEE_IDS } from '@/lib/departments.mjs';

// Hire (enable) an active employee on the company's team. Owner-authenticated.
// ENTITLEMENT SEAM: until Stripe ships, the owner can enable any active employee
// freely; when billing lands, gate here by plan (single = the one chosen employee,
// team = all). is_internal is always allowed. We just add the id to hired_employees.
export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  let body: { employeeId?: string };
  try { body = await request.json(); } catch { return new Response('Invalid JSON', { status: 400 }); }
  const employeeId = (body.employeeId || '').trim();
  if (!ACTIVE_EMPLOYEE_IDS.includes(employeeId)) {
    return Response.json({ ok: false, reason: 'not_hireable', message: 'That role isn’t available to hire yet.' }, { status: 400 });
  }

  const { data: company } = await supabase
    .from('companies').select('id, hired_employees, is_internal').order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (!company) return new Response('Complete onboarding first', { status: 400 });

  // --- Stripe entitlement check goes HERE (plan caps). Until then, allow. ---

  const current = Array.isArray(company.hired_employees) ? company.hired_employees : [];
  if (current.includes(employeeId)) {
    return Response.json({ ok: true, already: true, hired_employees: current });
  }
  const next = [...current, employeeId];
  const { error } = await supabase.from('companies').update({ hired_employees: next }).eq('id', company.id);
  if (error) return Response.json({ ok: false, reason: 'update_failed', message: error.message }, { status: 400 });

  await supabase.from('activity_log').insert({
    id: 'a' + Date.now() + Math.floor(Math.random() * 1000),
    company_id: company.id, employee_id: employeeId,
    action: `${employeeId.charAt(0).toUpperCase() + employeeId.slice(1)} joined the team`, detail: null, timestamp: 'just now', sort_order: Date.now(),
  });
  return Response.json({ ok: true, hired_employees: next });
}
