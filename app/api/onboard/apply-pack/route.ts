import { createSupabaseServerClient } from '@/lib/supabase-server';
import { getVertical } from '@/lib/verticals';
import { PROFILE_MEMORY_TYPES } from '@/lib/chat-prompt.mjs';

// Apply a vertical pack at onboarding: prefill the company brain (icp/offer/voice/goal
// singletons), seed message-template + scoring-tilt 'process' entries, set the industry,
// and seed Nova's content library — all EDITABLE starting points the owner confirms with
// Atlas, never locked. Data-driven: any pack from lib/verticals works, no per-vertical code.

type SupabaseServer = Awaited<ReturnType<typeof createSupabaseServerClient>>;
const todayStr = () => new Date().toISOString().slice(0, 10);

async function getOrCreateDraftCompany(supabase: SupabaseServer, userId: string): Promise<string | null> {
  const { data: existing } = await supabase.from('companies').select('id').order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (existing) return existing.id;
  const { data } = await supabase.from('companies').insert({ user_id: userId, onboarding_complete: false }).select('id').single();
  return data?.id ?? null;
}

// Upsert a singleton brain entry (icp/offer/voice/goal) — mirrors the chat route so a
// later Atlas confirmation UPDATES the same row instead of duplicating.
async function upsertSingleton(supabase: SupabaseServer, companyId: string, type: string, title: string, content: string) {
  const now = Date.now();
  if (PROFILE_MEMORY_TYPES.includes(type)) {
    const { data: rows } = await supabase.from('memory_entries').select('id').eq('company_id', companyId).eq('type', type).order('sort_order', { ascending: false });
    if (rows && rows.length > 0) {
      await supabase.from('memory_entries').update({ title, content, tags: ['pack'], updated_at: todayStr(), sort_order: now }).eq('id', rows[0].id);
      const stale = rows.slice(1).map((r) => r.id);
      if (stale.length) await supabase.from('memory_entries').delete().in('id', stale);
      return;
    }
  }
  await supabase.from('memory_entries').insert({
    id: 'm' + now + Math.floor(Math.random() * 1000),
    company_id: companyId, type, title, content, tags: ['pack'], updated_at: todayStr(), sort_order: now,
  });
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  let body: { packId?: string };
  try { body = await request.json(); } catch { return new Response('Invalid JSON', { status: 400 }); }
  const pack = getVertical((body.packId || '').trim());
  if (!pack) return Response.json({ ok: false, reason: 'unknown_pack' }, { status: 400 });

  const companyId = await getOrCreateDraftCompany(supabase, user.id);
  if (!companyId) return new Response('Could not resolve company', { status: 400 });

  // 1. Industry on the profile.
  await supabase.from('companies').update({ industry: pack.industry }).eq('id', companyId);

  // 2. The four required brain singletons (confirm-not-fill).
  for (const m of pack.memory) await upsertSingleton(supabase, companyId, m.type, m.title, m.content);

  // 3. Templates + scoring tilt as 'process' brain entries. Re-applying replaces the
  //    pack-seeded ones (tagged 'pack') so a switch of vertical doesn't pile up.
  const { data: oldProc } = await supabase.from('memory_entries').select('id, tags').eq('company_id', companyId).eq('type', 'process');
  const packProc = (oldProc ?? []).filter((r) => Array.isArray(r.tags) && (r.tags as string[]).includes('pack')).map((r) => r.id);
  if (packProc.length) await supabase.from('memory_entries').delete().in('id', packProc);

  const procEntries = [
    ...pack.templates,
    { title: 'Lead-scoring tilt', content: pack.scoringTilt },
  ];
  let seq = Date.now();
  for (const p of procEntries) {
    await supabase.from('memory_entries').insert({
      id: 'm' + (seq++) + Math.floor(Math.random() * 1000),
      company_id: companyId, type: 'process', title: p.title, content: p.content, tags: ['pack'], updated_at: todayStr(), sort_order: seq,
    });
  }

  // 4. Seed Nova's content library (only when empty — never clobber real work).
  const { count } = await supabase.from('content_pieces').select('id', { count: 'exact', head: true }).eq('company_id', companyId);
  let contentSeeded = 0;
  if ((count ?? 0) === 0 && pack.content.length) {
    const { error } = await supabase.from('content_pieces').insert(
      pack.content.map((c) => ({ company_id: companyId, employee_id: 'nova', type: c.type, platform: c.platform, title: c.title, body: c.body, status: 'draft', brief: c.brief })),
    );
    if (!error) contentSeeded = pack.content.length;
  }

  return Response.json({
    ok: true, pack: pack.id, industry: pack.industry,
    seeded: { memory: pack.memory.length, templates: procEntries.length, content: contentSeeded },
  });
}
