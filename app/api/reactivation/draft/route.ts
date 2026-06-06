import Anthropic from '@anthropic-ai/sdk';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { estCostUsd, WRITING_MODEL } from '@/lib/usage-config.mjs';
import { injectPricing, PRICE_SINGLE } from '@/lib/pricing.mjs';
import { gateWork, debitHours, estimateHours } from '@/lib/hours.mjs';
import { embedTrackedCta } from '@/lib/email.mjs';
import { trackedLinkUrl } from '@/lib/sign.mjs';
import { segmentOf } from '@/lib/reactivation.mjs';

// Aria drafts personalized reactivation outreach over the owner's EXISTING list (known
// past customers / unclosed quotes), segmented + in the company's brand voice, each with
// ONE tracked CTA (reuse the wedge's signed link → click promotes to warm → owner ping).
// Drafts are pending approval — nothing sends here. Metered once per run (reactivation_run),
// 0 on a thin/failed run. The send path is the EXISTING deliverDraft (email warmup drip).

const MAX_DRAFTS = 25;

export async function POST() {
  if (!process.env.ANTHROPIC_API_KEY) return new Response('ANTHROPIC_API_KEY is not set on the server.', { status: 500 });
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const { data: company } = await supabase.from('companies').select('*').order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (!company) return new Response('Complete onboarding first', { status: 400 });
  const companyId = company.id as string;

  const gate = await gateWork(supabase, companyId, 'reactivation_run', 'Aria');
  if (!gate.ok) {
    return Response.json({ ok: false, out_of_hours: true, message: gate.message, created_this_run: { drafts: 0 } }, { status: 402 });
  }

  // Reactivation leads that don't already have a draft. Prioritize higher past value.
  const { data: leads } = await supabase.from('leads')
    .select('id, business_name, email, status, past_value, last_seen_at, relationship, notes')
    .eq('company_id', companyId).eq('origin', 'reactivation')
    .order('past_value', { ascending: false, nullsFirst: false }).limit(120);
  const candidates = (leads ?? []).filter((l) => l.email);
  if (candidates.length === 0) {
    await debitHours(supabase, companyId, 0, 'Reactivation run (thin)', { employeeId: 'aria' });
    return Response.json({ ok: true, created_this_run: { drafts: 0 }, message: 'No reactivation contacts with an email yet — import a list first.' });
  }
  const { data: existingDrafts } = await supabase.from('lead_drafts').select('lead_id').eq('company_id', companyId);
  const drafted = new Set((existingDrafts ?? []).map((d) => d.lead_id));
  const todo = candidates.filter((l) => !drafted.has(l.id)).slice(0, MAX_DRAFTS);

  const { data: memory } = await supabase.from('memory_entries').select('type, content').eq('company_id', companyId).in('type', ['voice', 'brand', 'offer', 'icp']).limit(12);
  const brandVoice = company.brand_tone || (memory ?? []).filter((m) => ['voice', 'brand'].includes(m.type)).map((m) => m.content).join(' | ') || 'warm, friendly, human';
  const offer = (memory ?? []).filter((m) => m.type === 'offer').map((m) => m.content).join(' | ');

  let persona = '';
  try { persona = await readFile(path.join(process.cwd(), 'personas', 'aria.md'), 'utf8'); } catch { persona = ''; }

  const client = new Anthropic();
  const runId = randomUUID();
  const cost = { usd: 0 };
  async function recordUsage(usage: Anthropic.Usage | null | undefined) {
    if (!usage) return;
    const est = estCostUsd({ model: WRITING_MODEL, input_tokens: (usage.input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0), cache_read_tokens: usage.cache_read_input_tokens ?? 0, output_tokens: usage.output_tokens ?? 0 });
    cost.usd = +(cost.usd + est).toFixed(5);
    await supabase.from('usage_log').insert({ company_id: companyId, employee_id: 'aria', run_id: runId, model: WRITING_MODEL, input_tokens: usage.input_tokens ?? 0, cache_read_tokens: usage.cache_read_input_tokens ?? 0, output_tokens: usage.output_tokens ?? 0, web_searches: 0, est_cost_usd: est });
  }

  const system = injectPricing(`${persona || 'You are Aria, a sharp, warm sales rep.'}

=====================================================================
REACTIVATION MODE — you are writing to the business's OWN past customers / old quotes
(an established relationship), not cold prospects. Win back the relationship, don't pitch
a stranger. Company: ${company.company_name} (${company.industry || ''}). Serves: ${company.target_customers || ''}.
BRAND VOICE (write in it): ${brandVoice}
${offer ? `CURRENT OFFER to bring them back: ${offer}` : ''}

RULES: under 90 words, warm and specific, reference the relationship ("it's been a while since your [service]"), ONE clear ask, no pressure. NEVER fabricate prices/results. End with a single CTA line containing the literal placeholder {{CTA_URL}} exactly once (e.g. "Want to get back on the calendar? {{CTA_URL}}"). Output ONLY via the emit_email tool.`);

  const emit: Anthropic.Tool = { name: 'emit_email', description: 'Return the finished reactivation email.', input_schema: { type: 'object', properties: { subject: { type: 'string' }, body: { type: 'string' } }, required: ['subject', 'body'] } };

  let drafts = 0;
  try {
    for (const lead of todo) {
      const seg = segmentOf({ status: lead.status, amount: lead.past_value != null ? String(lead.past_value) : '' });
      const facts = `Contact: ${lead.business_name}\nSegment: ${seg}\nRelationship: ${lead.relationship ?? 'past contact'}\nLast seen: ${lead.last_seen_at ?? 'unknown'}\nPast value: ${lead.past_value != null ? `$${lead.past_value}` : 'unknown'}`;
      let subject = '', body = '';
      try {
        const resp = await client.messages.create({
          model: WRITING_MODEL, max_tokens: 600,
          system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
          tools: [emit], tool_choice: { type: 'tool', name: 'emit_email' },
          messages: [{ role: 'user', content: `Write ONE reactivation email for this past contact (offer them a reason to come back; we're worth more than a ${'$' + PRICE_SINGLE} tool but keep it human).\n\n${facts}` }],
        });
        await recordUsage(resp.usage);
        const block = resp.content.find((b) => b.type === 'tool_use') as Anthropic.ToolUseBlock | undefined;
        const out = (block?.input ?? {}) as { subject?: string; body?: string };
        subject = (out.subject ?? '').trim(); body = (out.body ?? '').trim();
      } catch { continue; }
      if (!subject || !body) continue;
      try { body = embedTrackedCta(body, trackedLinkUrl(lead.id, companyId)); } catch { /* leave as-is */ }
      const { error } = await supabase.from('lead_drafts').insert({ lead_id: lead.id, company_id: companyId, channel: 'email', sequence_step: 1, subject, body, approval_status: 'pending' });
      if (error) continue;
      await supabase.from('leads').update({ status: 'drafted' }).eq('id', lead.id).eq('company_id', companyId);
      drafts++;
    }

    const charged = drafts === 0 ? 0 : estimateHours('reactivation_run');
    const balance = await debitHours(supabase, companyId, charged, 'Reactivation drafting run', { employeeId: 'aria', refType: 'reactivation', refId: runId });
    if (charged > 0) {
      await supabase.from('activity_log').insert({ id: 'a' + Date.now() + Math.floor(Math.random() * 1000), company_id: companyId, employee_id: 'aria', action: `Drafted ${drafts} reactivation message${drafts > 1 ? 's' : ''} for your approval`, detail: null, timestamp: 'just now', sort_order: Date.now() });
    }
    return Response.json({ ok: true, created_this_run: { drafts }, hours: { charged, balance }, usage: { est_cost_usd: cost.usd } });
  } catch (err) {
    return Response.json({ ok: false, error: err instanceof Error ? err.message : 'Run failed', created_this_run: { drafts }, hours: { charged: 0 } }, { status: 500 });
  }
}
