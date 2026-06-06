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
        // Onboarding v2: a DRAFT row is created when intake starts, so the form
        // fields + completed_at are nullable until Atlas fills them. onboarding_complete
        // is the real completion gate (not row-existence).
        Row: {
          id: string;
          user_id: string | null;
          company_name: string | null;
          industry: string | null;
          target_customers: string | null;
          brand_tone: string | null;
          main_goal: string | null;
          competitors: string | null;
          employee_count: string | null;
          completed_at: string | null;
          onboarding_complete: boolean;
          created_at: string;
          research_findings: unknown | null;
          plan: string;
          physical_address: string | null;
          warmup_started_at: string | null;
          is_internal: boolean;
          booking_url: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          company_name?: string | null;
          industry?: string | null;
          target_customers?: string | null;
          brand_tone?: string | null;
          main_goal?: string | null;
          competitors?: string | null;
          employee_count?: string | null;
          completed_at?: string | null;
          onboarding_complete?: boolean;
          created_at?: string;
          research_findings?: unknown | null;
          plan?: string;
          physical_address?: string | null;
          warmup_started_at?: string | null;
          is_internal?: boolean;
          booking_url?: string | null;
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
          first_clicked_at: string | null;
          click_count: number;
          booked_at: string | null;
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
          first_clicked_at?: string | null;
          click_count?: number;
          booked_at?: string | null;
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
      hours_ledger: {
        Row: {
          id: string;
          company_id: string;
          delta: number;
          balance_after: number;
          reason: string;
          employee_id: string | null;
          ref_type: string | null;
          ref_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          delta: number;
          balance_after: number;
          reason: string;
          employee_id?: string | null;
          ref_type?: string | null;
          ref_id?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['hours_ledger']['Insert']>;
        Relationships: [];
      };
      email_sends: {
        Row: {
          id: string;
          company_id: string;
          lead_id: string | null;
          to_email: string;
          subject: string;
          status: string;
          reason: string | null;
          provider_id: string | null;
          unsub_token: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          lead_id?: string | null;
          to_email: string;
          subject: string;
          status?: string;
          reason?: string | null;
          provider_id?: string | null;
          unsub_token?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['email_sends']['Insert']>;
        Relationships: [];
      };
      email_suppressions: {
        Row: {
          company_id: string;
          email: string;
          reason: string;
          created_at: string;
        };
        Insert: {
          company_id: string;
          email: string;
          reason?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['email_suppressions']['Insert']>;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      hours_balance: {
        Args: { p_company: string };
        Returns: number;
      };
      hours_append: {
        Args: { p_company: string; p_delta: number; p_reason: string; p_employee?: string | null; p_ref_type?: string | null; p_ref_id?: string | null };
        Returns: number;
      };
      email_unsubscribe: {
        Args: { p_token: string };
        Returns: boolean;
      };
      register_link_click: {
        Args: { p_lead: string; p_company: string };
        Returns: unknown;
      };
      register_booking: {
        Args: { p_lead: string; p_company: string; p_name: string; p_email: string; p_time_pref: string };
        Returns: unknown;
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
