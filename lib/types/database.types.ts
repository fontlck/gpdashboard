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
      artist_summaries: {
        Row: {
          artist_name: string
          branch_id: string
          created_at: string
          gross_sales: number
          id: string
          monthly_report_id: string
          order_count: number
          reporting_month: number
          reporting_year: number
          total_net: number
          updated_at: string
        }
        Insert: {
          artist_name: string
          branch_id: string
          created_at?: string
          gross_sales?: number
          id?: string
          monthly_report_id: string
          order_count?: number
          reporting_month: number
          reporting_year: number
          total_net?: number
          updated_at?: string
        }
        Update: {
          artist_name?: string
          branch_id?: string
          created_at?: string
          gross_sales?: number
          id?: string
          monthly_report_id?: string
          order_count?: number
          reporting_month?: number
          reporting_year?: number
          total_net?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "artist_summaries_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "artist_summaries_monthly_report_id_fkey"
            columns: ["monthly_report_id"]
            isOneToOne: false
            referencedRelation: "monthly_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string
          after_state: Json | null
          before_state: Json | null
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          metadata: Json | null
        }
        Insert: {
          action: string
          actor_id: string
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          metadata?: Json | null
        }
        Update: {
          action?: string
          actor_id?: string
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          metadata?: Json | null
        }
        Relationships: []
      }
      branches: {
        Row: {
          code: string
          created_at: string
          fixed_rent_amount: number | null
          fixed_rent_vat_mode:
            | Database["public"]["Enums"]["fixed_rent_vat_mode_enum"]
            | null
          id: string
          is_active: boolean
          location: string | null
          name: string
          partner_id: string
          partnership_start_date: string | null
          partnership_start_date_source: string | null
          payout_type: Database["public"]["Enums"]["payout_type_enum"]
          revenue_share_pct: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          fixed_rent_amount?: number | null
          fixed_rent_vat_mode?:
            | Database["public"]["Enums"]["fixed_rent_vat_mode_enum"]
            | null
          id?: string
          is_active?: boolean
          location?: string | null
          name: string
          partner_id: string
          partnership_start_date?: string | null
          partnership_start_date_source?: string | null
          payout_type?: Database["public"]["Enums"]["payout_type_enum"]
          revenue_share_pct: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          fixed_rent_amount?: number | null
          fixed_rent_vat_mode?:
            | Database["public"]["Enums"]["fixed_rent_vat_mode_enum"]
            | null
          id?: string
          is_active?: boolean
          location?: string | null
          name?: string
          partner_id?: string
          partnership_start_date?: string | null
          partnership_start_date_source?: string | null
          payout_type?: Database["public"]["Enums"]["payout_type_enum"]
          revenue_share_pct?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "branches_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      csv_uploads: {
        Row: {
          branches_found: number | null
          created_at: string
          id: string
          is_overwrite: boolean
          original_filename: string
          reporting_month: number
          reporting_year: number
          row_count_imported: number | null
          row_count_skipped: number | null
          row_count_total: number | null
          skipped_rows: Json | null
          status: string
          storage_path: string
          superseded_by: string | null
          uploaded_by: string
          validation_errors: Json | null
        }
        Insert: {
          branches_found?: number | null
          created_at?: string
          id?: string
          is_overwrite?: boolean
          original_filename: string
          reporting_month: number
          reporting_year: number
          row_count_imported?: number | null
          row_count_skipped?: number | null
          row_count_total?: number | null
          skipped_rows?: Json | null
          status?: string
          storage_path: string
          superseded_by?: string | null
          uploaded_by: string
          validation_errors?: Json | null
        }
        Update: {
          branches_found?: number | null
          created_at?: string
          id?: string
          is_overwrite?: boolean
          original_filename?: string
          reporting_month?: number
          reporting_year?: number
          row_count_imported?: number | null
          row_count_skipped?: number | null
          row_count_total?: number | null
          skipped_rows?: Json | null
          status?: string
          storage_path?: string
          superseded_by?: string | null
          uploaded_by?: string
          validation_errors?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "csv_uploads_superseded_by_fkey"
            columns: ["superseded_by"]
            isOneToOne: false
            referencedRelation: "csv_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_reports: {
        Row: {
          adjusted_net: number
          approved_at: string | null
          approved_by: string | null
          branch_id: string
          created_at: string
          csv_upload_id: string
          final_payout: number
          fixed_rent_snapshot: number | null
          fixed_rent_vat_mode_snapshot:
            | Database["public"]["Enums"]["fixed_rent_vat_mode_enum"]
            | null
          gross_sales: number
          has_negative_adjusted_net: boolean
          id: string
          is_vat_registered_snapshot: boolean
          notes: string | null
          partner_share_base: number
          payout_type_snapshot: Database["public"]["Enums"]["payout_type_enum"]
          recalculated_at: string | null
          reporting_month: number
          reporting_year: number
          revenue_share_pct_snapshot: number
          status: string
          total_net: number
          total_opn_fee: number
          total_refunds: number
          total_skipped_currency: number
          total_skipped_date: number
          total_skipped_status: number
          total_transaction_count: number
          updated_at: string
          vat_amount: number
          vat_rate_snapshot: number
        }
        Insert: {
          adjusted_net?: number
          approved_at?: string | null
          approved_by?: string | null
          branch_id: string
          created_at?: string
          csv_upload_id: string
          final_payout?: number
          fixed_rent_snapshot?: number | null
          fixed_rent_vat_mode_snapshot?:
            | Database["public"]["Enums"]["fixed_rent_vat_mode_enum"]
            | null
          gross_sales?: number
          has_negative_adjusted_net?: boolean
          id?: string
          is_vat_registered_snapshot: boolean
          notes?: string | null
          partner_share_base?: number
          payout_type_snapshot?: Database["public"]["Enums"]["payout_type_enum"]
          recalculated_at?: string | null
          reporting_month: number
          reporting_year: number
          revenue_share_pct_snapshot: number
          status?: string
          total_net?: number
          total_opn_fee?: number
          total_refunds?: number
          total_skipped_currency?: number
          total_skipped_date?: number
          total_skipped_status?: number
          total_transaction_count?: number
          updated_at?: string
          vat_amount?: number
          vat_rate_snapshot: number
        }
        Update: {
          adjusted_net?: number
          approved_at?: string | null
          approved_by?: string | null
          branch_id?: string
          created_at?: string
          csv_upload_id?: string
          final_payout?: number
          fixed_rent_snapshot?: number | null
          fixed_rent_vat_mode_snapshot?:
            | Database["public"]["Enums"]["fixed_rent_vat_mode_enum"]
            | null
          gross_sales?: number
          has_negative_adjusted_net?: boolean
          id?: string
          is_vat_registered_snapshot?: boolean
          notes?: string | null
          partner_share_base?: number
          payout_type_snapshot?: Database["public"]["Enums"]["payout_type_enum"]
          recalculated_at?: string | null
          reporting_month?: number
          reporting_year?: number
          revenue_share_pct_snapshot?: number
          status?: string
          total_net?: number
          total_opn_fee?: number
          total_refunds?: number
          total_skipped_currency?: number
          total_skipped_date?: number
          total_skipped_status?: number
          total_transaction_count?: number
          updated_at?: string
          vat_amount?: number
          vat_rate_snapshot?: number
        }
        Relationships: [
          {
            foreignKeyName: "monthly_reports_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_reports_csv_upload_id_fkey"
            columns: ["csv_upload_id"]
            isOneToOne: false
            referencedRelation: "csv_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      partners: {
        Row: {
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          id: string
          is_active: boolean
          is_vat_registered: boolean
          name: string
          notes: string | null
          updated_at: string
          vat_number: string | null
        }
        Insert: {
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_vat_registered?: boolean
          name: string
          notes?: string | null
          updated_at?: string
          vat_number?: string | null
        }
        Update: {
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_vat_registered?: boolean
          name?: string
          notes?: string | null
          updated_at?: string
          vat_number?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          is_active: boolean
          partner_id: string | null
          role: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name: string
          id: string
          is_active?: boolean
          partner_id?: string | null
          role: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          is_active?: boolean
          partner_id?: string | null
          role?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      refunds: {
        Row: {
          amount: number
          branch_id: string
          created_at: string
          entered_by: string
          id: string
          monthly_report_id: string | null
          reason: string
          reference_number: string | null
          reporting_month: number
          reporting_year: number
          updated_at: string
        }
        Insert: {
          amount: number
          branch_id: string
          created_at?: string
          entered_by: string
          id?: string
          monthly_report_id?: string | null
          reason: string
          reference_number?: string | null
          reporting_month: number
          reporting_year: number
          updated_at?: string
        }
        Update: {
          amount?: number
          branch_id?: string
          created_at?: string
          entered_by?: string
          id?: string
          monthly_report_id?: string | null
          reason?: string
          reference_number?: string | null
          reporting_month?: number
          reporting_year?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "refunds_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_monthly_report_id_fkey"
            columns: ["monthly_report_id"]
            isOneToOne: false
            referencedRelation: "monthly_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      report_rows: {
        Row: {
          amount: number
          artist_name_raw: string | null
          branch_name_raw: string | null
          charge_id: string
          created_at: string
          csv_upload_id: string
          currency: string
          customer_email: string | null
          id: string
          monthly_report_id: string
          net: number
          opn_fee: number
          opn_fee_vat: number
          opn_refunded: boolean
          opn_refunded_amount: number
          payment_source: string | null
          raw_data: Json | null
          row_number: number
          transaction_date: string
        }
        Insert: {
          amount: number
          artist_name_raw?: string | null
          branch_name_raw?: string | null
          charge_id: string
          created_at?: string
          csv_upload_id: string
          currency?: string
          customer_email?: string | null
          id?: string
          monthly_report_id: string
          net: number
          opn_fee?: number
          opn_fee_vat?: number
          opn_refunded?: boolean
          opn_refunded_amount?: number
          payment_source?: string | null
          raw_data?: Json | null
          row_number: number
          transaction_date: string
        }
        Update: {
          amount?: number
          artist_name_raw?: string | null
          branch_name_raw?: string | null
          charge_id?: string
          created_at?: string
          csv_upload_id?: string
          currency?: string
          customer_email?: string | null
          id?: string
          monthly_report_id?: string
          net?: number
          opn_fee?: number
          opn_fee_vat?: number
          opn_refunded?: boolean
          opn_refunded_amount?: number
          payment_source?: string | null
          raw_data?: Json | null
          row_number?: number
          transaction_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_rows_csv_upload_id_fkey"
            columns: ["csv_upload_id"]
            isOneToOne: false
            referencedRelation: "csv_uploads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_rows_monthly_report_id_fkey"
            columns: ["monthly_report_id"]
            isOneToOne: false
            referencedRelation: "monthly_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          description: string | null
          id: string
          key: string
          updated_at: string
          updated_by: string | null
          value: string
          value_type: string
        }
        Insert: {
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value: string
          value_type: string
        }
        Update: {
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: string
          value_type?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_my_partner_id: { Args: never; Returns: string }
      is_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      fixed_rent_vat_mode_enum: "exclusive" | "inclusive"
      payout_type_enum: "revenue_share" | "fixed_rent"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      fixed_rent_vat_mode_enum: ["exclusive", "inclusive"],
      payout_type_enum: ["revenue_share", "fixed_rent"],
    },
  },
} as const

// ── App-level status types ────────────────────────────────────────────────────
// These are application-level string enumerations stored as plain `text` in the
// DB but narrowed here for type safety across the front-end.

export type ReportStatus = 'draft' | 'pending_review' | 'approved' | 'paid'
export type UploadStatus = 'pending' | 'validated' | 'mapped' | 'imported' | 'failed' | 'superseded'
