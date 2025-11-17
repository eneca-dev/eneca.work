import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import { createClient } from "@/utils/supabase/client"


// Интерфейс данных профиля пользователя
export interface UserProfile {
  // camelCase поля (для обратной совместимости)
  firstName?: string | null
  lastName?: string | null
  subdivisionId?: string | null
  departmentId?: string | null
  teamId?: string | null
  positionId?: string | null
  categoryId?: string | null
  workFormat?: string | null
  salary?: number | null
  isHourly?: boolean | null
  employmentRate?: number | null
  country?: string | null
  city?: string | null
  roleId?: string | null
  avatar_url?: string | null

  // snake_case поля (из базы данных)
  first_name?: string | null
  last_name?: string | null
  subdivision_id?: string | null
  department_id?: string | null
  team_id?: string | null
  position_id?: string | null
  category_id?: string | null
  work_format?: string | null
  is_hourly?: boolean | null
  employment_rate?: number | null
  role_id?: string | null
  user_id?: string | null
  email?: string | null
  created_at?: string | null
  city_id?: string | null
}

// Тип данных пользователя для передачи в setUser
export type UserData = {
  id: string
  email: string
  name: string
  profile?: UserProfile | null
}

// Расширенный интерфейс состояния
interface UserState {
  id: string | null
  email: string | null
  name: string | null
  profile: UserProfile | null
  isAuthenticated: boolean
  
  // Действия
  setUser: (user: UserData) => void
  clearUser: () => void
  clearState: () => void
  updateAvatar: (avatarUrl: string) => void
}

export const useUserStore = create<UserState>()(
  devtools(
    persist(
      (set, get) => ({
        // Начальное состояние
        id: null,
        email: null,
        name: null,
        profile: null,
        isAuthenticated: false,
        
        // Действия
        setUser: (user: UserData) => {
          if (!user?.id || !user?.email) {
            throw new Error('Invalid user data: id and email are required');
          }
          
          const currentState = get();
          const shouldPreserveRoleData = currentState.id === user.id;
          
          // Explicitly create new object for profile to avoid reference issues
          let processedProfile = null;
          let profileName = '';
          
          if (user.profile) {
            // Create deep copy of profile for safety
            processedProfile = {
              firstName: user.profile.firstName || user.profile.first_name,
              lastName: user.profile.lastName || user.profile.last_name,
              subdivisionId: user.profile.subdivisionId || user.profile.subdivision_id,
              departmentId: user.profile.departmentId || user.profile.department_id,
              teamId: user.profile.teamId || user.profile.team_id,
              positionId: user.profile.positionId || user.profile.position_id,
              categoryId: user.profile.categoryId || user.profile.category_id,
              workFormat: user.profile.workFormat || user.profile.work_format,
              salary: user.profile.salary,
              isHourly: user.profile.isHourly ?? user.profile.is_hourly,
              employmentRate: user.profile.employmentRate ?? user.profile.employment_rate,
              country: user.profile.country,
              city: user.profile.city,
              // legacy role removed, роль теперь только через user_roles
              avatar_url: user.profile.avatar_url
            };
            // Формируем имя из profile только если не передано готовое имя
            const firstName = user.profile.firstName || user.profile.first_name;
            const lastName = user.profile.lastName || user.profile.last_name;
            profileName = [firstName, lastName].filter(Boolean).join(' ');
          }
          
          // Приоритетно используем переданное имя, fallback на profileName
          const finalName = user.name || profileName || '';
          
          console.log("💾 useUserStore.setUser: Сохранение данных:", {
            passedName: user.name,
            profileName,
            finalName,
            hasProfile: !!user.profile
          });
          
          set({
            id: user.id,
            email: user.email,
            name: finalName,
            profile: processedProfile,
            isAuthenticated: true
          });
        
        },
        
        clearUser: () => set({
          id: null,
          email: null,
          name: null,
          profile: null,
          isAuthenticated: false
        }),
        
        // Alias for clearUser for backward compatibility
        clearState: () => get().clearUser(),

        
        // Method for updating avatar
        updateAvatar: (avatarUrl: string) => {
          const currentState = get();
          
          // If user doesn't have profile yet, create one
          if (!currentState.profile) {
            set({ 
              profile: { 
                avatar_url: avatarUrl 
              } 
            });
            return;
          }
          
          // Otherwise update existing profile
          set({
            profile: {
              ...currentState.profile,
              avatar_url: avatarUrl
            }
          });
        },
        
        // УДАЛЕНО: Все методы работы с разрешениями перенесены в permissions модуль
      }),
      {
        name: 'user-storage',
        partialize: (state) => {
          return {
            id: state.id,
            email: state.email,
            name: state.name,
            profile: state.profile,
            isAuthenticated: state.isAuthenticated
          };
        },
      }
    )
  )
)