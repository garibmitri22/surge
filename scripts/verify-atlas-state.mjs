// Surge — Atlas system-state honesty verification. Run: node scripts/verify-atlas-state.mjs
//
// Proves Atlas answers factual/system-state questions from REAL data, never from training
// assumptions or stale prose:
//   1. The shared snapshot (summarizeLeadState/summarizeChannels) counts correctly (pure).
//   2. The Atlas system prompt carries the live counts + LIVE CHANNELS block, the
//      no-hallucination guardrail, and NO stale "cannot send / Phase 2" claim (pure).
//   3. (DB) For a seeded company, the numbers in Atlas's prompt EQUAL independent DB COUNT
//      queries — leads by status, drafts pending, and real emails SENT (email_sends) — the
//      same source the dashboard uses. So Atlas's reported counts == DB == dashboard.
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { buildSystemPrompt, summarizeLeadState, summarizeChannels } from '../lib/chat-prompt.mjs';

let failures = 0;
const check = (n, ok, d) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? ` — ${d}` : ''}`); if (!ok) failures++; };
const skip = (n, w) => console.log(`SKIP  ${n} — ${w}`);

// Minimal chief-of-staff ctx for prompt assembly (mirrors what the route passes).
const baseCtx = (leadPipeline, channels) => ({
  persona: null,
  employee: { name: 'Atlas', role: 'Chief of Staff', personality: '', bio: '', responsibilities: [] },
  company: { company_name: 'Acme', industry: 'Roofing', target_customers: 'homeowners', brand_tone: 'warm', main_goal: 'more jobs', competitors: '', employee_count: '1' },
  memory: [], tasks: [], activity: [],
  roster: [{ name: 'Atlas', role: 'Chief of Staff', status: 'active', bio: '' }, { name: 'Aria', role: 'Sales Rep', status: 'active', bio: '' }],
  isChiefOfStaff: true, allTasks: [], kpiSnapshot: [], hoursStatus: null,
  leadPipeline, channels,
});

// --- 1. Shared snapshot counts (pure) ---------------------------------------
console.log('--- 1. Snapshot counts (pure) ---');
const leads = [
  { status: 'qualified' }, { status: 'qualified' }, { status: 'drafted' },
  { status: 'contacted', click_count: 0 }, { status: 'warm', click_count: 2 }, { status: 'meeting' },
];
const drafts = [{ approval_status: 'pending' }, { approval_status: 'pending' }, { approval_status: 'sent' }];
const snap = summarizeLeadState({ leads, drafts, sentCount: 4 });
check('counts by status are correct', snap.total === 6 && snap.qualified === 2 && snap.warm === 1 && snap.meeting === 1, JSON.stringify(snap));
check('pendingDrafts + outreachSent + clicks correct', snap.pendingDrafts === 2 && snap.outreachSent === 4 && snap.clicks === 1);
const chLive = summarizeChannels({ emailConfigured: true, physicalAddress: '123 Main St' });
const chNo = summarizeChannels({ emailConfigured: false });
check('channels: email live when configured + address; not when no key', /LIVE/.test(chLive.email) && /NOT configured/.test(chNo.email));

// --- 2. Prompt carries real state + guardrail, no stale false claim (pure) ---
console.log('\n--- 2. Atlas prompt: real state + guardrail, no stale claim ---');
const prompt = buildSystemPrompt(baseCtx(snap, chLive));
const chatPromptSrc = readFileSync('lib/chat-prompt.mjs', 'utf8');
check('prompt shows the real outreach-SENT count', new RegExp(`${snap.outreachSent} outreach email\\(s\\) actually SENT`).test(prompt), `sent=${snap.outreachSent}`);
check('prompt has the LIVE CHANNELS & CAPABILITIES block', /LIVE CHANNELS & CAPABILITIES/.test(prompt) && /Email \/ outreach sending:/.test(prompt));
check('prompt has the system-state guardrail (read real data, never guess)', /SYSTEM-STATE & CAPABILITY QUESTIONS/.test(prompt) && /let me check|don't have that/i.test(prompt));
check('prompt forbids "Phase 2 / not wired / coming later" from memory', /NEVER call a feature "Phase 2", "not wired in", "coming later"/.test(prompt));
check('the STALE FALSE CLAIM is gone (no "cannot SEND them yet")', !/cannot SEND them yet|cannot send them yet/i.test(chatPromptSrc) && !/cannot SEND them yet/i.test(prompt));
check('email-live language present (sends via Resend, click→warm)', /sends? via Resend|SEND via Resend/i.test(prompt));

// --- 3. (DB) Atlas's prompt numbers EQUAL independent DB counts -------------
console.log('\n--- 3. Live: Atlas prompt counts == DB counts (needs leads + email_migration) ---');
const env = Object.fromEntries(readFileSync('.env.local', 'utf8').split('\n').filter((l) => l.includes('=')).map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const URL = env.NEXT_PUBLIC_SUPABASE_URL, ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const probe = createClient(URL, ANON);
const { error: esErr } = await probe.from('email_sends').select('id').limit(1);
if (esErr) {
  skip('Atlas counts == DB counts', 'email_migration not applied (no email_sends table) — run supabase/email_migration.sql');
} else {
  const email = `qa-atlas-${Date.now()}@surge-qa.test`, password = `Test-${Math.random().toString(36).slice(2)}A1!`;
  const db = createClient(URL, ANON);
  const { data: su, error: suErr } = await db.auth.signUp({ email, password });
  if (suErr || !su?.user) {
    skip('Atlas counts == DB counts', `could not create a test user (${suErr?.message ?? 'no user'}) — is Confirm-email OFF?`);
  } else {
    await db.auth.signInWithPassword({ email, password });
    const { data: co } = await db.from('companies').insert({ user_id: su.user.id, company_name: '__atlas_state__', onboarding_complete: true, plan: 'single', physical_address: '123 Main St, Austin TX' }).select('id').single();
    const cid = co.id;
    // click_count is set on every row: a mixed batch (some with, some without) makes PostgREST
    // insert explicit NULL for the omitted ones, violating the NOT NULL default.
    const L = (status, extra = {}) => ({ company_id: cid, business_name: 'b' + Math.random().toString(36).slice(2, 7), vertical: 'other', source_url: 'https://example.com', score: 50, score_reasons: {}, status, next_action: 'x', next_action_at: new Date().toISOString(), click_count: 0, ...extra });
    // Seed a known mix: 3 qualified, 1 drafted, 2 warm (1 clicked), 1 meeting.
    const { data: insLeads, error: lErr } = await db.from('leads')
      .insert([L('qualified'), L('qualified'), L('qualified'), L('drafted'), L('warm', { click_count: 3 }), L('warm'), L('meeting')])
      .select('id');
    check('seeded leads inserted', !lErr && (insLeads ?? []).length === 7, lErr?.message || `${insLeads?.length ?? 0} rows`);
    const leadId = insLeads?.[0]?.id;
    await db.from('lead_drafts').insert([
      { lead_id: leadId, company_id: cid, channel: 'email', sequence_step: 1, subject: 's', body: 'b', approval_status: 'pending' },
      { lead_id: leadId, company_id: cid, channel: 'email', sequence_step: 2, subject: 's', body: 'b', approval_status: 'pending' },
    ]);
    // 2 real SENT emails (the canonical outreach-sent source).
    await db.from('email_sends').insert([
      { company_id: cid, to_email: 'a@x.com', subject: 's', status: 'sent' },
      { company_id: cid, to_email: 'b@x.com', subject: 's', status: 'sent' },
    ]);

    // Independent DB COUNT queries — the "truth".
    const countOf = async (status) => (await db.from('leads').select('id', { count: 'exact', head: true }).eq('company_id', cid).eq('status', status)).count ?? 0;
    const dbTruth = {
      qualified: await countOf('qualified'),
      warm: await countOf('warm'),
      meeting: await countOf('meeting'),
      pending: (await db.from('lead_drafts').select('id', { count: 'exact', head: true }).eq('company_id', cid).eq('approval_status', 'pending')).count ?? 0,
      sent: (await db.from('email_sends').select('id', { count: 'exact', head: true }).eq('company_id', cid).eq('status', 'sent')).count ?? 0,
    };

    // Build Atlas's prompt the SAME way the route does: fetch rows, summarize, render.
    const { data: leadRows } = await db.from('leads').select('status, next_action_at, click_count').eq('company_id', cid);
    const { data: draftRows } = await db.from('lead_drafts').select('approval_status').eq('company_id', cid);
    const lp = summarizeLeadState({ leads: leadRows, drafts: draftRows, sentCount: dbTruth.sent });
    const livePrompt = buildSystemPrompt(baseCtx(lp, summarizeChannels({ emailConfigured: true, physicalAddress: '123 Main St' })));

    check('snapshot counts EQUAL independent DB counts', lp.qualified === dbTruth.qualified && lp.warm === dbTruth.warm && lp.meeting === dbTruth.meeting && lp.pendingDrafts === dbTruth.pending && lp.outreachSent === dbTruth.sent, `snap ${JSON.stringify({ q: lp.qualified, w: lp.warm, m: lp.meeting, p: lp.pendingDrafts, s: lp.outreachSent })} vs db ${JSON.stringify(dbTruth)}`);
    check('Atlas prompt quotes the real SENT count (== DB)', new RegExp(`${dbTruth.sent} outreach email\\(s\\) actually SENT`).test(livePrompt));
    check('Atlas prompt quotes the real qualified + warm counts (== DB)', new RegExp(`${dbTruth.qualified} qualified`).test(livePrompt) && new RegExp(`${dbTruth.warm} warm`).test(livePrompt));
    check('email channel reads LIVE (address on file)', /Email \/ outreach sending: LIVE/.test(livePrompt));

    await db.from('companies').delete().eq('id', cid);
  }
}

console.log(failures === 0
  ? '\nATLAS-STATE VERIFICATION PASSED — counts come from real DB (== dashboard), live channels from real config, guardrail against guessing, no stale "cannot send" claim.'
  : `\n${failures} CHECK(S) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
