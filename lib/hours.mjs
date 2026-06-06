// Surge — hours enforcement. The ONE helper every metered runner uses to gate work
// on the company's hours balance and debit the ACTUAL cost (zero on thin/failed).
// Plain ESM so routes (TS) and verify scripts (node) share it. Prices/allowances
// live in lib/pricing.mjs; this module is the balance/debit machinery.
//
// Model: chat is free. Work is gated, then charged on completion:
//   estimate -> if balance < estimate, refuse (in character) -> run -> debit actual.
// We charge on completion (not start) so a thin/failed action costs the customer 0.

import { estimateHours, overtimeMessage } from './pricing.mjs';

export { estimateHours, overtimeMessage };

/** True if the company is an internal/owner account — exempt from ALL metering and
 *  plan/employee gating (unlimited). Fails CLOSED (treats as metered) on error so a
 *  transient read can never accidentally hand out free unlimited work. */
export async function isInternal(supabase, companyId) {
  if (!companyId) return false;
  const { data, error } = await supabase
    .from('companies').select('is_internal').eq('id', companyId).maybeSingle();
  if (error) return false;
  return data?.is_internal === true;
}

/** Current hours balance for a company (sum of the ledger). */
export async function getBalance(supabase, companyId) {
  const { data, error } = await supabase.rpc('hours_balance', { p_company: companyId });
  if (error) throw new Error(`hours_balance failed: ${error.message}`);
  return Number(data ?? 0);
}

/** Append a ledger entry (positive = grant/overtime, negative = debit). Returns the
 *  new balance. Atomic per-company via an advisory lock in the SQL function.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} companyId @param {number} delta @param {string} reason
 * @param {{ employeeId?: string|null, refType?: string|null, refId?: string|null }} [opts] */
export async function appendHours(supabase, companyId, delta, reason, opts = {}) {
  const { data, error } = await supabase.rpc('hours_append', {
    p_company: companyId, p_delta: delta, p_reason: reason,
    p_employee: opts.employeeId ?? null, p_ref_type: opts.refType ?? null, p_ref_id: opts.refId ?? null,
  });
  if (error) throw new Error(`hours_append failed: ${error.message}`);
  return Number(data ?? 0);
}

/** Debit hours for completed work. amount<=0 is a no-op (thin/failed actions).
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} companyId @param {number} amount @param {string} reason
 * @param {{ employeeId?: string|null, refType?: string|null, refId?: string|null }} [opts] */
export async function debitHours(supabase, companyId, amount, reason, opts = {}) {
  if (!amount || amount <= 0) return await getBalance(supabase, companyId);
  // Internal/owner accounts are never charged — unlimited by design.
  if (await isInternal(supabase, companyId)) return await getBalance(supabase, companyId);
  return await appendHours(supabase, companyId, -Math.abs(amount), reason, opts);
}

/**
 * Gate work before spending real API money. Returns:
 *   { ok: true, balance, estimate }                      → caller may run, then debit actual
 *   { ok: false, balance, estimate, message }            → caller must refuse (in character)
 */
export async function gateWork(supabase, companyId, action, employeeName) {
  const estimate = estimateHours(action);
  // Internal/owner accounts bypass the gate entirely — unlimited work, never blocked.
  if (await isInternal(supabase, companyId)) {
    return { ok: true, internal: true, balance: Infinity, estimate };
  }
  const balance = await getBalance(supabase, companyId);
  if (balance < estimate) {
    return { ok: false, balance, estimate, message: overtimeMessage(employeeName, balance) };
  }
  return { ok: true, balance, estimate };
}
