import { supabase } from './supabase';
import type {
  Employee,
  Task,
  ActivityItem,
  MemoryEntry,
  KPI,
  TaskPriority,
  TaskStatus,
  MemoryType,
  EmployeeStatus,
} from './mockData';

import { getMyCompanyId } from './company';
import { getLeads, getDrafts } from './leads';

// Re-export the company profile helpers so callers have one data layer.
export {
  getCompanyProfile,
  saveCompanyProfile,
  isOnboardingComplete,
  resetOnboarding,
  getMyCompanyId,
} from './company';
export type { CompanyProfile } from './company';

// ----------------------------------------------------------------------------
// Row → domain mappers (snake_case DB columns → camelCase TS interfaces)
// ----------------------------------------------------------------------------

type EmployeeRow = {
  id: string; name: string; role: string; avatar: string; color: string;
  status: string; current_task: string; performance_score: number; uptime: string;
  tasks_today: number; bio: string; personality: string; kpis: unknown; responsibilities: unknown;
};

type TaskRow = {
  id: string; title: string; assignee_id: string; priority: string; project: string;
  status: string; created_at: string; due_date: string; sort_order: number;
};

type ActivityRow = {
  id: string; employee_id: string; action: string; timestamp: string; detail: string | null; sort_order: number;
};

type MemoryRow = {
  id: string; type: string; title: string; content: string; tags: unknown; updated_at: string; sort_order: number;
};

function mapEmployee(r: EmployeeRow): Employee {
  return {
    id: r.id,
    name: r.name,
    role: r.role,
    avatar: r.avatar,
    color: r.color,
    status: r.status as EmployeeStatus,
    currentTask: r.current_task,
    performanceScore: r.performance_score,
    uptime: r.uptime,
    tasksToday: r.tasks_today,
    bio: r.bio,
    personality: r.personality,
    kpis: (r.kpis as KPI[]) ?? [],
    responsibilities: (r.responsibilities as string[]) ?? [],
  };
}

function mapTask(r: TaskRow): Task {
  return {
    id: r.id,
    title: r.title,
    assigneeId: r.assignee_id,
    priority: r.priority as TaskPriority,
    project: r.project,
    status: r.status as TaskStatus,
    createdAt: r.created_at,
    dueDate: r.due_date,
  };
}

function mapActivity(r: ActivityRow): ActivityItem {
  return {
    id: r.id,
    employeeId: r.employee_id,
    action: r.action,
    timestamp: r.timestamp,
    detail: r.detail ?? undefined,
  };
}

function mapMemory(r: MemoryRow): MemoryEntry {
  return {
    id: r.id,
    type: r.type as MemoryType,
    title: r.title,
    content: r.content,
    tags: (r.tags as string[]) ?? [],
    updatedAt: r.updated_at,
  };
}

// ----------------------------------------------------------------------------
// Employees
// ----------------------------------------------------------------------------

export async function getEmployees(): Promise<Employee[]> {
  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .order('name', { ascending: true });
  if (error) throw error;
  return (data as EmployeeRow[]).map(mapEmployee);
}

export async function getEmployee(id: string): Promise<Employee | null> {
  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data ? mapEmployee(data as EmployeeRow) : null;
}

// ----------------------------------------------------------------------------
// Tasks
// ----------------------------------------------------------------------------

export async function getTasks(): Promise<Task[]> {
  const companyId = await getMyCompanyId();
  if (!companyId) return [];
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('company_id', companyId)
    .order('sort_order', { ascending: false });
  if (error) throw error;
  return (data as TaskRow[]).map(mapTask);
}

export interface NewTaskInput {
  title: string;
  assigneeId: string;
  priority: TaskPriority;
  project: string;
  dueDate: string;
}

export async function createTask(input: NewTaskInput): Promise<Task> {
  const companyId = await getMyCompanyId();
  if (!companyId) throw new Error('No company found — complete onboarding first.');
  const now = Date.now();
  const row = {
    id: 't' + now,
    company_id: companyId,
    title: input.title,
    assignee_id: input.assigneeId,
    priority: input.priority,
    project: input.project || 'General',
    status: 'queued' as TaskStatus,
    created_at: new Date().toISOString().split('T')[0],
    due_date: input.dueDate || 'TBD',
    sort_order: now, // newest tasks sort above the seed rows
  };
  const { data, error } = await supabase.from('tasks').insert(row).select('*').single();
  if (error) throw error;
  return mapTask(data as TaskRow);
}

export async function updateTaskStatus(id: string, status: TaskStatus): Promise<void> {
  const companyId = await getMyCompanyId();
  if (!companyId) throw new Error('No company found — complete onboarding first.');
  const { error } = await supabase
    .from('tasks')
    .update({ status })
    .eq('id', id)
    .eq('company_id', companyId);
  if (error) throw error;
}

