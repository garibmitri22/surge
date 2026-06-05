// Surge — email channel scaffolding verification. Run: node scripts/verify-email.mjs
// Verifies the credential-free pieces are correct and SAFE-by-default. The live
// pieces (SPF/DKIM/DMARC resolve, Resend domain verified, a real send) come online
// once the accounts + DNS land — they SKIP here with a clear note.
import { readFileSync } from 'node:fs';
import {
  isConfigured, fromAddress, unsubscribeUrl, warmupCapForDay, warmupDay,
  buildFooter, WARMUP_SCHEDULE,
} from '../lib/email.mjs';

let failures = 0;
const check = (name, ok, detail) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failures++; };
const skip = (name, why) => console.log(`SKIP  ${name} — ${why}`);

console.log('--- 1. Safe by default (nothing sends without the key) ---');
// In this sandbox RESEND_API_KEY is unset; sending must report not-configured.
check('isConfigured() is false without RESEND_API_KEY', isConfigured() === false || !!process.env.RESEND_API_KEY);
check('from address defaults to the dedicated sending domain', /@getsurgehq\.com/.test(fromAddress()), fromAddress());

console.log('\n--- 2. Warmup ramp (slow start, monotonic, capped) ---');
check('day 1 cap is a slow start (<=20)', warmupCapForDay(1) <= 20 && warmupCapForDay(1) >= 5, `day1=${warmupCapForDay(1)}`);
const caps = [1, 3, 7, 14, 21, 30, 45].map(warmupCapForDay);
const monotonic = caps.every((c, i) => i === 0 || c >= caps[i - 1]);
check('caps never decrease as warmup progresses', monotonic, caps.join(' -> '));
check('caps plateau (no runaway volume)', warmupCapForDay(45) === warmupCapForDay(999) && warmupCapForDay(45) <= 200, `steady=${warmupCapForDay(45)}`);
check('warmupDay is 1 before any start date', warmupDay(null) === 1);

console.log('\n--- 3. CAN-SPAM footer (address + working unsubscribe) ---');
const url = unsubscribeUrl('tok-123');
const footer = buildFooter({ companyName: 'Acme', physicalAddress: '123 Main St, Houston TX', unsubUrl: url });
check('unsubscribe URL points at /api/unsubscribe with the token', /\/api\/unsubscribe\?token=tok-123$/.test(url), url);
check('footer text carries the physical address', footer.text.includes('123 Main St, Houston TX'));
check('footer html carries a clickable unsubscribe link', footer.html.includes(`href="${url}"`) && /unsubscribe/i.test(footer.html));

console.log('\n--- 4. Compliance wiring is present in source ---');
const sendSrc = readFileSync('lib/email.mjs', 'utf8');
check('send refuses without a physical address (CAN-SPAM gate)', /no_physical_address/.test(sendSrc));
check('send checks the suppression list before sending', /isSuppressed/.test(sendSrc));
check('send sets List-Unsubscribe + one-click headers', /List-Unsubscribe/.test(sendSrc) && /One-Click/.test(sendSrc));
check('send enforces the warmup cap', /warmupCapForDay/.test(sendSrc) && /warmup_cap/.test(sendSrc));
const unsubRoute = readFileSync('app/api/unsubscribe/route.ts', 'utf8');
check('unsubscribe route honors GET + one-click POST via the RPC', /export async function GET/.test(unsubRoute) && /export async function POST/.test(unsubRoute) && /email_unsubscribe/.test(unsubRoute));
// Send-on-approval is wired (owner approval -> deliverDraft -> sendEmail).
check('deliverDraft sends + advances the lead on success', /export async function deliverDraft/.test(sendSrc) && /approval_status: 'sent'/.test(sendSrc) && /status: 'contacted'/.test(sendSrc));
const approveRoute = readFileSync('app/api/leads/approve/route.ts', 'utf8');
check('approve route calls deliverDraft (nothing sends without approval)', /deliverDraft/.test(approveRoute) && /'approve'/.test(approveRoute) && /'reject'/.test(approveRoute));
const hb = readFileSync('lib/heartbeat.mjs', 'utf8');
check('heartbeat drips approved drafts up to the warmup cap', /deliverDraft/.test(hb) && /warmup_cap/.test(hb) && /isConfigured\(\)/.test(hb));

console.log('\n--- 5. Live (pending accounts + DNS) ---');
skip('SPF/DKIM/DMARC resolve + Resend domain verified + real send', 'set RESEND_API_KEY + run email_migration.sql + add DNS records, then re-run');

console.log(failures === 0 ? '\nEMAIL SCAFFOLDING PASSED — safe-by-default, warmup + CAN-SPAM correct (live send pending credentials).' : `\n${failures} CHECK(S) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
