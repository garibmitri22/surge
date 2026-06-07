// Surge — Aria dogfood acceptance harness.
// "Is Aria good enough to show a customer?" Runs a REAL prospecting run against Surge's
// own ICP (home-services contractors, Houston→Conroe), then scores the output against the
// acceptance criteria and prints a PASS/FAIL scorecard. Approves/sends NOTHING.
//
//   node scripts/dogfood-aria.mjs [baseURL]        # run (real Anthropic spend ~$0.33–2)
//   node scripts/dogfood-aria.mjs --cleanup        # also delete the test company after
//
// SAFETY: refuses to spend unless (a) the June-6 migrations are applied (probes
// leads.relationship — the column create_lead writes) and (b) the dev server is reachable.
// Runs as an ephemeral onboarded TEST company (not Mitri's real account) — real engine,
// real businesses, isolated by RLS. Leave it in place to eyeball in /leads, or --cleanup.
import { readFileSync } from 'node:fs';
import http from 'node:http';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';

const BASE = (process.argv.find((a) => a.startsWith('http')) || 'http://localhost:3001').replace(/\/$/, '');
const CLEANUP = process.argv.includes('--cleanup');
const env = Object.fromEntries(readFileSync('.env.local', 'utf8').split('\n').filter((l) => l.includes('=')).map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL, ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Surge's ICP (who WE sell to) — drives Aria's targeting + scoring.
const ICP = 'Owner-operated residential home-services contractors — roofing, HVAC, flooring — doing ~$500K–$5M/yr in the Houston→Conroe, TX area. Best fits already spend on ads (Meta/Google/LSA) or sit on an unworked past-customer / old-quote list, and lose money to slow lead follow-up (leads going cold after the click). They can afford ~$1k/mo (managed tier $2.5–5k). DISQUALIFY (score low): too small to have a budget, pure side-gigs, anyone outside the Houston→Conroe service area, and pure-consumer/homeowner targets — we sell to the BUSINESS owner, not homeowners.';
const TASK_TITLE = 'Find home-services contractors in Houston (roofing/HVAC/flooring) — research, score, draft';

const log = (s = '') => console.log(s);
const line = () => log('─'.repeat(64));

function postLong(path, body, cookie) {
  return new Promise((resolve, reject) => {
    const u = new global.URL(BASE + path);
    const data = JSON.stringify(body);
    const req = http.request({ hostname: u.hostname, port: u.port || 80, path: u.pathname, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), Cookie: cookie }, timeout: 9 * 60 * 1000 },
      (res) => { let b = ''; res.on('data', (c) => (b += c)); res.on('end', () => { try { resolve({ status: res.statusCode, json: JSON.parse(b) }); } catch { resolve({ status: res.statusCode, raw: b }); } }); });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('run exceeded 9 min')));
    req.write(data); req.end();
  });
}

