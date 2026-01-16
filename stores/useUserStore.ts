import { create } from 'zustand'
import { devtools, persist, createJSONStorage } from 'zustand/middleware'

/**
 * Профиль пользователя из таблицы profiles
 * Используем snake_case как в БД
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
 * Данные для установки пользователя
 */
export type UserData = {
  id: string
  email: string
  name: string
  profile?: UserProfile | null
}

/**
 * Состояние пользователя
 */
interface UserState {
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

const initialState = {
  id: null,
  email: null,
  name: null,
  profile: null,
  isAuthenticated: false,
}

export const useUserStore = create<UserState>()(
  devtools(
    persist(
      (set, get) => ({
        ...initialState,

        setUser: (user: UserData) => {
          if (!user?.id || !user?.email) {
            console.error('useUserStore.setUser: Invalid user data - id and email required')
            return
          }

          console.log("💾 useUserStore.setUser:", {
            id: user.id,
            name: user.name,
            hasProfile: !!user.profile
          })

          set({
            id: user.id,
            email: user.email,
            name: user.name,
            profile: user.profile ?? null,
            isAuthenticated: true
          })
        },

        clearUser: () => {
          console.log("🧹 useUserStore.clearUser")
          set(initialState)
        },

        updateProfile: (profileUpdate: Partial<UserProfile>) => {
          const currentProfile = get().profile
          set({
            profile: currentProfile
              ? { ...currentProfile, ...profileUpdate }
              : profileUpdate as UserProfile
          })
        },

        updateAvatar: (avatarUrl: string) => {
          const currentProfile = get().profile
          set({
            profile: currentProfile
              ? { ...currentProfile, avatar_url: avatarUrl }
              : { avatar_url: avatarUrl }
          })
        },
      }),
      {
        name: 'user-storage',
        storage: createJSONStorage(() => localStorage),
        version: 2, // Увеличиваем версию для миграции
        partialize: (state) => ({
          id: state.id,
          email: state.email,
          name: state.name,
          profile: state.profile,
          isAuthenticated: state.isAuthenticated
        }),
        // Миграция с предыдущей версии
        migrate: (persistedState: any, version) => {
          if (version === 1) {
            // Очищаем старые camelCase поля из profile если есть
            const profile = persistedState.profile
            if (profile) {
              // Оставляем только snake_case поля
              const cleanProfile: UserProfile = {
                first_name: profile.first_name || profile.firstName,
                last_name: profile.last_name || profile.lastName,
                subdivision_id: profile.subdivision_id || profile.subdivisionId,
                department_id: profile.department_id || profile.departmentId,
                team_id: profile.team_id || profile.teamId,
                position_id: profile.position_id || profile.positionId,
                category_id: profile.category_id || profile.categoryId,
                work_format: profile.work_format || profile.workFormat,
                salary: profile.salary,
                is_hourly: profile.is_hourly ?? profile.isHourly,
                employment_rate: profile.employment_rate ?? profile.employmentRate,
                avatar_url: profile.avatar_url,
                user_id: profile.user_id,
                email: profile.email,
                created_at: profile.created_at,
                city_id: profile.city_id,
              }
              persistedState.profile = cleanProfile
            }
          }
          return persistedState as UserState
        }
      }
    ),
    { name: 'UserStore' }
  )
)
