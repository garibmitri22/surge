// Company profile, persisted in the Supabase `companies` table.
// Single-tenant for now (no auth) — there is at most one company row.
import { supabase } from './supabase';

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

type CompanyRow = {
  id: string;
  company_name: string;
  industry: string;
  target_customers: string;
  brand_tone: string;
  main_goal: string;
  competitors: string;
  employee_count: string;
  completed_at: string;
};

function mapCompany(r: CompanyRow): CompanyProfile {
  return {
    companyName: r.company_name,
    industry: r.industry,
    targetCustomers: r.target_customers,
    brandTone: r.brand_tone,
    mainGoal: r.main_goal,
    competitors: r.competitors,
    employeeCount: r.employee_count,
    completedAt: r.completed_at,
  };
}

export async function getCompanyProfile(): Promise<CompanyProfile | null> {
  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .order('completed_at', { ascending: false })
    .limit(1)
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
  });
  if (error) throw error;
}

/** The current user's company id (null if onboarding isn't done yet). RLS scopes this to the signed-in user. */
export async function getMyCompanyId(): Promise<string | null> {
  const { data, error } = await supabase
    .from('companies')
    .select('id')
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

export async function isOnboardingComplete(): Promise<boolean> {
  const { count, error } = await supabase
    .from('companies')
    .select('id', { count: 'exact', head: true });
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