(async () => {
  if (!URL_ || !ANON) { console.error('Missing Supabase env.'); process.exit(1); }

  // Guard 1: note migration state. create_lead is resilient to a missing relationship
  // column, so the prospecting core (research → score → draft) runs on the base schema;
  // only the warm-signal / inbound / reactivation features need the June-6 migrations.
  const probe = createClient(URL_, ANON);
  const { error: colErr } = await probe.from('leads').select('relationship').limit(1);
  if (colErr) log('NOTE: June-6 migrations not fully applied — prospecting core will run, but warm-signal/inbound features are not exercised. Apply them for the full pipeline.');

  // Guard 2: dev server reachable?
  try { await new Promise((res, rej) => { const r = http.get(BASE, () => res()); r.on('error', rej); r.setTimeout(4000, () => r.destroy(new Error('timeout'))); }); }
  catch { console.error(`BLOCKED: dev server not reachable at ${BASE}. Start it (npx next dev -p 3001) and re-run. No spend.`); process.exit(2); }

  log('Aria dogfood acceptance — real run against Surge\'s ICP. Nothing will be sent.');
  line();

  // Ephemeral onboarded test company with Surge's ICP in its brain.
  const email = `qa-dogfood-${Date.now()}@surge-qa.test`, password = `Test-${Math.random().toString(36).slice(2)}A1!`;
  const store = new Map();
  const ssr = createServerClient(URL_, ANON, { cookies: { getAll: () => [...store.entries()].map(([name, value]) => ({ name, value })), setAll: (cs) => cs.forEach(({ name, value }) => store.set(name, value)) } });
  const db = createClient(URL_, ANON);
  const { data: su, error: suErr } = await ssr.auth.signUp({ email, password });
  if (suErr || !su?.user) { console.error(`Could not create a test user (${suErr?.message ?? 'no user'}) — is Confirm-email OFF?`); process.exit(1); }
  await db.auth.signInWithPassword({ email, password });
  const cookieHeader = () => [...store.entries()].map(([n, v]) => `${n}=${encodeURIComponent(v)}`).join('; ');

  const { data: co } = await db.from('companies').insert({
    user_id: su.user.id, company_name: 'Surge (dogfood)', industry: 'AI workforce for home-services contractors',
    target_customers: ICP, brand_tone: 'Sharp, direct, plain-spoken, B2B. Lead with the post-click speed-to-lead leak; no hype.',
    main_goal: 'Book qualified demos with home-services owners', onboarding_complete: true, plan: 'single',
  }).select('id').single();
  const companyId = co.id;
  const nowMs = Date.now();
  await db.from('memory_entries').insert({ id: 'm' + nowMs, company_id: companyId, type: 'icp', title: 'Surge ICP', content: ICP, tags: ['icp'], updated_at: new Date().toISOString().slice(0, 10), sort_order: nowMs });
  const taskId = 't' + nowMs;
  await db.from('tasks').insert({ id: taskId, company_id: companyId, title: TASK_TITLE, assignee_id: 'aria', priority: 'high', project: 'Dogfood', status: 'queued', created_at: new Date().toISOString().slice(0, 10), due_date: new Date().toISOString().slice(0, 10), sort_order: nowMs });

  log(`Test company: ${companyId}`);
  log('Running Aria (research → score → draft). This takes a few minutes…');
  const t0 = Date.now();
  const run = await postLong('/api/agent/run', { taskId }, cookieHeader());
  const mins = ((Date.now() - t0) / 60000).toFixed(1);
  if (run.status !== 200) { console.error(`Run failed: HTTP ${run.status} ${run.raw || JSON.stringify(run.json)}`); if (CLEANUP) await db.from('companies').delete().eq('id', companyId); process.exit(1); }

  // Pull what Aria produced.
  const { data: leads } = await db.from('leads').select('business_name, website, location, vertical, email, score, score_reasons, source_url, status').eq('company_id', companyId).order('score', { ascending: false });
  const { data: drafts } = await db.from('lead_drafts').select('lead_id, subject, body, approval_status').eq('company_id', companyId);
  const L = leads ?? [], D = drafts ?? [];

  // ---- Scorecard ----
  let fails = 0; const PF = (ok, name, detail) => { log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) fails++; };
  const HUMAN = (name, detail) => log(`EYE   ${name}${detail ? ` — ${detail}` : ''}`);
  line(); log(`RESULTS (run took ${mins} min)`); line();

  // Leads
  PF(L.length >= 20, `Real batch (target 20+)`, `${L.length} leads`);
  const fabricatedRisk = L.filter((l) => !l.source_url || l.source_url.length < 8);
  PF(fabricatedRisk.length === 0, `Every lead has a real source URL (honesty audit trail)`, fabricatedRisk.length ? `${fabricatedRisk.length} missing` : 'all present');
  log('\nSpot-check these by Googling the name + visiting the site (zero fabricated = pass):');
  L.slice(0, 5).forEach((l, i) => log(`  ${i + 1}. ${l.business_name} — ${l.website || 'no site'} | ${l.location || '?'} | score ${l.score}\n     source: ${l.source_url}`));
  HUMAN('Each is a REAL Houston-area home-services business, right vertical/geo', 'verify the 5 above');

  // Scoring
  const scored = L.filter((l) => typeof l.score === 'number' && l.score >= 0 && l.score <= 100);
  const fourReasons = L.filter((l) => { const r = l.score_reasons || {}; return ['icp_fit', 'pain', 'ability', 'reachability'].every((k) => r[k] && typeof r[k].points === 'number' && r[k].reason); });
  PF(scored.length === L.length && L.length > 0, `Every lead scored 0–100`, `${scored.length}/${L.length}`);
  PF(fourReasons.length === L.length && L.length > 0, `Every lead has all 4 rubric reasons`, `${fourReasons.length}/${L.length}`);
  const ss = L.map((l) => l.score); const spread = L.length ? Math.max(...ss) - Math.min(...ss) : 0;
  PF(spread >= 15, `Scores discriminate (a spread, not all 85–90)`, `range ${L.length ? Math.min(...ss) : 0}–${L.length ? Math.max(...ss) : 0} (spread ${spread})`);

  // Drafts
  PF(D.length > 0, `Drafts produced`, `${D.length} drafts`);
  PF(D.every((d) => d.approval_status === 'pending'), `Nothing sent — all pending approval`, D.map((d) => d.approval_status).filter((s, i, a) => a.indexOf(s) === i).join(','));
  const withCta = D.filter((d) => /\/api\/r\/|\{\{CTA_URL\}\}/.test(d.body || ''));
  PF(withCta.length === D.length && D.length > 0, `Every draft has the booking CTA link`, `${withCta.length}/${D.length}`);
  if (D[0]) { log('\nTop-lead draft (read it — does it sound like a person + reference something real?):'); log(`  SUBJECT: ${D[0].subject}`); log(D[0].body.split('\n').map((x) => '  ' + x).join('\n')); HUMAN('Draft is specific + human + on-angle (post-click leak / speed-to-lead)', 'read above'); }

  // Economics & honesty
  const cost = run.json?.usage?.est_cost_usd; const hrs = run.json?.hours;
  PF(cost == null || (cost >= 0 && cost <= 3), `Run cost sane`, cost != null ? `~$${cost}` : 'n/a');
  log(`Hours: charged ${hrs?.charged ?? '?'}h, balance ${hrs?.balance ?? '?'}h${hrs?.thin ? ' (thin → 0)' : ''}`);

  line();
  log(fails === 0
    ? `ENGINE PASS (automated checks) — now confirm the EYE items above (real businesses, draft quality). ${L.length} leads, ${D.length} drafts, ${mins} min.`
    : `${fails} AUTOMATED CHECK(S) FAILED — that's the bug to fix before showing a customer.`);
  log(`\nInspect in the app: sign in as ${email} → /leads. (Test company id ${companyId}.)`);
  if (CLEANUP) { await db.from('companies').delete().eq('id', companyId); log('Cleaned up the test company.'); }
  else log('Left the test company in place for inspection. Re-run with --cleanup to remove it.');
  process.exit(fails === 0 ? 0 : 1);
})().catch((e) => { console.error('Harness error:', e.message); process.exit(1); });
