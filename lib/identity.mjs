// Surge — owner display name. Plain ESM so the data layer (TS) and verify scripts
// (node) share the exact rule. NEVER show an email-derived handle as a name: a real
// profile name wins; otherwise an email local part is only acceptable as a name when
// it clearly looks like one (has a separator AND no digits). Anything else → "there".

const NOBODY = { name: 'there', firstName: 'there', initial: 'U' };

/**
 * @param {Record<string, unknown>|null|undefined} meta  auth user_metadata
 * @param {string|null|undefined} email
 * @returns {{ name: string, firstName: string, initial: string }}
 */
export function displayNameFrom(meta, email) {
  const full = String((meta && (meta.full_name || meta.name)) || '').trim();
  if (full) {
    return { name: full, firstName: full.split(/\s+/)[0], initial: (full[0] || 'U').toUpperCase() };
  }
  const local = String(email || '').split('@')[0];
  const looksLikeName = /[._-]/.test(local) && !/\d/.test(local) && local.length > 0;
  if (looksLikeName) {
    const name = local.replace(/[._-]+/g, ' ').trim().replace(/\b\w/g, (c) => c.toUpperCase());
    return { name, firstName: name.split(/\s+/)[0], initial: (name[0] || 'U').toUpperCase() };
  }
  return { ...NOBODY };
}
