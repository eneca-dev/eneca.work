// Define types based on the database schema
export type ExecutorCategory = "ГС1" | "К1" | "ВС1" | "ТЛ" | "НО"
export type ChartType = "Plan" | "Fact"

export interface Loading {
  id: string
  task_id: string
  user_id: string
  rate: number
  date_start: Date
  date_end: Date
  type?: ChartType
  created_at?: Date
  updated_at?: Date
  executorId?: string
}

export interface Task {
  id: string
  ws_task_id: number
  ws_subtask_id: number
  name: string
  page?: string
  user_to?: {
    id: string
    name: string
    email: string
  }
  date_start?: Date | null
  date_end?: Date | null
  tags?: Record<string, string> | null
  comments?: Array<{
    id: string
    page: string
    text: string
    user_from: {
      id: string
      name: string
      email: string
    }
    date_added: string
  }> | null
  loadings: Loading[]
}

// Department type from the public schema
export type Department = string

// Section responsible interface based on the profiles table
export interface SectionResponsible {
  id: string
  name: string
  position: string
  avatarUrl?: string
}

export interface Section {
  id: string
  ws_project_id: number
  ws_task_id: number
  name: string
  page?: string
  user_to?: {
    id: string
    name: string
    email: string
  }
  date_start?: Date | null
  date_end?: Date | null
  tags?: Record<string, string> | null
  comments?: any[] | null
  tasks: Task[]
  responsible?: SectionResponsible
  department?: Department
  projectName?: string
  stages: Stage[]
}

export interface Project {
  id: string
  ws_project_id: number
  name: string
  status: string
  user_to?: {
    id: string
    name: string
    email: string
  }
  date_start?: Date | null
  date_end?: Date | null
  tags?: Record<string, string> | null
  sections: Section[]
}

// Profile type based on the public schema
export interface Profile {
  user_id: string
  first_name: string
  last_name: string
  department_id: string
  team_id: string
  position_id: string
  category_id: string
  role_id: string
  email: string
  created_at: string
  avatar_url?: string
}

// Team type based on the public schema
export interface Team {
  team_id: string
  ws_team_id: number
  team_name: string
  department_id: string
}

// Position type based on the public schema
export interface Position {
  position_id: string
  ws_position_id: number
  position_name: string
}

// Category type based on the public schema
export interface Category {
  category_id: string
  ws_category_id: number
  category_name: string
}

// Department type based on the public schema
export interface DepartmentInfo {
  department_id: string
  ws_department_id: number
  department_name: string
}

// Role type based on the public schema
export interface Role {
  id: string
  name: string
  description: string
  created_at: string
}

export interface Stage {
  id: string
  name: string
  loadings: Loading[]
}

