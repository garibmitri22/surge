import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase';
import { verifyVoiceToken, voiceTools, executeVoiceTool } from '@/lib/atlas-brain';

// JARVIS Phase 3 — the custom-LLM webhook. ElevenLabs' Agent calls this OpenAI-compatible
// /v1/chat/completions endpoint every turn; we run ATLAS's real Claude brain (with tools that
// write to the owner's company) and stream the spoken reply back as OpenAI SSE. ElevenLabs
// only ever sees the final text — tools execute inside this endpoint.
//
// This route is reached server-to-server (no user cookie). /api/voice/* is public in proxy.ts,
// so auth here is: a shared secret header (the agent's configured key) PLUS a signed session
// token (in elevenlabs_extra_body) that identifies the tenant. Both required.
export const runtime = 'nodejs';
export const maxDuration = 60;

const MODEL = process.env.VOICE_LLM_MODEL || 'claude-haiku-4-5'; // fast = low-latency turns
const MAX_ITERATIONS = 4;

interface OAIMessage { role: string; content?: unknown }

function textFromContent(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map((p) => (typeof p === 'string' ? p : (p && typeof p === 'object' && 'text' in p ? String((p as { text: unknown }).text) : ''))).join(' ');
  }
  return '';
}

export async function POST(request: Request) {
  // 1. Shared-secret gate (defense in depth — only our configured agent should reach this).
  const secret = process.env.VOICE_LLM_SECRET;
  if (secret) {
    const auth = request.headers.get('authorization') || '';
    if (auth !== `Bearer ${secret}`) return new Response('Unauthorized', { status: 401 });
  }

  let body: { messages?: OAIMessage[]; elevenlabs_extra_body?: { surge_token?: string } };
  try { body = await request.json(); } catch { return new Response('Invalid JSON', { status: 400 }); }

  // 2. Tenant identity (signed token relayed via elevenlabs_extra_body).
  const tok = verifyVoiceToken(body.elevenlabs_extra_body?.surge_token);
  if (!tok) return new Response('Unauthorized', { status: 401 });
  const companyId = tok.companyId;

  if (!process.env.ANTHROPIC_API_KEY) return new Response('LLM not configured', { status: 500 });

  // Service-role client so tools can write with no user session (scoped by explicit company_id,
  // same discipline as the cron). If absent, Atlas can still talk — tools just report they can't act.
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const db = serviceKey
    ? createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, { auth: { persistSession: false } })
    : null;

  // 3. Map the OpenAI request → Anthropic. ElevenLabs forwards our overridden system prompt as
  // the leading system message(s); the rest is the live transcript.
  const incoming = Array.isArray(body.messages) ? body.messages : [];
  const systemText = incoming.filter((m) => m.role === 'system').map((m) => textFromContent(m.content)).join('\n\n').trim()
    || 'You are Atlas, a calm, concise chief of staff speaking out loud. Keep replies to one to three sentences.';
  const convo: Anthropic.MessageParam[] = incoming
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({ role: m.role === 'assistant' ? 'assistant' as const : 'user' as const, content: textFromContent(m.content) }))
    .filter((m) => m.content.trim().length > 0);
  while (convo.length && convo[0].role !== 'user') convo.shift();
  if (convo.length === 0) convo.push({ role: 'user', content: '(start)' });

  const tools = voiceTools() as Anthropic.Tool[];
  const client = new Anthropic();
  const enc = new TextEncoder();
  const id = 'chatcmpl-' + Date.now();
  const created = Math.floor(Date.now() / 1000);
  const chunk = (delta: Record<string, unknown>, finish: string | null = null) =>
    enc.encode(`data: ${JSON.stringify({ id, object: 'chat.completion.chunk', created, model: 'surge-atlas', choices: [{ index: 0, delta, finish_reason: finish }] })}\n\n`);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        controller.enqueue(chunk({ role: 'assistant' })); // OpenAI opening chunk
        for (let i = 0; i < MAX_ITERATIONS; i++) {
          const turn = client.messages.stream({
            model: MODEL,
            max_tokens: 1024,
            system: [{ type: 'text', text: systemText, cache_control: { type: 'ephemeral' } }],
            tools,
            messages: convo,
          });
          turn.on('text', (delta) => controller.enqueue(chunk({ content: delta })));
          const final = await turn.finalMessage();
          convo.push({ role: 'assistant', content: final.content });

          if (final.stop_reason === 'tool_use') {
            const results: Anthropic.ToolResultBlockParam[] = [];
            for (const block of final.content) {
              if (block.type === 'tool_use') {
                const result = db
                  ? await executeVoiceTool(db, companyId, block.name, block.input as Record<string, unknown>)
                  : "I couldn't make that change right now — the action backend isn't wired up.";
                results.push({ type: 'tool_result', tool_use_id: block.id, content: result });
              }
            }
            convo.push({ role: 'user', content: results });
            continue; // let Atlas confirm in natural speech
          }
          break; // end_turn
        }
        controller.enqueue(chunk({}, 'stop'));
        controller.enqueue(enc.encode('data: [DONE]\n\n'));
      } catch (e) {
        // Stream a graceful spoken fallback so the call never dead-airs on an error.
        controller.enqueue(chunk({ content: ' Sorry — I hit a snag on my end. Say that again?' }));
        controller.enqueue(chunk({}, 'stop'));
        controller.enqueue(enc.encode('data: [DONE]\n\n'));
        void e;
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache, no-transform', connection: 'keep-alive' },
  });
}
