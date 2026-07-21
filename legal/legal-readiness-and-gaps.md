# Surge — Legal Readiness & Gap Analysis (before first paying customer)

> **Not legal advice.** Cowork is not a lawyer. This is a gap analysis + draft clause text to take to a qualified attorney. Do not rely on it as a substitute for counsel. The HARD GATE (MEMORY item 16) is not cleared until an attorney has reviewed the live docs.

## Where we actually are
Good news: `/legal/terms` and `/legal/privacy` already exist (`app/legal/terms/page.tsx`, `app/legal/privacy/page.tsx`, effective June 5 2026) and are solid v1 drafts — service description, acceptable use w/ CAN-SPAM, AI-output disclaimer, hours/billing, data ownership, "as is" warranty, liability cap, termination, Texas governing law. CAN-SPAM mechanics are largely BUILT (physical-address footer, working unsubscribe, suppression list — see MEMORY "Email channel LIVE"). So this is gap-closing, not a from-scratch build.

## The gaps that matter before charging (ranked)

1. **Indemnification clause — MISSING (highest risk).** Surge sends email on customers' behalf to third parties. The customer must indemnify Surge for their own outreach, content, and lists. Without this, their CAN-SPAM/TCPA/defamation exposure can flow to us. Draft below.

2. **Third-party (prospect) personal data + controller/processor roles — MISSING.** Aria researches and stores personal data about people who are NOT users (the leads). Under GDPR/CCPA that makes the customer the data *controller* and Surge a *processor*. Privacy Policy and ToS should both state this, and we likely need a short **DPA** (data processing addendum) available on request. Draft pointer below.

3. **Subprocessor list incomplete.** Privacy lists Supabase, Anthropic, Resend. Add **Vercel** (hosting), **Stripe** (payments — once billing ships), **ElevenLabs** (voice — once it ships), and our virtual-address provider. Keep this list current; subprocessor changes are a notice obligation in many DPAs.

4. **Legal entity undefined.** Docs say only "Surge." Confirm the contracting entity (LLC/Inc, state). "Surge" appears to be a brand; the ToS must name the entity that's actually party to the contract. **Mitri decision + possibly formation.**

5. **`support@getsurgehq.com` may not exist.** Both docs route contact there. MEMORY confirms `aria@` alias exists; create `support@` (and likely `privacy@`/`legal@`) aliases in Google Workspace so these aren't dead addresses.

6. **Refund / cancellation specifics.** ToS says "non-refundable except where required by law." Fine, but align exactly with what Stripe billing actually does (proration, access-until-period-end) — see `prompts/stripe-billing-prompt.md`. Keep docs and code consistent.

7. **Minor:** add a "no professional advice" line (AI output isn't legal/financial/medical advice); confirm Texas venue/arbitration choice with counsel; add effective-date/version control as docs change.

## Ready-to-drop-in draft clauses (after counsel review)

**Indemnification (new ToS section):**
> *You will indemnify and hold harmless Surge and its affiliates from any claim, loss, or liability (including reasonable legal fees) arising from: (a) your content, messages, or recipient lists; (b) your use of outbound outreach, including compliance with the CAN-SPAM Act, TCPA, and applicable anti-spam, privacy, and marketing laws; and (c) your violation of these Terms. You are the sender of and are solely responsible for all communications you approve and send through Surge.*

**Roles & data processing (new ToS section + Privacy note):**
> *For personal data of your own contacts and prospects that you process through Surge, you are the data controller and Surge acts as your processor, processing such data only on your instructions to provide the service. A Data Processing Addendum is available on request and is incorporated by reference where required by law.*

**Privacy subprocessor additions:**
> *Vercel — application hosting/CDN. Stripe — payment processing (billing data; we do not store card numbers). ElevenLabs — text-to-speech, only when voice is enabled. [Virtual-address provider] — mailing address for compliance.*

## Mitri's desk (only he/counsel can do these)
- Confirm/form the legal entity that contracts with customers; put its name in the docs.
- Engage an attorney to review live ToS + Privacy + the DPA before the first charge.
- Create `support@`, `privacy@`, `legal@` aliases.
- Decide refund/cancellation policy to match Stripe behavior.
- Form 1583 notarization (already on the list) so the mailing address is fully live.

## CAN-SPAM system — status
Largely DONE per MEMORY (accurate from/subject, physical address footer, one-click unsubscribe, suppression honored, warmup pacing). Remaining: confirm the unsubscribe link works end-to-end in production and that suppression blocks re-sends (the wedge prompt's verify step + a prod check cover this). No new build expected — verify, don't rebuild.
