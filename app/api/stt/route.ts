import { createSupabaseServerClient } from '@/lib/supabase-server';
import { resolveCanonicalCompanyId } from '@/lib/company-resolve';
import { deepgramListenUrl, extractTranscript, extractDuration } from '@/lib/stt.mjs';
import { sttHours } from '@/lib/pricing.mjs';
import { getBalance, isInternal, debitHours } from '@/lib/hours.mjs';

// JARVIS listening (Phase 2) — transcribe a recorded utterance with Deepgram. Auth-gated,
// metered per minute of audio (internal accounts bypass), charges ZERO on any failure. The
// client posts the raw audio blob as the body; we return the transcript.
export const runtime = 'nodejs';
export const maxDuration = 30;

// A short spoken turn, not a podcast — bounds the request and the $/min.
const MAX_BYTES = 10 * 1024 * 1024;

export async function POST(request: Request) {
  // No key → tell the client to fall back to the free browser dictation (mic never breaks).
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    return Response.json({ ok: false, reason: 'not_configured' }, { status: 503 });
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const contentType = request.headers.get('content-type') || 'audio/webm';
  const audio = await request.arrayBuffer();
  if (!audio || audio.byteLength === 0) return Response.json({ ok: false, reason: 'empty' }, { status: 400 });
  if (audio.byteLength > MAX_BYTES) return Response.json({ ok: false, reason: 'too_large' }, { status: 413 });

  // Meter gate: out of hours → refuse before spend (client falls back to the free voice). We
  // don't know the exact duration until Deepgram replies, so gate on a 1-second floor.
  const companyId = await resolveCanonicalCompanyId(supabase, user.id);
  let internal = false;
  if (companyId) {
    internal = await isInternal(supabase, companyId);
    if (!internal) {
      const balance = await getBalance(supabase, companyId);
      if (balance < sttHours(1)) return Response.json({ ok: false, reason: 'out_of_hours', balance }, { status: 402 });
    }
  }

  let resp: Response;
  try {
    resp = await fetch(deepgramListenUrl(), {
      method: 'POST',
      headers: { Authorization: `Token ${apiKey.trim()}`, 'content-type': contentType },
      body: audio,
    });
  } catch {
    return Response.json({ ok: false, reason: 'stt_unreachable' }, { status: 502 });
  }

  // Anything but a 200 = failure → no debit (the customer never pays for a miss).
  if (!resp.ok) return Response.json({ ok: false, reason: 'stt_error', status: resp.status }, { status: 502 });
  let json: unknown;
  try { json = await resp.json(); } catch { return Response.json({ ok: false, reason: 'stt_bad_response' }, { status: 502 }); }

  const transcript = extractTranscript(json);
  const duration = extractDuration(json);
  // Charge for the audio actually transcribed (no-op for internal accounts; 0 if Deepgram
  // processed nothing). Best-effort — a ledger hiccup must never swallow the transcript.
  const charge = sttHours(duration);
  if (companyId && charge > 0) {
    try { await debitHours(supabase, companyId, charge, 'Voice transcription', { refType: 'stt' }); } catch { /* never block the transcript on the ledger */ }
  }

  return Response.json({ ok: true, transcript, duration, hours: charge });
}
