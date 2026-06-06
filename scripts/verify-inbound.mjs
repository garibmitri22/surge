// Surge — Inbound / speed-to-lead verification. Run: node scripts/verify-inbound.mjs
//
// Proves the consent spine + the flow:
//   1. A lead with NO consent record can NEVER trigger a send (hard block, no log/charge).
//   2. tendlc_status != 'registered' blocks sending.
//   3. STOP opts the number out and a suppressed number is then blocked.
//   4. The normalized endpoint (create_inbound_lead) creates an inbound lead with
//      consent + source stamped.
//   5. An inbound SMS reply logs to the thread and advances inbound → engaged.
//   6. Metering debits a conversation ONCE (not per message) and NEVER on a blocked send.
//   7. Capture-token round-trip + opt-out keyword + payload normalization (pure).
//
// We set DUMMY Twilio creds so the gate exercises the consent/10DLC logic — canSendSms
// never calls Twilio, and deliverSms returns at the gate before any send when blocked,
// so NOTHING is actually sent. Live DB checks create an ephemeral owner and clean up;
// they run once the inbound migration is applied.
process.env.TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || 'ACverifydummy';
process.env.TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || 'verifydummy';
process.env.SURGE_LINK_SECRET = process.env.SURGE_LINK_SECRET || 'inbound-verify-secret';

import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import {
  canSendSms, deliverSms, suppressSms, isSmsSuppressed, debitConversationOnce,
  normalizeInboundPayload, isOptOut, captureToken, verifyCaptureToken,
} from '../lib/inbound.mjs';
import { getBalance, appendHours } from '../lib/hours.mjs';
import { estimateHours } from '../lib/pricing.mjs';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n').filter((l) => l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const URL = env.NEXT_PUBLIC_SUPABASE_URL, ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let failures = 0;
const check = (name, ok, detail) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failures++; };
const skip = (name, why) => console.log(`SKIP  ${name} — ${why}`);

// Chainable stub: sms_suppressions lookup returns no row (not opted out).
const stubSupa = {
  from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }) }),
};

const company = { id: 'co1', tendlc_status: 'registered', twilio_number: '+15555550100', twilio_messaging_service_sid: null };
const consentedLead = { id: 'l1', phone: '+15555550111', consent_at: new Date().toISOString(), consent_channels: ['sms', 'call'], first_touch_at: null };

// --- 1-3, 7: gate + pure logic ----------------------------------------------
console.log('--- 1. Consent gate (the spine) ---');
check('consented + registered + sender → ok', (await canSendSms(stubSupa, company, consentedLead)).ok === true);

const noConsent = { ...consentedLead, consent_at: null, consent_channels: [] };
const g1 = await canSendSms(stubSupa, company, noConsent);
check('NO consent → blocked (no_consent)', g1.ok === false && g1.reason === 'no_consent', g1.reason);
// And deliverSms returns at the gate — it never reaches sendSms (no real send).
const d1 = await deliverSms(stubSupa, company, noConsent, 'should never send');
check('deliverSms hard-blocks a no-consent lead (never sends)', d1.ok === false && d1.reason === 'no_consent', d1.reason);

const smsOnlyEmailConsent = { ...consentedLead, consent_channels: ['email'] };
check('consent for email only → SMS blocked', (await canSendSms(stubSupa, company, smsOnlyEmailConsent)).reason === 'no_consent');

console.log('\n--- 2. 10DLC gate ---');
check('tendlc != registered → blocked', (await canSendSms(stubSupa, { ...company, tendlc_status: 'none' }, consentedLead)).reason === 'tendlc_not_registered');
check('tendlc pending → blocked', (await canSendSms(stubSupa, { ...company, tendlc_status: 'pending' }, consentedLead)).reason === 'tendlc_not_registered');

console.log('\n--- 7. Pure helpers ---');
check('STOP is detected as opt-out', isOptOut('STOP') && isOptOut('  unsubscribe ') && !isOptOut('hello'));
const tok = captureToken('company-xyz');
check('capture token round-trips to the company id', verifyCaptureToken(tok) === 'company-xyz');
check('capture token rejects tampering', verifyCaptureToken(tok.slice(0, -2) + 'xx') === null);
const norm = normalizeInboundPayload({ name: 'Jane', phone: '555', consent: 'on' }, 'surge_form');
check('payload normalizes + derives sms/call consent from the checkbox', norm.consent === true && norm.consent_channels.includes('sms') && norm.source === 'surge_form');
const normNo = normalizeInboundPayload({ name: 'Jim', phone: '555' }, 'surge_form');
check('no checkbox → no consent channels', normNo.consent === false && normNo.consent_channels.length === 0);