// ----------------------------------------------------------------------------
// Activity
// ----------------------------------------------------------------------------

export async function getActivity(): Promise<ActivityItem[]> {
  const companyId = await getMyCompanyId();
  if (!companyId) return [];
  const { data, error } = await supabase
    .from('activity_log')
    .select('*')
    .eq('company_id', companyId)
    .order('sort_order', { ascending: false });
  if (error) throw error;
  return (data as ActivityRow[]).map(mapActivity);
}

// ----------------------------------------------------------------------------
// Memory
// ----------------------------------------------------------------------------

export async function getMemoryEntries(): Promise<MemoryEntry[]> {
  const companyId = await getMyCompanyId();
  if (!companyId) return [];
  const { data, error } = await supabase
    .from('memory_entries')
    .select('*')
    .eq('company_id', companyId)
    .order('sort_order', { ascending: false });
  if (error) throw error;
  return (data as MemoryRow[]).map(mapMemory);
}

export interface NewMemoryInput {
  type: MemoryType;
  title: string;
  content: string;
  tags: string[];
}

export async function createMemoryEntry(input: NewMemoryInput): Promise<MemoryEntry> {
  const companyId = await getMyCompanyId();
  if (!companyId) throw new Error('No company found — complete onboarding first.');
  const now = Date.now();
  const row = {
    id: 'm' + now,
    company_id: companyId,
    type: input.type,
    title: input.title,
    content: input.content,
    tags: input.tags,
    updated_at: new Date().toISOString().split('T')[0],
    sort_order: now, // newest entries sort above the seed rows
  };
  const { data, error } = await supabase.from('memory_entries').insert(row).select('*').single();
  if (error) throw error;
  return mapMemory(data as MemoryRow);
}

// ----------------------------------------------------------------------------
// Dashboard stats (derived from live data + demo constants)
// ----------------------------------------------------------------------------

// Real, company-scoped workforce stats. NEVER invent metrics (CEO mandate): every
// number comes from actual rows (tasks, leads, drafts, activity). A fresh company
// reads all zeros + hasActivity=false, and the UI shows honest empty states.
// NOTE: there is intentionally NO workforceScore here — the real score formula
// isn't built yet, so the UI shows "—" rather than a mock number.
export interface WorkforceStats {
  activeTasks: number;
  completedTasks: number;
  leadsFound: number;
  qualifiedLeads: number;
  pendingDrafts: number;
  meetingsBooked: number;
  activityCount: number;
  hasActivity: boolean;
}

export async function getWorkforceStats(): Promise<WorkforceStats> {
  const companyId = await getMyCompanyId();
  const empty: WorkforceStats = {
    activeTasks: 0, completedTasks: 0, leadsFound: 0, qualifiedLeads: 0,
    pendingDrafts: 0, meetingsBooked: 0, activityCount: 0, hasActivity: false,
  };
  if (!companyId) return empty;
  const [tasks, leads, drafts, activity] = await Promise.all([
    getTasks(), getLeads(), getDrafts(), getActivity(),
  ]);
  const activeTasks = tasks.filter(t => t.status === 'in_progress').length;
  const completedTasks = tasks.filter(t => t.status === 'completed').length;
  const leadsFound = leads.length;
  const qualifiedLeads = leads.filter(l => l.status === 'qualified').length;
  const pendingDrafts = drafts.filter(d => d.approvalStatus === 'pending').length;
  const meetingsBooked = leads.filter(l => l.status === 'meeting').length;
  const activityCount = activity.length;
  return {
    activeTasks, completedTasks, leadsFound, qualifiedLeads, pendingDrafts, meetingsBooked, activityCount,
    hasActivity: activeTasks + completedTasks + leadsFound + pendingDrafts + meetingsBooked + activityCount > 0,
  };
}

// ----------------------------------------------------------------------------
// Pipeline employees — static UI catalog of roles not yet backed by a table.
// ----------------------------------------------------------------------------

export const pipelineEmployees = [
  { id: 'recruiter', name: 'Rex', role: 'Recruiter', avatar: 'RX', color: '#f59e0b' },
  { id: 'cs', name: 'Clara', role: 'Customer Service Rep', avatar: 'CL', color: '#ec4899' },
  { id: 'ea', name: 'Evan', role: 'Executive Assistant', avatar: 'EV', color: '#8b5cf6' },
  { id: 'pm', name: 'Piper', role: 'Project Manager', avatar: 'PP', color: '#06b6d4' },
  { id: 'finance', name: 'Finn', role: 'Finance Manager', avatar: 'FN', color: '#22c55e' },
];
