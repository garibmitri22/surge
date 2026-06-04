import { createBrowserClient } from '@supabase/ssr';

/**
 * Database schema types — kept in sync with supabase/schema.sql and
 * supabase/auth_migration.sql. Column names are snake_case (Postgres); the
 * camelCase TypeScript interfaces in lib/mockData.ts are mapped to/from these
 * rows in lib/data.ts.
 */
export type Database = {
  public: {
    Tables: {
      companies: {
        Row: {
          id: string;
          user_id: string | null;
          company_name: string;
          industry: string;
          target_customers: string;
          brand_tone: string;
          main_goal: string;
          competitors: string;
          employee_count: string;
          completed_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          company_name: string;
          industry: string;
          target_customers: string;
          brand_tone: string;
          main_goal: string;
          competitors: string;
          employee_count: string;
          completed_at: string;
        };
        Update: Partial<Database['public']['Tables']['companies']['Insert']>;
        Relationships: [];
      };
      employees: {
        Row: {
          id: string;
          name: string;
          role: string;
          avatar: string;
          color: string;
          status: string;
          current_task: string;
          performance_score: number;
          uptime: string;
          tasks_today: number;
          bio: string;
          personality: string;
          kpis: unknown;
          responsibilities: unknown;
        };
        Insert: Database['public']['Tables']['employees']['Row'];
        Update: Partial<Database['public']['Tables']['employees']['Row']>;
        Relationships: [];
      };
      tasks: {
        Row: {
          id: string;
          company_id: string | null;
          title: string;
          assignee_id: string;
          priority: string;
          project: string;
          status: string;
          created_at: string;
          due_date: string;
          sort_order: number;
        };
        Insert: {
          id: string;
          company_id: string;
          title: string;
          assignee_id: string;
          priority: string;
          project: string;
          status: string;
          created_at: string;
          due_date: string;
          sort_order: number;
        };
        Update: Partial<Database['public']['Tables']['tasks']['Insert']>;
        Relationships: [];
      };
      activity_log: {
        Row: {
          id: string;
          company_id: string | null;
          employee_id: string;
          action: string;
          timestamp: string;
          detail: string | null;
          sort_order: number;
        };
        Insert: Database['public']['Tables']['activity_log']['Row'];
        Update: Partial<Database['public']['Tables']['activity_log']['Row']>;
        Relationships: [];
      };
      memory_entries: {
        Row: {
          id: string;
          company_id: string | null;
          type: string;
          title: string;
          content: string;
          tags: unknown;
          updated_at: string;
          sort_order: number;
        };
        Insert: {
          id: string;
          company_id: string;
          type: string;
          title: string;
          content: string;
          tags: unknown;
          updated_at: string;
          sort_order: number;
        };
        Update: Partial<Database['public']['Tables']['memory_entries']['Insert']>;
        Relationships: [];
      };
      conversations: {
        Row: {
          id: string;
          company_id: string;
          employee_id: string;
          title: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          employee_id: string;
          title?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['conversations']['Insert']>;
        Relationships: [];
      };
      messages: {
        Row: {
          id: string;
          conversation_id: string;
          role: string;
          content: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          role: string;
          content: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['messages']['Insert']>;
        Relationships: [];
      };
      leads: {
        Row: {
          id: string;
          company_id: string;
          business_name: string;
          vertical: string;
          location: string | null;
          website: string | null;
          contact_name: string | null;
          contact_role: string | null;
          email: string | null;
          phone: string | null;
          source_url: string;
          score: number;
          score_reasons: unknown;
          status: string;
          disqualify_reason: string | null;
          next_action: string;
          next_action_at: string;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          business_name: string;
          vertical: string;
          location?: string | null;
          website?: string | null;
          contact_name?: string | null;
          contact_role?: string | null;
          email?: string | null;
          phone?: string | null;
          source_url: string;
          score?: number;
          score_reasons: unknown;
          status?: string;
          disqualify_reason?: string | null;
          next_action: string;
          next_action_at: string;
          notes?: string | null;
        };
        Update: Partial<Database['public']['Tables']['leads']['Insert']>;
        Relationships: [];
      };
      lead_drafts: {
        Row: {
          id: string;
          lead_id: string;
          company_id: string;
          channel: string;
          sequence_step: number;
          subject: string;
          body: string;
          approval_status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          lead_id: string;
          company_id: string;
          channel?: string;
          sequence_step?: number;
          subject: string;
          body: string;
          approval_status?: string;
        };
        Update: Partial<Database['public']['Tables']['lead_drafts']['Insert']>;
        Relationships: [];
      };
      usage_counters: {
        Row: {
          company_id: string;
          employee_id: string;
          period: string;
          runs_used: number;
          cycles_used: number;
          media_used: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          company_id: string;
          employee_id: string;
          period: string;
          runs_used?: number;
          cycles_used?: number;
          media_used?: number;
        };
        Update: Partial<Database['public']['Tables']['usage_counters']['Insert']>;
        Relationships: [];
      };
      usage_log: {
        Row: {
          id: string;
          company_id: string;
          employee_id: string;
          task_id: string | null;
          run_id: string | null;
          model: string;
          input_tokens: number;
          cache_read_tokens: number;
          output_tokens: number;
          web_searches: number;
          est_cost_usd: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          employee_id: string;
          task_id?: string | null;
          run_id?: string | null;
          model: string;
          input_tokens?: number;
          cache_read_tokens?: number;
          output_tokens?: number;
          web_searches?: number;
          est_cost_usd?: number;
        };
        Update: Partial<Database['public']['Tables']['usage_log']['Insert']>;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      consume_task_run: {
        Args: { p_company: string; p_employee: string; p_period: string; p_limit: number };
        Returns: number | null;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Typed Supabase browser client. Uses cookie-based storage (via @supabase/ssr)
 * so the session is shared with the server (proxy.ts / server client).
 */
export const supabase = createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
