// Surge — automatic memory extraction. After every chat turn, a cheap Haiku pass
// reads the exchange and pulls out the DURABLE pieces worth keeping in the company
// brain (so the moat compounds without relying on the model choosing to call
// remember_detail). Plain ESM so the route + a verify script share it.
//
// Conservative by design: it returns ONLY new, durable facts; chit-chat, task
// mechanics, and anything already known are skipped. The caller persists results
// through the same upsert path remember_detail uses (no duplicates).

import Anthropic from '@anthropic-ai/sdk';

const EXTRACT_MODEL = 'claude-haiku-4-5';

export const MEMORY_KINDS = [
  'icp', 'offer', 'proof', 'voice', 'goal', 'brand-kit', 'process',
  'decision', 'open-loop', 'idea', 'rapport', 'note',
];

const emitTool = {
  name: 'emit_memories',
  description: 'Return the durable facts from this exchange worth saving to the company brain. Return an EMPTY array if there is nothing durable.',
  input_schema: {
    type: 'object',
    properties: {
      memories: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            kind: { type: 'string', enum: MEMORY_KINDS, description: 'icp (ideal customer), offer (what they sell/pricing), proof (real result/testimonial), voice (brand tone/banned words), goal (a business goal), brand-kit (colors/logo), process (an SOP/how-to), decision (a choice + reasoning), open-loop (a commitment to track), idea (worth revisiting), rapport (a personal detail about the owner), note (anything else durable).' },
            title: { type: 'string', description: 'Short label (e.g. "Prefers blunt feedback", "Target: med spas in Conroe").' },
            content: { type: 'string', description: 'The fact in full, self-contained, written so a teammate reading it later understands it.' },
          },
          required: ['kind', 'title', 'content'],
        },
      },
    },
    required: ['memories'],
  },
};

/**
 * Extract durable memories from one chat exchange. Never throws (returns [] on any
 * failure) so it can run best-effort after a turn without affecting the user.
 * @param {{ apiKey?: string, employeeName?: string, companyName?: string|null, userText: string, assistantText?: string, existingTitles?: string[] }} opts
 * @returns {Promise<{kind:string,title:string,content:string}[]>}
 */
export async function extractMemories({ apiKey, employeeName, companyName, userText, assistantText, existingTitles = [] }) {
  if (!apiKey || !userText) return [];
  const client = new Anthropic({ apiKey });

  const system = `You capture the company's long-term memory. From the exchange between the owner and ${employeeName || 'an AI employee'}${companyName ? ` at ${companyName}` : ''}, extract ONLY durable facts worth remembering for future conversations and work.

SAVE: the owner's stated preferences, decisions and why, goals, ideal-customer details, offer/pricing facts, brand voice or banned words, real proof points, processes/SOPs, commitments to follow up, genuinely useful ideas, and personal rapport details about the owner.
DO NOT SAVE: pleasantries, the AI's own suggestions or filler, task mechanics ("I queued that"), questions, speculation, or anything already known.
DO NOT INVENT. Only facts actually present in the exchange. If a fact is already covered by an existing entry below, skip it.
Be conservative — an empty list is the right answer for a small-talk turn. Keep each memory tight and self-contained.

ALREADY IN MEMORY (skip anything equivalent):
${existingTitles.length ? existingTitles.map((t) => `- ${t}`).join('\n') : '(nothing yet)'}`;

  const content = `OWNER said:\n${userText}\n\n${employeeName || 'EMPLOYEE'} replied:\n${assistantText || '(no reply captured)'}`;

  try {
    const resp = await client.messages.create({
      model: EXTRACT_MODEL,
      max_tokens: 900,
      system,
      tools: [emitTool],
      tool_choice: { type: 'tool', name: 'emit_memories' },
      messages: [{ role: 'user', content }],
    });
    const block = resp.content.find((b) => b.type === 'tool_use' && b.name === 'emit_memories');
    const list = (block?.input?.memories ?? []);
    return Array.isArray(list)
      ? list
          .filter((m) => m && typeof m.content === 'string' && m.content.trim())
          .map((m) => ({ kind: MEMORY_KINDS.includes(m.kind) ? m.kind : 'note', title: String(m.title || '').slice(0, 120), content: String(m.content).slice(0, 2000) }))
      : [];
  } catch {
    return [];
  }
}