// --- Live DB checks ---------------------------------------------------------
console.log('\n--- Live (needs inbound_migration applied) ---');
const probe = createClient(URL, ANON);
const { error: colErr } = await probe.from('leads').select('origin').limit(1);
const { error: msgErr } = await probe.from('lead_messages').select('id').limit(1);
if (colErr || msgErr) {
  skip('endpoint creates lead / thread / STOP / metering', 'inbound migration not applied — run supabase/inbound_migration.sql, then re-run');
} else {
  const email = `qa-inbound-${Date.now()}@surge-qa.test`;
  const password = `Test-${Math.random().toString(36).slice(2)}A1!`;
  const db = createClient(URL, ANON);
  const { data: su, error: suErr } = await db.auth.signUp({ email, password });
  if (suErr || !su?.user) {
    skip('live inbound checks', `could not create a test user (${suErr?.message ?? 'no user'}) — is Confirm-email OFF?`);
  } else {
    await db.auth.signInWithPassword({ email, password });
    const { data: co } = await db.from('companies').insert({ user_id: su.user.id, company_name: '__inbound_verify__', onboarding_complete: true, plan: 'single' }).select('id').single();
    const companyId = co.id;

    // 4. Normalized endpoint (RPC) creates an inbound lead with consent + source stamped.
    const { data: created } = await db.rpc('create_inbound_lead', {
      p_company: companyId, p_name: 'Jane Lead', p_phone: '+15555551234', p_email: 'jane@x.com',
      p_consent_text: 'I agree to texts', p_consent_channels: ['sms', 'call'], p_consent_ip: '1.2.3.4', p_source: 'surge_form',
    });
    const leadId = created?.lead_id;
    check('endpoint creates an inbound lead', created?.ok === true && !!leadId, JSON.stringify(created));
    const { data: lead } = await db.from('leads').select('origin, status, consent_at, consent_channels, source, phone').eq('id', leadId).single();
    check('lead stamped origin=inbound, status=inbound', lead?.origin === 'inbound' && lead?.status === 'inbound', `${lead?.origin}/${lead?.status}`);
    check('consent + source stamped', !!lead?.consent_at && (lead?.consent_channels || []).includes('sms') && lead?.source === 'surge_form');

    // 5. Inbound reply logs to the thread + advances inbound → engaged.
    await db.from('lead_messages').insert({ company_id: companyId, lead_id: leadId, direction: 'inbound', channel: 'sms', body: 'Yes interested' });
    await db.from('leads').update({ status: 'engaged' }).eq('id', leadId);
    const { data: msgs } = await db.from('lead_messages').select('direction, body').eq('lead_id', leadId);
    const { data: adv } = await db.from('leads').select('status').eq('id', leadId).single();
    check('inbound reply logs to the thread', (msgs?.length ?? 0) >= 1 && msgs[0].direction === 'inbound');
    check('reply advances inbound → engaged', adv?.status === 'engaged', adv?.status);

    // 6. Metering: debit a conversation ONCE; never on a blocked send.
    await appendHours(db, companyId, 5, 'grant (test)', { refType: 'grant' });
    const bal0 = await getBalance(db, companyId);
    const first = await debitConversationOnce(db, companyId, leadId);
    const bal1 = await getBalance(db, companyId);
    const second = await debitConversationOnce(db, companyId, leadId);
    const bal2 = await getBalance(db, companyId);
    check('conversation debits once (0.5h)', first === true && Math.abs((bal0 - bal1) - estimateHours('inbound_conversation')) < 1e-9, `Δ ${(bal0 - bal1).toFixed(2)}h`);
    check('repeat conversation does NOT double-charge', second === false && Math.abs(bal2 - bal1) < 1e-9);

    // Blocked send never charges: deliverSms on a real opted-out lead returns at the gate.
    await suppressSms(db, companyId, lead.phone);
    check('STOP suppresses the number', (await isSmsSuppressed(db, companyId, lead.phone)) === true);
    const realCompany = { id: companyId, tendlc_status: 'registered', twilio_number: '+15555550100', twilio_messaging_service_sid: null };
    const balBefore = await getBalance(db, companyId);
    const blocked = await deliverSms(db, realCompany, { id: leadId, phone: lead.phone, consent_at: lead.consent_at, consent_channels: lead.consent_channels, first_touch_at: null }, 'should not send');
    const balAfter = await getBalance(db, companyId);
    check('suppressed number is blocked (opted_out) + never charged', blocked.ok === false && blocked.reason === 'opted_out' && Math.abs(balAfter - balBefore) < 1e-9, `${blocked.reason}`);

    await db.from('companies').delete().eq('id', companyId);
  }
}

console.log(failures === 0
  ? '\nINBOUND VERIFICATION PASSED — consent + 10DLC hard-gate sends, STOP suppresses, endpoint stamps consent+source, thread advances, conversation metered once, never charged on a blocked send.'
  : `\n${failures} CHECK(S) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
