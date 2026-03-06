export interface User {
  id: string
  email: string
  // role: string - удалено, используем новую систему ролей
  role?: string
  roles_display_string?: string
  first_name?: string
  last_name?: string
  avatar_url?: string
  phone?: string
  department_id?: string
  team_id?: string
  created_at?: string
  updated_at?: string
}

/** Презентационный тип пользователя (маппинг из view_users для UI-компонентов) */
export interface UserPresentation {
  id: string
  name: string
  email: string
  avatar_url?: string
  position: string
  subdivision: string
  subdivisionId?: string
  department: string
  departmentId?: string
  team: string
  teamId?: string
  category: string
  role?: string
  dateJoined?: string
  workLocation?: "office" | "remote" | "hybrid"
  country?: string
  city?: string
  employmentRate?: number
  salary?: number
  isHourly?: boolean
}

export interface UsersFilter {
  roles: string[]
  departments: string[]
  teams: string[]
  search: string
}