export type WorkFormatType = "Гибридный" | "В офисе" | "Удаленно"

export type User = {
  id: string
  name: string
  email: string
  avatar_url?: string
  position: string
  department: string
  team: string
  category: string
  role?: string
  dateJoined: string
  workLocation: "office" | "remote" | "hybrid"
  country?: string
  city?: string
  employmentRate: number
  salary: number
  isHourly: boolean
}

// Расширенный тип пользователя с информацией о ролях из view_users
export type UserWithRoles = {
  user_id: string
  first_name: string
  last_name: string
  email: string
  created_at: string
  work_format: string | null
  employment_rate: string | null
  salary: string | null
  is_hourly: boolean | null
  avatar_url: string | null
  department_id: string | null
  department_name: string | null
  team_id: string | null
  team_name: string | null
  position_id: string | null
  position_name: string | null
  category_id: string | null
  category_name: string | null
  // Старые поля ролей удалены - используем новую систему
  city_id: string | null
  city_name: string | null
  country_id: string | null
  country_name: string | null
  full_name: string
  is_active: boolean
  // Новые поля для ролей
  primary_role: string | null
  roles_display_string: string | null
  roles_count: number
  has_multiple_roles: boolean
}

export type Department = {
  id: string
  name: string
}

export type Team = {
  id: string
  name: string
  departmentId: string
}

export type Position = {
  id: string
  name: string
}

export type Category = {
  id: string
  name: string
}

export type UsersFilter = {
  roles: string[]
  departments: string[]
  teams: string[]
  search: string
}

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      categories: {
        Row: {
          category_id: string
          category_name: string | null
          ws_category_id: number | null
        }
        Insert: {
          category_id: string
          category_name?: string | null
          ws_category_id?: number | null
        }
        Update: {
          category_id?: string
          category_name?: string | null
          ws_category_id?: number | null
        }
        Relationships: []
      }
      departments: {
        Row: {
          department_id: string
          department_name: string | null
          ws_department_id: number | null
        }
        Insert: {
          department_id: string
          department_name?: string | null
          ws_department_id?: number | null
        }
        Update: {
          department_id?: string
          department_name?: string | null
          ws_department_id?: number | null
        }
        Relationships: []
      }
      permissions: {
        Row: {
          created_at: string
          description: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      positions: {
        Row: {
          position_id: string
          position_name: string | null
          ws_position_id: number | null
        }
        Insert: {
          position_id: string
          position_name?: string | null
          ws_position_id?: number | null
        }
        Update: {
          position_id?: string
          position_name?: string | null
          ws_position_id?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          city: string | null
          country: string | null
          avatar_url: string | null
          category_id: string
          created_at: string
          department_id: string | null
          email: string
          employment_rate: number | null
          first_name: string
          is_hourly: boolean | null
          last_name: string
          position_id: string
          role_id: string
          salary: number | null
          team_id: string | null
          user_id: string
          work_format: Database["public"]["Enums"]["work_format_type"] | null
        }
        Insert: {
          city?: string | null
          country?: string | null
          avatar_url?: string | null
          category_id: string
          created_at?: string
          department_id?: string | null
          email: string
          employment_rate?: number | null
          first_name: string
          is_hourly?: boolean | null
          last_name: string
          position_id: string
          role_id: string
          salary?: number | null
          team_id?: string | null
          user_id: string
          work_format?: Database["public"]["Enums"]["work_format_type"] | null
        }
        Update: {
          city?: string | null
          country?: string | null
          avatar_url?: string | null
          category_id?: string
          created_at?: string
          department_id?: string | null
          email?: string
          employment_rate?: number | null
          first_name?: string
          is_hourly?: boolean | null
          last_name?: string
          position_id?: string
          role_id?: string
          salary?: number | null
          team_id?: string | null
          user_id?: string
          work_format?: Database["public"]["Enums"]["work_format_type"] | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["category_id"]
          },
          {
            foreignKeyName: "profiles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["department_id"]
          },
          {
            foreignKeyName: "profiles_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["position_id"]
          },
          {
            foreignKeyName: "profiles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["team_id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          created_at: string
          id: string
          permission_id: string
          role_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          permission_id: string
          role_id: string
        }
        Update: {
          created_at?: string
          id?: string
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      teams: {
        Row: {
          department_id: string | null
          team_id: string
          team_name: string | null
          ws_team_id: number | null
        }
        Insert: {
          department_id?: string | null
          team_id?: string
          team_name?: string | null
          ws_team_id?: number | null
        }
        Update: {
          department_id?: string | null
          team_id?: string
          team_name?: string | null
          ws_team_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "teams_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["department_id"]
          },
        ]
      }
      user_roles: {
        Row: {
          role_id: string
          user_id: string
          assigned_by?: string | null
          assigned_at?: string | null
        }
        Insert: {
          role_id: string
          user_id: string
          assigned_by?: string | null
          assigned_at?: string | null
        }
        Update: {
          role_id?: string
          user_id?: string
          assigned_by?: string | null
          assigned_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      work_format_type: "Гибридный" | "В офисе" | "Удаленно"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      work_format_type: ["Гибридный", "В офисе", "Удаленно"],
    },
  },
} as const
