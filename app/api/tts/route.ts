import { createSupabaseServerClient } from '@/lib/supabase-server';
import { resolveCanonicalCompanyId } from '@/lib/company-resolve';
import { voiceFor, forSpeech, TTS_MODEL, TTS_OUTPUT_FORMAT } from '@/lib/voices.mjs';
import { ttsHours } from '@/lib/pricing.mjs';
import { getBalance, isInternal, debitHours } from '@/lib/hours.mjs';

// JARVIS voice (Phase 1) — speak an agent's reply in its real ElevenLabs voice.
// Auth-gated, metered in hours (per character — voice is $/char), internal accounts
// bypass, and we charge ZERO on any failure. Streams audio back so it starts fast.
export const runtime = 'nodejs';
export const maxDuration = 30;

// Cap a single spoken reply so $/char can't run away on a giant message.
const MAX_CHARS = 2000;

export async function POST(request: Request) {
  // No key → tell the client to fall back to the free Web-Speech voice (UI never breaks).
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    return Response.json({ ok: false, reason: 'not_configured' }, { status: 503 });
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  let body: { text?: string; employeeId?: string };
  try { body = await request.json(); } catch { return new Response('Invalid JSON', { status: 400 }); }

  const employeeId = String(body.employeeId || 'atlas').trim() || 'atlas';
  const text = forSpeech(body.text || '').slice(0, MAX_CHARS);
  if (!text) return Response.json({ ok: false, reason: 'empty' }, { status: 400 });

  // Meter: hours scale with characters. Internal/owner accounts bypass the gate AND the
  // debit (debitHours no-ops for them). For everyone else, refuse BEFORE spending real
  // money if they're out of hours — the client then falls back to the free voice.
  const companyId = await resolveCanonicalCompanyId(supabase, user.id);
  const charge = ttsHours(text.length);
  let internal = false;
  if (companyId) {
    internal = await isInternal(supabase, companyId);
    if (!internal && charge > 0) {
      const balance = await getBalance(supabase, companyId);
      if (balance < charge) return Response.json({ ok: false, reason: 'out_of_hours', balance }, { status: 402 });
    }
  }

  const v = voiceFor(employeeId);
  let resp: Response;
  try {
    resp = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${v.voiceId}/stream?output_format=${TTS_OUTPUT_FORMAT}`,
      {
        method: 'POST',
        headers: { 'xi-api-key': apiKey.trim(), 'content-type': 'application/json', accept: 'audio/mpeg' },
        body: JSON.stringify({ text, model_id: TTS_MODEL, voice_settings: v.settings }),
      },
    );
  } catch {
    return Response.json({ ok: false, reason: 'tts_unreachable' }, { status: 502 });
  }

  // Anything but a streaming 200 = failure → no debit (the customer never pays for a miss).
  if (!resp.ok || !resp.body) {
    return Response.json({ ok: false, reason: 'tts_error', status: resp.status }, { status: 502 });
  }

  // Success: debit the actual character cost (no-op for internal accounts). Best-effort —
  // a ledger hiccup must never swallow the audio the user is waiting on.
  if (companyId && charge > 0) {
    try { await debitHours(supabase, companyId, charge, `${v.name} spoke`, { employeeId, refType: 'tts' }); } catch { /* never block playback on the ledger */ }
  }

  return new Response(resp.body, {
    status: 200,
    headers: {
      'content-type': 'audio/mpeg',
      'cache-control': 'private, max-age=86400',
      'x-surge-voice': v.voiceId,
      'x-surge-hours': String(charge),
    },
  });
}
