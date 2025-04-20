export type WorkFormatType = "Гибридный" | "В офисе" | "Удаленно"

export type User = {
  id: string
  name: string
  email: string
  avatar: string
  position: string
  department: string
  team: string
  category: string
  isActive: boolean
  dateJoined: string
  workLocation: "office" | "remote" | "hybrid"
  address: string
  employmentRate: number
  salary: number
  isHourly: boolean
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

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          user_id: string
          first_name: string | null
          last_name: string | null
          department_id: string | null
          team_id: string | null
          position_id: string | null
          email: string | null
          created_at: string
          category_id: string | null
          role_id: string | null
          work_format: WorkFormatType | null
          address: string | null
          employment_rate: number | null
          salary: number | null
          is_hourly: boolean | null
        }
        Insert: {
          user_id: string
          first_name?: string | null
          last_name?: string | null
          department_id?: string | null
          team_id?: string | null
          position_id?: string | null
          email?: string | null
          created_at?: string
          category_id?: string | null
          role_id?: string | null
          work_format?: WorkFormatType | null
          address?: string | null
          employment_rate?: number | null
          salary?: number | null
          is_hourly?: boolean | null
        }
        Update: {
          user_id?: string
          first_name?: string | null
          last_name?: string | null
          department_id?: string | null
          team_id?: string | null
          position_id?: string | null
          email?: string | null
          created_at?: string
          category_id?: string | null
          role_id?: string | null
          work_format?: WorkFormatType | null
          address?: string | null
          employment_rate?: number | null
          salary?: number | null
          is_hourly?: boolean | null
        }
      }
      departments: {
        Row: {
          department_id: string
          ws_department_id: number | null
          department_name: string | null
        }
        Insert: {
          department_id?: string
          ws_department_id?: number | null
          department_name?: string | null
        }
        Update: {
          department_id?: string
          ws_department_id?: number | null
          department_name?: string | null
        }
      }
      teams: {
        Row: {
          team_id: string
          ws_team_id: number | null
          team_name: string | null
          department_id: string | null
        }
        Insert: {
          team_id?: string
          ws_team_id?: number | null
          team_name?: string | null
          department_id?: string | null
        }
        Update: {
          team_id?: string
          ws_team_id?: number | null
          team_name?: string | null
          department_id?: string | null
        }
      }
      positions: {
        Row: {
          position_id: string
          ws_position_id: number | null
          position_name: string | null
        }
        Insert: {
          position_id?: string
          ws_position_id?: number | null
          position_name?: string | null
        }
        Update: {
          position_id?: string
          ws_position_id?: number | null
          position_name?: string | null
        }
      }
      categories: {
        Row: {
          category_id: string
          ws_category_id: number | null
          category_name: string | null
        }
        Insert: {
          category_id?: string
          ws_category_id?: number | null
          category_name?: string | null
        }
        Update: {
          category_id?: string
          ws_category_id?: number | null
          category_name?: string | null
        }
      }
      roles: {
        Row: {
          id: string
          name: string
          description: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          created_at?: string
        }
      }
      permissions: {
        Row: {
          id: string
          name: string
          description: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          created_at?: string
        }
      }
      role_permissions: {
        Row: {
          id: string
          role_id: string
          permission_id: string
          created_at: string
        }
        Insert: {
          id?: string
          role_id: string
          permission_id: string
          created_at?: string
        }
        Update: {
          id?: string
          role_id?: string
          permission_id?: string
          created_at?: string
        }
      }
      user_roles: {
        Row: {
          user_id: string
          role_id: string
        }
        Insert: {
          user_id: string
          role_id: string
        }
        Update: {
          user_id?: string
          role_id?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      work_format_type: WorkFormatType
    }
  }
}
