// Surge — Outbound email deliverability QA. Run: node scripts/verify-email-quality.mjs
//
// Renders a representative draft through the REAL pipeline (renderEmail + the CAN-SPAM footer)
// and scores it on the things that make cold email land in the inbox and read like a human
// wrote it. Also runs the same checks against the most recent REAL draft in the DB when one
// exists. Optional: set MAIL_TESTER_ADDRESS to a fresh address from https://www.mail-tester.com
// to send one real test and get an external spam score.
import { readFileSync } from 'node:fs';
import { renderEmail, buildFooter, embedTrackedCta, fromAddress } from '../lib/email.mjs';

let failures = 0;
const check = (n, ok, d) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${n}${d ? ` — ${d}` : ''}`); if (!ok) failures++; };

// Spam-trigger phrases (classic filter bait) + an ALL-CAPS word detector (4+ caps).
const SPAM = ['free', 'act now', 'limited time', 'risk-free', 'click here', 'buy now', 'order now',
  'cash', '100%', 'guarantee', 'winner', 'congratulations', 'urgent', 'offer expires', '!!!', '$$$', 'cheap'];
const spamHits = (s) => {
  const low = s.toLowerCase();
  const hits = SPAM.filter((w) => low.includes(w));
  const caps = (s.match(/\b[A-Z]{4,}\b/g) || []).filter((w) => !['SURGE'].includes(w)); // allow brand
  if (caps.length) hits.push(...caps.map((c) => `ALLCAPS:${c}`));
  return hits;
};
const wordCount = (s) => (s.trim().match(/\S+/g) || []).length;

// One CTA, short /r/<code> form (NOT the legacy ~180-char /api/r/<token>).
function ctaCheck(html) {
  const links = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]).filter((u) => /\/r\//.test(u) || /\/api\/r\//.test(u));
  const shortOnes = links.filter((u) => /\/r\/[A-Za-z0-9]{6,10}(\b|$)/.test(u) && !/\/api\/r\//.test(u));
  return { count: links.length, allShort: links.length > 0 && links.length === shortOnes.length };
}

function scoreEmail(label, subject, body, ctaUrl) {
  console.log(`\n--- ${label} ---`);
  const { html, text } = renderEmail(embedTrackedCta(body, ctaUrl), ctaUrl, { employeeName: 'Aria' });
  const footer = buildFooter({ companyName: 'Acme Co', physicalAddress: '123 Main St, Austin, TX 78701', unsubUrl: 'https://surgehq.io/api/unsubscribe?t=demo' });
  const fullHtml = html + footer.html;
  const fullText = text + footer.text;
  const paraCount = (html.match(/<p\b/g) || []).length;
  const cta = ctaCheck(fullHtml);
  const subjHits = spamHits(subject);
  const bodyHits = spamHits(body);
  const wc = wordCount(body);

  check('has a non-empty subject', subject.trim().length > 0, JSON.stringify(subject));
  check('subject is not spammy (no ALL-CAPS / FREE / !!!)', subjHits.length === 0, subjHits.join(', ') || 'clean');
  check('body renders as MULTIPLE <p> paragraphs (not one block)', paraCount >= 3, `${paraCount} <p>`);
  check('exactly ONE CTA, in short /r/<code> form', cta.count === 1 && cta.allShort, `${cta.count} link(s), short=${cta.allShort}`);
  check('has the AI signature block', /AI Sales Rep @ Surge/.test(fullHtml) && /AI Sales Rep @ Surge/.test(fullText));
  check('has the unsubscribe footer (CAN-SPAM)', /Unsubscribe/i.test(fullHtml) && /Unsubscribe/i.test(fullText) && /unsubscribe/i.test(footer.html));
  check('body word count ~60–130', wc >= 55 && wc <= 135, `${wc} words`);
  check('no spam-trigger words in the body', bodyHits.length === 0, bodyHits.join(', ') || 'clean');
  return { html: fullHtml, text: fullText };
}

console.log('=== EMAIL QUALITY SCORECARD ===');

// 1) Representative draft (what the rewritten writer produces): 4 short paras + a P.S.
const sampleSubject = 'quick thought on your Austin roofing leads';
const sampleBody = [
  "Noticed Lone Star Roofing has been running the same storm-damage ad in Austin for a few months — you're clearly spending real money to make the phone ring.",
  "Here's the leak I'd worry about: most of those clicks call or fill the form, then wait. A lead answered in 5 minutes books far more often than one answered in an hour, and after hours they just go cold.",
  "Surge puts an AI rep on every new lead the second it lands — qualifies, replies, and books the meeting — for $399/mo (or a full team at $999/mo), versus a $60k+ hire.",
  "If that's worth 15 minutes, grab a time here: {{CTA_URL}}",
  "An AI wrote this. You read the whole thing anyway. That's what I'd do for every lead you get.",
].join('\n\n');
const rendered = scoreEmail('Representative draft', sampleSubject, sampleBody, 'https://surgehq.io/r/aB3xK9q');

// 2) Most recent REAL draft in the DB, if one exists (proves live output, not just the sample).
try {
  const { createClient } = await import('@supabase/supabase-js');
  const env = Object.fromEntries(readFileSync('.env.local', 'utf8').split('\n').filter((l) => l.includes('=')).map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
  const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { data: d } = await db.from('lead_drafts').select('subject, body').eq('channel', 'email').order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (d?.subject && d?.body) {
    const m = String(d.body).match(/https?:\/\/\S+\/r\/[A-Za-z0-9]+/);
    scoreEmail('Most recent REAL draft from the DB', d.subject, d.body, m ? m[0] : 'https://surgehq.io/r/live0001');
  } else {
    console.log('\n--- Most recent REAL draft from the DB ---\n  SKIP  no email drafts found (run an Aria batch first)');
  }
} catch (e) {
  console.log(`\n--- Most recent REAL draft from the DB ---\n  SKIP  could not read drafts (${e instanceof Error ? e.message : 'error'})`);
}

// 3) Optional: real send to mail-tester.com for an external spam score.
console.log('\n--- External spam score (mail-tester.com) ---');
const mt = process.env.MAIL_TESTER_ADDRESS;
if (!mt) {
  console.log('  SKIP  set MAIL_TESTER_ADDRESS to a fresh address from https://www.mail-tester.com to send a real test');
} else if (!process.env.RESEND_API_KEY) {
  console.log('  SKIP  RESEND_API_KEY not set');
} else {
  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: fromAddress('Surge'), to: mt, subject: sampleSubject,
      html: rendered.html, text: rendered.text,
      headers: { 'List-Unsubscribe': '<https://surgehq.io/api/unsubscribe?t=demo>', 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
    }),
  }).then((r) => r.json()).catch((e) => ({ error: String(e) }));
  console.log(resp?.id
    ? `  SENT  id=${resp.id} → open https://www.mail-tester.com and read the score for ${mt}`
    : `  FAIL  send failed: ${JSON.stringify(resp)}`);
  if (!resp?.id) failures++;
}

console.log(failures === 0
  ? '\nEMAIL QUALITY VERIFICATION PASSED — structured multi-paragraph render, one short tracked CTA, AI signature, CAN-SPAM unsubscribe, in-range word count, no spam triggers.'
  : `\n${failures} CHECK(S) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
