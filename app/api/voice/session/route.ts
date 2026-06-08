import { createSupabaseServerClient } from '@/lib/supabase-server';
import { resolveCanonicalCompanyId } from '@/lib/company-resolve';
import { voiceFor, agentId, isAgentConfigured } from '@/lib/voices.mjs';
import { loadAtlasContext, signVoiceToken } from '@/lib/atlas-brain';

// JARVIS Phase 3 — start a live hands-free Atlas conversation. User-authed (like
// /api/voice/call). Builds Atlas's REAL system prompt + a proactive greeting, mints a
// short-lived identity token, and returns a signed ElevenLabs URL + per-session overrides.
// The browser passes the token via customLlmExtraBody so /api/voice/llm knows the tenant.
export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST() {
  if (!isAgentConfigured()) {
    return Response.json({ ok: false, reason: 'not_configured' }, { status: 503 });
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const companyId = await resolveCanonicalCompanyId(supabase, user.id);
  if (!companyId) return Response.json({ ok: false, reason: 'no_company' }, { status: 400 });

  const ownerName = String(user.user_metadata?.full_name || user.user_metadata?.name || '').trim();
  const { system, greeting } = await loadAtlasContext(supabase, companyId, ownerName);
  const token = signVoiceToken({ userId: user.id, companyId, ttlSeconds: 3600 });

  // Authorize a private-agent conversation (the signed URL keeps the agent non-public).
  let signedUrl = '';
  try {
    const resp = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(agentId())}`,
      { headers: { 'xi-api-key': String(process.env.ELEVENLABS_API_KEY).trim() } },
    );
    if (!resp.ok) {
      return Response.json({ ok: false, reason: 'signed_url_failed', status: resp.status }, { status: 502 });
    }
    const data = await resp.json();
    signedUrl = data?.signed_url || data?.signedUrl || '';
  } catch {
    return Response.json({ ok: false, reason: 'elevenlabs_unreachable' }, { status: 502 });
  }
  if (!signedUrl) return Response.json({ ok: false, reason: 'no_signed_url' }, { status: 502 });

  const v = voiceFor('atlas');
  return Response.json({
    ok: true,
    signedUrl,
    // ElevenLabs SessionConfig overrides (see @elevenlabs/client): inject Atlas's live brain,
    // his proactive opener, and his tuned voice — per session, no agent redeploy.
    overrides: {
      agent: { prompt: { prompt: system }, firstMessage: greeting },
      tts: { voiceId: v.voiceId, stability: v.settings.stability, similarityBoost: v.settings.similarity_boost, speed: v.settings.speed },
    },
    // Forwarded to the custom-LLM webhook as elevenlabs_extra_body → identifies the tenant.
    extraBody: { surge_token: token },
    greeting,
  });
}
