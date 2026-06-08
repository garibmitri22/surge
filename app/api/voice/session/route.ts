import { createSupabaseServerClient } from '@/lib/supabase-server';
import { agentId, isAgentConfigured } from '@/lib/voices.mjs';

// JARVIS Phase 3 — start a live, interruptible Atlas conversation. The ElevenLabs Agent is fully
// configured (persona + greeting + Gemini LLM + Eric voice) in the ElevenLabs dashboard, so we
// just authorize a private session and hand the browser a signed URL — the agent runs itself.
// User-authed (live ConvAI minutes are metered, so only a signed-in owner can start one).
export const runtime = 'nodejs';
export const maxDuration = 20;

export async function POST() {
  if (!isAgentConfigured()) {
    return Response.json({ ok: false, reason: 'not_configured' }, { status: 503 });
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  // Authorize a private-agent conversation (keeps the agent non-public; one-shot signed URL).
  try {
    const resp = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(agentId())}`,
      { headers: { 'xi-api-key': String(process.env.ELEVENLABS_API_KEY).trim() } },
    );
    if (!resp.ok) return Response.json({ ok: false, reason: 'signed_url_failed', status: resp.status }, { status: 502 });
    const data = await resp.json();
    const signedUrl = data?.signed_url || data?.signedUrl || '';
    if (!signedUrl) return Response.json({ ok: false, reason: 'no_signed_url' }, { status: 502 });
    return Response.json({ ok: true, signedUrl });
  } catch {
    return Response.json({ ok: false, reason: 'elevenlabs_unreachable' }, { status: 502 });
  }
}
