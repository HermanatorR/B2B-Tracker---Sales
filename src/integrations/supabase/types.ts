export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string
          business_id: string | null
          business_name: string | null
          company_id: string
          created_at: string
          id: string
          quantity: number | null
          user_id: string
        }
        Insert: {
          action: string
          business_id?: string | null
          business_name?: string | null
          company_id: string
          created_at?: string
          id?: string
          quantity?: number | null
          user_id: string
        }
        Update: {
          action?: string
          business_id?: string | null
          business_name?: string | null
          company_id?: string
          created_at?: string
          id?: string
          quantity?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_stats"
            referencedColumns: ["business_id"]
          },
          {
            foreignKeyName: "activity_logs_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          address: string
          assigned_to: string | null
          city: string | null
          company_id: string
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          contact_title: string | null
          created_at: string
          created_by: string | null
          id: string
          is_demo: boolean
          latitude: number | null
          longitude: number | null
          name: string
          notes: string | null
          postal_code: string | null
          province: string | null
          updated_at: string
        }
        Insert: {
          address: string
          assigned_to?: string | null
          city?: string | null
          company_id: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          contact_title?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_demo?: boolean
          latitude?: number | null
          longitude?: number | null
          name: string
          notes?: string | null
          postal_code?: string | null
          province?: string | null
          updated_at?: string
        }
        Update: {
          address?: string
          assigned_to?: string | null
          city?: string | null
          company_id?: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          contact_title?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_demo?: boolean
          latitude?: number | null
          longitude?: number | null
          name?: string
          notes?: string | null
          postal_code?: string | null
          province?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "businesses_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "businesses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "businesses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          id: string
          logo_url: string | null
          name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          logo_url?: string | null
          name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      company_settings: {
        Row: {
          company_id: string
          high_turnover_days: number
          medium_turnover_days: number
          overdue_percent: number
          stale_visit_days: number
          updated_at: string
          visit_soon_percent: number
        }
        Insert: {
          company_id: string
          high_turnover_days?: number
          medium_turnover_days?: number
          overdue_percent?: number
          stale_visit_days?: number
          updated_at?: string
          visit_soon_percent?: number
        }
        Update: {
          company_id?: string
          high_turnover_days?: number
          medium_turnover_days?: number
          overdue_percent?: number
          stale_visit_days?: number
          updated_at?: string
          visit_soon_percent?: number
        }
        Relationships: [
          {
            foreignKeyName: "company_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      coupon_distributions: {
        Row: {
          business_id: string
          company_id: string
          created_at: string
          distributed_on: string
          id: string
          note: string | null
          quantity: number
          user_id: string
        }
        Insert: {
          business_id: string
          company_id: string
          created_at?: string
          distributed_on?: string
          id?: string
          note?: string | null
          quantity: number
          user_id: string
        }
        Update: {
          business_id?: string
          company_id?: string
          created_at?: string
          distributed_on?: string
          id?: string
          note?: string | null
          quantity?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupon_distributions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_stats"
            referencedColumns: ["business_id"]
          },
          {
            foreignKeyName: "coupon_distributions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_distributions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      coupon_envelopes: {
        Row: {
          business_id: string
          cancelled_at: string | null
          company_id: string
          created_at: string
          distributed_at: string | null
          distribution_id: string | null
          id: string
          prepared_at: string
          prepared_by: string
          quantity_distributed: number | null
          quantity_prepared: number
          status: string
          updated_at: string
        }
        Insert: {
          business_id: string
          cancelled_at?: string | null
          company_id: string
          created_at?: string
          distributed_at?: string | null
          distribution_id?: string | null
          id?: string
          prepared_at?: string
          prepared_by: string
          quantity_distributed?: number | null
          quantity_prepared: number
          status?: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          cancelled_at?: string | null
          company_id?: string
          created_at?: string
          distributed_at?: string | null
          distribution_id?: string | null
          id?: string
          prepared_at?: string
          prepared_by?: string
          quantity_distributed?: number | null
          quantity_prepared?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupon_envelopes_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_stats"
            referencedColumns: ["business_id"]
          },
          {
            foreignKeyName: "coupon_envelopes_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_envelopes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_envelopes_distribution_id_fkey"
            columns: ["distribution_id"]
            isOneToOne: true
            referencedRelation: "coupon_distributions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_envelopes_prepared_by_fkey"
            columns: ["prepared_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      coupon_returns: {
        Row: {
          business_id: string
          company_id: string
          created_at: string
          id: string
          note: string | null
          quantity: number
          returned_on: string
          user_id: string
        }
        Insert: {
          business_id: string
          company_id: string
          created_at?: string
          id?: string
          note?: string | null
          quantity: number
          returned_on?: string
          user_id: string
        }
        Update: {
          business_id?: string
          company_id?: string
          created_at?: string
          id?: string
          note?: string | null
          quantity?: number
          returned_on?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupon_returns_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_stats"
            referencedColumns: ["business_id"]
          },
          {
            foreignKeyName: "coupon_returns_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_returns_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          company_id: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          is_active: boolean
          is_demo: boolean
          onboarded: boolean
          phone: string | null
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id: string
          is_active?: boolean
          is_demo?: boolean
          onboarded?: boolean
          phone?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          is_demo?: boolean
          onboarded?: boolean
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          company_id: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      business_stats: {
        Row: {
          business_id: string | null
          company_id: string | null
          distribution_count: number | null
          first_distribution: string | null
          last_distribution: string | null
          last_return: string | null
          return_count: number | null
          total_distributed: number | null
          total_returned: number | null
        }
        Relationships: [
          {
            foreignKeyName: "businesses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      bootstrap_company: {
        Args: { _company_name: string; _full_name: string }
        Returns: string
      }
      business_history: {
        Args: { _business_id: string }
        Returns: {
          created_at: string
          happened_on: string
          id: string
          kind: string
          note: string
          quantity: number
          recorded_by: string
          user_id: string
        }[]
      }
      cancel_envelope: { Args: { _envelope_id: string }; Returns: undefined }
      company_business_stats: {
        Args: never
        Returns: {
          business_id: string
          distribution_count: number
          first_distribution: string
          last_distribution: string
          last_return: string
          return_count: number
          total_distributed: number
          total_returned: number
        }[]
      }
      distribute_envelope: {
        Args: { _envelope_id: string; _note?: string; _quantity: number }
        Returns: string
      }
      employee_last_activity: {
        Args: never
        Returns: {
          last_activity: string
          user_id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      my_company_id: { Args: never; Returns: string }
      report_daily_totals: {
        Args: { _from: string; _to: string }
        Returns: {
          business_id: string
          day: string
          kind: string
          quantity: number
          user_id: string
        }[]
      }
      update_envelope_quantity: {
        Args: { _envelope_id: string; _quantity: number }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "sales_rep"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "sales_rep"],
    },
  },
} as const
