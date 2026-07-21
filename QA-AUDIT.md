# Surge — Internal Code Audit (June 6, Cowork)

Independent read-only audit of the shipped code, focused on the areas where a bug burns a customer, breaks trust, or creates legal exposure. This is the kind of technical diligence a serious investor runs. **Result: clean.**

## What was audited and what was found

**Credibility / honest numbers — PASS.** `estimatePipeline()` returns null when avg deal value is unset → the UI prompts "set avg deal value" instead of showing a fabricated figure. Pipeline = (qualified + warm) × avg deal value, labeled "estimated," formula shown on hover. Zero hardcoded dollar amounts in the dashboard. `hoursDisplay()` never renders "balance of allowance" when balance > allowance (the "198/70h" bug is fixed in code; internal accounts show "Unlimited").

**Consent / anti-spam — PASS (hard chokepoint).** `canSendSms` (lib/inbound.mjs) requires a stored consent record + 'sms' channel + 10DLC registered + not opted-out, on EVERY send, with explicitly **no `is_internal` bypass** ("consent + 10DLC are law"). Reactivation is email-by-default (CAN-SPAM established relationship), SMS only when the contact's consent column is true. Twilio helpers refuse to send unless the caller passed the gate.

**Tracked warm-signal link — PASS.** `/api/r/[token]` verifies an HMAC token; tampered/malformed tokens silently redirect home. Click promotes new→warm (never downgrades replied/meeting), increments count, refreshes the Lead Lifeline, and pings the owner **exactly once** on the real new→warm transition. Always 302s (fail-safe).

**Inbound capture endpoint — PASS.** Public but secured by a per-company signed capture token (bad token → 403); stamps consent + source; the speed-to-lead first text routes only through `deliverSms` (the consent/10DLC gate). Not open to abuse.

**Hours / billing — PASS.** Charge-on-completion, so a thin/failed action costs the customer 0. `debitHours` no-ops on amount ≤ 0 and for internal accounts; `gateWork` bypasses for internal. Monthly grant resets to allowance (no rollover).

**Agent run / fabrication guard — PASS.** `create_lead` rejects without a real `business_name` + `source_url`; the run prompt enforces "REAL DATA ONLY — a real 22 beats a fabricated 40." `draft_email` saves pending approval — nothing is sent. First (activation) run is comped so it's never double-charged.

**Activation idempotency — PASS.** `activated_at` check + a deterministic task id (`act_<company>`) as an atomic claim → the comped first run fires exactly once; concurrent/duplicate calls collide and bail.

**Multi-tenant isolation — PASS.** Spot-checked the new migrations: `warm_signal` and `reactivation` only ALTER `leads`/`companies` (already row-level-secured) — no new unprotected tables. No data-leak path found.

## Bottom line
The shipped product honors its own guardrails in code, not just in spec. No fabricated numbers, no way to text a non-consented lead, no multi-tenant leak, no double-charge. Safe to demo and safe to put under investor diligence. (Functional verification — that each feature works end-to-end — is the dev's `scripts/verify-*.mjs` suite + prod run; this audit covers correctness/safety of the logic.)
