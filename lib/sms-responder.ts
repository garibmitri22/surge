import Anthropic from '@anthropic-ai/sdk';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { injectPricing } from '@/lib/pricing.mjs';
import { RESEARCH_MODEL } from '@/lib/usage-config.mjs';

// Aria's CONSUMER-facing SMS brain. Distinct from the owner-facing HQ chat prompt
// (lib/chat-prompt.mjs): here Aria texts a real prospect who just raised their hand,
// in the company's brand voice, to qualify and book — short, human, one question at a
// time. No tools, no owner framing, never fabricates. Haiku for speed + low cost (SMS
// is short and latency matters for speed-to-lead).

interface LeadCtx { business_name?: string | null; name?: string | null; notes?: string | null; }
interface ThreadMsg { direction: string; body: string | null; }

export async function ariaSmsReply(
  supabase: Awaited<ReturnType<typeof import('@/lib/supabase-server').createSupabaseServerClient>>,
  companyId: string,
  lead: LeadCtx,
  thread: ThreadMsg[],
): Promise<string | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;

  const { data: company } = await supabase.from('companies').select('company_name, industry, target_customers, brand_tone, main_goal, booking_url').eq('id', companyId).maybeSingle();
  const { data: memory } = await supabase.from('memory_entries').select('type, content').eq('company_id', companyId).in('type', ['voice', 'brand', 'offer', 'icp', 'process']).limit(14);

  let persona = '';
  try { persona = await readFile(path.join(process.cwd(), 'personas', 'aria.md'), 'utf8'); } catch { persona = ''; }

  const brandVoice = company?.brand_tone || (memory ?? []).filter((m) => ['voice', 'brand'].includes(m.type)).map((m) => m.content).join(' | ') || 'warm, clear, human';
  const offer = (memory ?? []).filter((m) => m.type === 'offer').map((m) => m.content).join(' | ');
  const leadName = lead.name?.split(' ')[0] || '';

  const system = injectPricing(`${persona || 'You are Aria, a sharp, warm sales rep.'}

=====================================================================
YOU ARE TEXTING A REAL PROSPECT (SMS) — they just reached out to ${company?.company_name || 'this business'} through an ad/form. This is speed-to-lead: respond like a real person on the team, fast.

THE BUSINESS: ${company?.company_name || 'the company'} — ${company?.industry || ''}. Serves: ${company?.target_customers || 'local customers'}.
BRAND VOICE (write in THIS voice): ${brandVoice}
${offer ? `WHAT THEY OFFER: ${offer}` : ''}
${company?.booking_url ? `BOOKING LINK (share when it's time to book): ${company.booking_url}` : 'BOOKING: offer to have someone call them or set a time; do not invent a link.'}

SMS RULES (binding):
- Keep it to 1-2 short sentences. Texting, not email. No greetings like "Dear", no signatures, no markdown, no emoji spam (one at most, only if on-brand).
- Sound like a real human on ${company?.company_name || 'the'} team in the brand voice above — never robotic, never "As an AI".
- ONE question per message. Move toward booking a call or visit. Be genuinely helpful first.
- NEVER fabricate prices, availability, results, or promises. If you don't know, say you'll have someone confirm.
- If they sound ready, offer to connect them with the team / set a time.
- Their first name (use naturally if known): ${leadName || 'unknown'}.`);

  const messages: Anthropic.MessageParam[] = [];
  if (thread.length === 0) {
    messages.push({ role: 'user', content: 'A new lead just came in and consented to texts. Write the FIRST text to them — warm, fast, one question to start the conversation.' });
  } else {
    // Replay the thread: their inbound = user, our outbound = assistant.
    for (const m of thread) {
      messages.push({ role: m.direction === 'inbound' ? 'user' : 'assistant', content: m.body || '' });
    }
    if (messages[messages.length - 1].role !== 'user') {
      messages.push({ role: 'user', content: '(write the next text in the conversation)' });
    }
  }

  try {
    const client = new Anthropic();
    const resp = await client.messages.create({
      model: RESEARCH_MODEL,
      max_tokens: 300,
      system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
      messages,
    });
    const text = resp.content.filter((b) => b.type === 'text').map((b) => (b as Anthropic.TextBlock).text).join('').trim();
    return text.slice(0, 480) || null; // keep within ~3 SMS segments
  } catch {
    return null;
  }
}
