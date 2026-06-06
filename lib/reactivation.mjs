// Surge — database reactivation helpers (pure; shared by the import route + verify).
// Parse a past-customer list, segment it, and resolve the per-contact consent basis.
// CONSENT: email is allowed on the established business relationship (CAN-SPAM); SMS/
// call only when the contact's consent column says yes — that gates canSendSms.

// ---- CSV parsing (handles quoted fields + commas/newlines inside quotes) ----
export function parseCsv(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  const s = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') { if (s[i + 1] === '"') { field += '"'; i++; } else inQuotes = false; }
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else field += c;
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => String(c).trim() !== ''));
}

// Fuzzy header → field map. Tolerant of real-world column names.
const HEADER_ALIASES = {
  name: ['name', 'full name', 'customer', 'contact', 'first name', 'client'],
  email: ['email', 'email address', 'e-mail'],
  phone: ['phone', 'phone number', 'mobile', 'cell', 'tel'],
  lastSeen: ['last visit', 'last seen', 'last quote', 'last service', 'last appointment', 'date', 'last visit date'],
  amount: ['amount', 'value', 'spend', 'quote amount', 'total', 'last amount', 'past spend'],
  status: ['status', 'stage', 'type'],
  consent: ['consent', 'sms consent', 'text consent', 'opt in', 'opt-in', 'texting consent'],
  relationship: ['service', 'notes', 'what they bought', 'product', 'job', 'details'],
};

function headerIndex(headers) {
  const norm = headers.map((h) => String(h).trim().toLowerCase());
  const idx = {};
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    idx[field] = norm.findIndex((h) => aliases.includes(h));
  }
  return idx;
}

const truthy = (v) => /^(y|yes|true|1|opted[\s-]?in|consent(ed)?)$/i.test(String(v || '').trim());

/**
 * Parse a CSV/pasted list into normalized contacts. Returns { contacts, error? }.
 * A contact needs at least an email or a phone to be usable.
 */
export function parseContacts(csvText) {
  const rows = parseCsv(csvText);
  if (rows.length < 2) return { contacts: [], error: 'Need a header row and at least one contact.' };
  const headers = rows[0];
  const idx = headerIndex(headers);
  if (idx.email < 0 && idx.phone < 0) return { contacts: [], error: 'Could not find an email or phone column.' };
  const get = (row, field) => (idx[field] >= 0 ? String(row[idx[field]] ?? '').trim() : '');
  const contacts = [];
  for (const row of rows.slice(1)) {
    const email = get(row, 'email').toLowerCase();
    const phone = get(row, 'phone');
    if (!email && !phone) continue;
    contacts.push({
      name: get(row, 'name') || null,
      email: email || null,
      phone: phone || null,
      lastSeen: get(row, 'lastSeen') || null,
      amount: get(row, 'amount') || null,
      status: get(row, 'status') || null,
      relationship: get(row, 'relationship') || null,
      smsConsent: truthy(get(row, 'consent')),
    });
  }
  return { contacts };
}

/** Segment a contact for the right reactivation angle. */
export function segmentOf(contact) {
  const st = String(contact.status || '').toLowerCase();
  if (/quote|estimate|proposal|pending|open/.test(st)) return 'unclosed_quote';
  const amt = parseFloat(String(contact.amount || '').replace(/[^0-9.]/g, ''));
  if (/customer|won|paid|client|completed|closed/.test(st) || (!Number.isNaN(amt) && amt > 0)) return 'past_buyer';
  return 'lapsed';
}

export const SEGMENT_LABEL = {
  unclosed_quote: 'Unclosed quotes',
  past_buyer: 'Past buyers (repeat-due)',
  lapsed: 'Lapsed contacts',
};

/**
 * The consent channels we may use for a reactivation contact. Email always (established
 * relationship + CAN-SPAM). SMS/call ONLY when the contact gave SMS consent — that's
 * what canSendSms checks before it will ever text them.
 */
export function consentChannelsFor(contact) {
  return contact.smsConsent ? ['email', 'sms', 'call'] : ['email'];
}

/** Dedupe key against existing leads (email beats phone beats name). */
export function dedupeKey({ email, phone, name }) {
  return (email || phone || name || '').toString().trim().toLowerCase();
}
