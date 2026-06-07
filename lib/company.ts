// Company profile, persisted in the Supabase `companies` table.
// Multi-tenant: every account is scoped to its signed-in user. We enforce ONE company per
// user and resolve it deterministically (see lib/company-resolve.ts) so the dashboard,
// /leads, and Atlas always read the same canonical row — never "whichever was created last".
import { supabase } from './supabase';
import { resolveCanonicalCompanyId } from './company-resolve';

export interface CompanyProfile {
  companyName: string;
  industry: string;
  targetCustomers: string;
  brandTone: string;
  mainGoal: string;
  competitors: string;
  employeeCount: string;
  completedAt: string;
}

// Onboarding v2: a draft row can exist with these fields still null, so the row
// shape is nullable and the mapper coalesces to '' for the UI.
type CompanyRow = {
  id: string;
  company_name: string | null;
  industry: string | null;
  target_customers: string | null;
  brand_tone: string | null;
  main_goal: string | null;
  competitors: string | null;
  employee_count: string | null;
  completed_at: string | null;
};

function mapCompany(r: CompanyRow): CompanyProfile {
  return {
    companyName: r.company_name ?? '',
    industry: r.industry ?? '',
    targetCustomers: r.target_customers ?? '',
    brandTone: r.brand_tone ?? '',
    mainGoal: r.main_goal ?? '',
    competitors: r.competitors ?? '',
    employeeCount: r.employee_count ?? '',
    completedAt: r.completed_at ?? '',
  };
}

export async function getCompanyProfile(): Promise<CompanyProfile | null> {
  const companyId = await getMyCompanyId();
  if (!companyId) return null;
  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .eq('id', companyId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapCompany(data as CompanyRow) : null;
}

export async function saveCompanyProfile(profile: CompanyProfile): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('You must be signed in to save your company profile.');
  // One company per user: clear any existing one (RLS limits this to my own).
  await resetOnboarding();
  const { error } = await supabase.from('companies').insert({
    user_id: user.id,
    company_name: profile.companyName,
    industry: profile.industry,
    target_customers: profile.targetCustomers,
    brand_tone: profile.brandTone,
    main_goal: profile.mainGoal,
    competitors: profile.competitors,
    employee_count: profile.employeeCount,
    completed_at: profile.completedAt,
    // Onboarding v2: completion is a flag. The old form completes in one shot, so
    // it sets the flag directly. The Atlas intake flips it server-side via
    // complete_onboarding (app/api/chat) only after the required set is confirmed.
    onboarding_complete: true,
  });
  if (error) throw error;
}

/** The current user's ONE canonical company id (the completed row that owns the leads,
 *  or the draft during intake). Deterministic + user_id-scoped — see company-resolve.ts.
 *  null only when the user has no company row at all. */
export async function getMyCompanyId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return resolveCanonicalCompanyId(supabase, user.id);
}

/** Onboarding is done only when a row has the flag set — a draft row does NOT count. */
export async function isOnboardingComplete(): Promise<boolean> {
  const { count, error } = await supabase
    .from('companies')
    .select('id', { count: 'exact', head: true })
    .eq('onboarding_complete', true);
  if (error) throw error;
  return (count ?? 0) > 0;
}

export async function resetOnboarding(): Promise<void> {
  // Delete only the signed-in user's own company row(s).
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase.from('companies').delete().eq('user_id', user.id);
  if (error) throw error;
}
