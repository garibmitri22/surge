# Surge — Deploy runbook (Vercel + Supabase)

App domain: **surgehq.io** (Vercel). Sending domain: **getsurgehq.com** (Resend). These are intentionally separate.

## 1. Vercel environment variables
Set these in the Vercel project (Production + Preview). Values come from your local `.env.local`.

| Var | Notes |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `ANTHROPIC_API_KEY` | server-only; powers chat, runs, research, memory extraction |
| `RESEND_API_KEY` | server-only; outbound email |
| `EMAIL_FROM` | `aria@getsurgehq.com` |
| `NEXT_PUBLIC_APP_URL` | **`https://surgehq.io`** — unsubscribe + confirm links use it |
| `SUPABASE_SERVICE_ROLE_KEY` | optional, only for the nightly cron heartbeat |
| `CRON_SECRET` | optional, guards `/api/cron/heartbeat` |

## 2. Supabase — SQL migrations (run once, in order, "Run without RLS")
`schema.sql` → `auth_migration.sql` → `chat_migration.sql` → `leads_migration.sql` →
`usage_migration.sql` → `onboarding_migration.sql` → `hours_migration.sql` →
`email_migration.sql`. (Optional one-time: `dedupe_profile_memory.sql`.)

## 3. Supabase — Auth settings
- **Confirm email: ON.**
- **Site URL:** `https://surgehq.io`
- **Redirect allowlist:** `https://surgehq.io/**` and `http://localhost:3000/**`
- **"Confirm signup" email template** link →
  `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/onboarding`

## 4. Post-deploy checks
- Sign up with a real address → "Check your email" → click link → lands in onboarding.
- Settings → Sending & Compliance → set the business mailing address (CAN-SPAM gate; outbound blocked until set).
- Resend dashboard shows getsurgehq.com **verified**.
- Approve a lead draft → it sends (warmup-capped at ~10/day, ramping).

## 5. Nightly heartbeat (optional, the "while you slept" cron)
Set `SUPABASE_SERVICE_ROLE_KEY` + `CRON_SECRET`, then point a daily scheduler at:
`POST https://surgehq.io/api/cron/heartbeat` with header `Authorization: Bearer <CRON_SECRET>`.
(Until then, the per-visit heartbeat already runs the Lead Lifeline sweep when the owner opens the dashboard.)

## Verification scripts (run locally against a dev server)
`node scripts/verify-<name>.mjs` — score, hours, email, heartbeat, onboarding-v2, chat-prompt, atlas, leads, chat, auth, usage-limits, memory. All should pass.
