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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      drafts: {
        Row: {
          approved: boolean
          caption: string
          id: string
          owner_id: string
          platform: string
          revision: number
          saved_set_id: string
          updated_at: string
          visual_brief: string
        }
        Insert: {
          approved?: boolean
          caption: string
          id?: string
          owner_id: string
          platform: string
          revision?: number
          saved_set_id: string
          updated_at?: string
          visual_brief: string
        }
        Update: {
          approved?: boolean
          caption?: string
          id?: string
          owner_id?: string
          platform?: string
          revision?: number
          saved_set_id?: string
          updated_at?: string
          visual_brief?: string
        }
        Relationships: [
          {
            foreignKeyName: "drafts_saved_set_id_fkey"
            columns: ["saved_set_id"]
            isOneToOne: false
            referencedRelation: "saved_idea_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_idea_claims: {
        Row: {
          business_name: string
          claim_token_hash: string
          claimed_at: string | null
          claimed_by: string | null
          created_at: string
          description: string
          email_key: string
          expires_at: string
          id: string
          ideas: Json
          is_custom_topic: boolean
          saved_set_id: string | null
          selected_idea_index: number
          topic: string
          website: string
        }
        Insert: {
          business_name: string
          claim_token_hash: string
          claimed_at?: string | null
          claimed_by?: string | null
          created_at?: string
          description?: string
          email_key: string
          expires_at: string
          id?: string
          ideas: Json
          is_custom_topic?: boolean
          saved_set_id?: string | null
          selected_idea_index?: number
          topic: string
          website: string
        }
        Update: {
          business_name?: string
          claim_token_hash?: string
          claimed_at?: string | null
          claimed_by?: string | null
          created_at?: string
          description?: string
          email_key?: string
          expires_at?: string
          id?: string
          ideas?: Json
          is_custom_topic?: boolean
          saved_set_id?: string | null
          selected_idea_index?: number
          topic?: string
          website?: string
        }
        Relationships: [
          {
            foreignKeyName: "pending_idea_claims_saved_set_id_fkey"
            columns: ["saved_set_id"]
            isOneToOne: false
            referencedRelation: "saved_idea_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_idea_sets: {
        Row: {
          business_name: string
          created_at: string
          description: string
          id: string
          ideas: Json
          is_custom_topic: boolean
          owner_id: string
          selected_idea_index: number
          topic: string
          website: string
        }
        Insert: {
          business_name: string
          created_at?: string
          description?: string
          id?: string
          ideas: Json
          is_custom_topic?: boolean
          owner_id: string
          selected_idea_index?: number
          topic: string
          website: string
        }
        Update: {
          business_name?: string
          created_at?: string
          description?: string
          id?: string
          ideas?: Json
          is_custom_topic?: boolean
          owner_id?: string
          selected_idea_index?: number
          topic?: string
          website?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_and_save_ideas: {
        Args: {
          _claim_token_hash: string
          _email_key: string
          _user_id: string
        }
        Returns: {
          reason: string
          saved_set_id: string
        }[]
      }
      claim_pending_ideas: {
        Args: {
          _claim_token_hash: string
          _email_key: string
          _user_id: string
        }
        Returns: {
          id: string
          ideas: Json
          selected_idea_index: number
        }[]
      }
      normalize_email: { Args: { _email: string }; Returns: string }
      recover_unsaved_claim: {
        Args: {
          _claim_token_hash: string
          _email_key: string
          _user_id: string
        }
        Returns: {
          reason: string
          saved_set_id: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
