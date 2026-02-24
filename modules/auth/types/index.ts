import type { Session, User, AuthChangeEvent } from "@supabase/supabase-js"

/**
 * Профиль пользователя из таблицы profiles
 */
export interface UserProfile {
  first_name?: string | null
  last_name?: string | null
  subdivision_id?: string | null
  department_id?: string | null
  team_id?: string | null
  position_id?: string | null
  category_id?: string | null
  work_format?: string | null
  salary?: number | null
  is_hourly?: boolean | null
  employment_rate?: number | null
  avatar_url?: string | null
  user_id?: string | null
  email?: string | null
  created_at?: string | null
  city_id?: string | null
}

/**
 * Данные для установки пользователя в store
 */
export interface UserData {
  id: string
  email: string
  name: string
  profile?: UserProfile | null
}

/**
 * Состояние пользователя в store
 */
export interface UserState {
  id: string | null
  email: string | null
  name: string | null
  profile: UserProfile | null
  isAuthenticated: boolean

  // Действия
  setUser: (user: UserData) => void
  clearUser: () => void
  updateProfile: (profile: Partial<UserProfile>) => void
  updateAvatar: (avatarUrl: string) => void
}

/**
 * Контекст авторизации
 */
export interface AuthContextValue {
  user: User | null
  session: Session | null
  isLoading: boolean
  isAuthenticated: boolean
  signOut: () => Promise<void>
}

/**
 * События авторизации Supabase
 */
export type AuthEvent = AuthChangeEvent

/**
 * Результат операции авторизации
 */
export interface AuthResult {
  success: boolean
  error?: string
}

// Реэкспорт типов Supabase для удобства
export type { Session, User, AuthChangeEvent } from "@supabase/supabase-js"
