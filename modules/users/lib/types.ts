export interface User {
  id: string
  email: string
  role: string
  first_name?: string
  last_name?: string
  avatar_url?: string
  phone?: string
  department_id?: string
  team_id?: string
  created_at?: string
  updated_at?: string
}

export interface UsersFilter {
  roles: string[]
  departments: string[]
  teams: string[]
  search: string
}