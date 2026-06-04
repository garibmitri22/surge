// Shared TypeScript types/interfaces for the app's domain objects.
// The data itself now lives in Supabase — see lib/data.ts and supabase/schema.sql.
export type EmployeeStatus = 'active' | 'idle' | 'offline';
export type TaskStatus = 'queued' | 'in_progress' | 'completed';
export type TaskPriority = 'high' | 'medium' | 'low';
export type MemoryType = 'company' | 'customer' | 'process' | 'sop' | 'note';

export interface KPI {
  label: string;
  value: string;
  change: number; // percent MoM
  unit?: string;
}

export interface Task {
  id: string;
  title: string;
  assigneeId: string;
  priority: TaskPriority;
  project: string;
  status: TaskStatus;
  createdAt: string;
  dueDate: string;
}

export interface ActivityItem {
  id: string;
  employeeId: string;
  action: string;
  timestamp: string;
  detail?: string;
}

export interface Employee {
  id: string;
  name: string;
  role: string;
  avatar: string; // initials
  color: string; // accent color
  status: EmployeeStatus;
  currentTask: string;
  performanceScore: number; // 0–100
  uptime: string;
  tasksToday: number;
  bio: string;
  personality: string;
  kpis: KPI[];
  responsibilities: string[];
}

export interface MemoryEntry {
  id: string;
  type: MemoryType;
  title: string;
  content: string;
  tags: string[];
  updatedAt: string;
}
