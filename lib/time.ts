// Honest, human-readable time formatting, shared across the app.
//
// Real timestamps → "just now" / "3m ago" / "2h ago", or "2:14 PM · Jun 8" once older
// than a day. Date-only strings (e.g. a task's createdAt "2026-06-08") → "Jun 8".
// Already-human labels (e.g. the activity log's legacy literal "just now") pass through
// untouched — we never fabricate a precise time we don't actually have.
export function humanTime(input: string | number | null | undefined): string {
  if (input == null || input === '') return '';
  if (typeof input === 'string' && Number.isNaN(Date.parse(input))) return input;
  const dateOnly = typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input);
  const d = new Date(input);
  const ms = Date.now() - d.getTime();
  if (!dateOnly && ms >= 0) {
    if (ms < 60_000) return 'just now';
    if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
    if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  }
  const sameYear = d.getFullYear() === new Date().getFullYear();
  const datePart = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) });
  if (dateOnly) return datePart;
  return `${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} · ${datePart}`;
}
