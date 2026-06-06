// Surge — org structure (departments) + the hiring catalog. Data-driven so adding
// role #5/#10 never needs a rewrite (Architecture Law #1/#4). Plain ESM so pages,
// routes, and any verify share one source of truth.

// What each active teammate does — outcome language (matches the credibility pass).
export const EMP_OUTCOME = {
  aria: 'Finds and ranks new leads, drafts personalized outreach, and follows up automatically — so no prospect slips through.',
  nova: 'Creates on-brand social posts, content, and campaign ideas you approve in one click.',
  opus: 'Organizes tasks, prepares meeting briefs, and keeps every follow-up on track.',
  atlas: 'Runs your morning briefing, routes work across the team, and flags what needs your decision.',
};

// Departments for the workforce org view (CEO → Chief of Staff → Sales/Marketing/Ops).
export const DEPARTMENTS = [
  { id: 'leadership', name: 'Leadership', employeeIds: ['atlas'] },
  { id: 'sales', name: 'Sales', employeeIds: ['aria'] },
  { id: 'marketing', name: 'Marketing', employeeIds: ['nova'] },
  { id: 'operations', name: 'Operations', employeeIds: ['opus'] },
];

const EMP_DEPT = (() => {
  const m = {};
  for (const d of DEPARTMENTS) for (const id of d.employeeIds) m[id] = d.id;
  return m;
})();

export function departmentOf(employeeId) {
  return EMP_DEPT[employeeId] || 'operations';
}

export function departmentName(deptId) {
  return (DEPARTMENTS.find((d) => d.id === deptId) || {}).name || 'Team';
}

// The hiring catalog — organized like staffing a company. status:
//   'active'   → a real, available employee (Hire)
//   'soon'     → an honestly-labeled future role (Coming soon) — NEVER fake-available
//   'waitlist' → a pipeline employee from MEMORY (Join waitlist) — the expansion path
export const HIRE_CATALOG = [
  {
    dept: 'Leadership', deptId: 'leadership',
    roles: [
      { status: 'active', id: 'atlas', name: 'Atlas', role: 'Chief of Staff', desc: EMP_OUTCOME.atlas, included: true },
    ],
  },
  {
    dept: 'Sales', deptId: 'sales',
    roles: [
      { status: 'active', id: 'aria', name: 'Aria', role: 'Sales Representative', desc: EMP_OUTCOME.aria },
      { status: 'soon', name: 'Account Executive', role: 'Sales', desc: 'Runs live demos and closes warm pipeline. In development.' },
    ],
  },
  {
    dept: 'Marketing', deptId: 'marketing',
    roles: [
      { status: 'active', id: 'nova', name: 'Nova', role: 'Marketing Director', desc: EMP_OUTCOME.nova },
      { status: 'soon', name: 'Content Writer', role: 'Marketing', desc: 'Long-form blogs and email sequences at volume. In development.' },
      { status: 'soon', name: 'SEO Specialist', role: 'Marketing', desc: 'Keyword strategy and on-page optimization. In development.' },
    ],
  },
  {
    dept: 'Operations', deptId: 'operations',
    roles: [
      { status: 'active', id: 'opus', name: 'Opus', role: 'Operations', desc: EMP_OUTCOME.opus },
      { status: 'soon', name: 'Project Manager', role: 'Operations', desc: 'Plans projects and tracks every deliverable to done. In development.' },
    ],
  },
  {
    dept: 'Expansion — join the waitlist', deptId: 'expansion',
    roles: [
      { status: 'waitlist', id: 'recruiter', name: 'Rex', role: 'Recruiter', desc: 'Sources and screens candidates so you only meet the best.' },
      { status: 'waitlist', id: 'cs', name: 'Clara', role: 'Customer Service Rep', desc: 'Answers customers fast and keeps satisfaction high.' },
      { status: 'waitlist', id: 'ea', name: 'Evan', role: 'Executive Assistant', desc: 'Inbox, calendar, and the details you keep dropping.' },
      { status: 'waitlist', id: 'pm', name: 'Piper', role: 'Project Manager', desc: 'Keeps projects on time and everyone accountable.' },
      { status: 'waitlist', id: 'finance', name: 'Finn', role: 'Finance Manager', desc: 'Invoicing, bookkeeping hygiene, and a clear money picture.' },
    ],
  },
];

// The active employee ids that can actually be hired/enabled today.
export const ACTIVE_EMPLOYEE_IDS = ['atlas', 'aria', 'nova', 'opus'];

/**
 * Entitlement SEAM (Stripe lands later). Today: internal/owner accounts can enable any
 * active employee freely, and an employee counts as enabled once it's in
 * companies.hired_employees. When billing ships, gate here by plan (single = the one
 * chosen employee, team = all) — this is the single place to add that check.
 * @param {{ is_internal?: boolean, hired_employees?: string[]|null }} company
 */
export function isEmployeeEnabled(company, employeeId) {
  if (!ACTIVE_EMPLOYEE_IDS.includes(employeeId)) return false;
  if (company?.is_internal) return true;
  const hired = Array.isArray(company?.hired_employees) ? company.hired_employees : [];
  // Atlas (Chief of Staff) is included with every plan.
  if (employeeId === 'atlas') return true;
  return hired.includes(employeeId);
}
