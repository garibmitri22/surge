// Resolve the user's ONE canonical company — deterministically, the SAME way everywhere
// (dashboard, /leads, Atlas, the agent runner). This replaces the old "most recent company"
// heuristic, which picked up a stale re-onboarding draft so different surfaces disagreed.
//
// Rule: prefer the COMPLETED onboarding row, then the OLDEST (the original — it owns the
// real leads); a not-yet-complete draft is the fallback only when no completed row exists.
// Always filters by user_id EXPLICITLY (defense in depth beyond RLS), and takes any Supabase
// client so the browser lib and the server routes share one source of truth.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './supabase';

export async function resolveCanonicalCompanyId(
  supabase: SupabaseClient<Database>,
  userId: string | null | undefined,
): Promise<string | null> {
  if (!userId) return null;
  const { data } = await supabase
    .from('companies')
    .select('id')
    .eq('user_id', userId)
    .order('onboarding_complete', { ascending: false }) // completed rows first
    .order('created_at', { ascending: true })            // then the original (owns the leads)
    .limit(1)
    .maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}
