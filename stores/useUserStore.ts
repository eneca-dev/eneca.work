import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import { createClient } from "@/utils/supabase/client"


// Интерфейс данных профиля пользователя
export interface UserProfile {
  firstName?: string | null
  lastName?: string | null
  departmentId?: string | null
  teamId?: string | null
  positionId?: string | null
  categoryId?: string | null
  workFormat?: string | null
  salary?: number | null
  isHourly?: boolean | null
  employmentRate?: number | null
  address?: string | null
  roleId?: string | null
  avatar_url?: string | null
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
              firstName: user.profile.firstName,
              lastName: user.profile.lastName,
              departmentId: user.profile.departmentId,
              teamId: user.profile.teamId,
              positionId: user.profile.positionId,
              categoryId: user.profile.categoryId,
              workFormat: user.profile.workFormat,
              salary: user.profile.salary,
              isHourly: user.profile.isHourly,
              employmentRate: user.profile.employmentRate,
              address: user.profile.address,
              roleId: user.profile.roleId,
              avatar_url: user.profile.avatar_url
            };
            profileName = [user.profile.firstName, user.profile.lastName].filter(Boolean).join(' ');
          }
          
          set({
            id: user.id,
            email: user.email,
            name: profileName || '',
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