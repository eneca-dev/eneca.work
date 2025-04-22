import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'

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
}

// Тип данных пользователя для передачи в setUser
export type UserData = {
  id: string
  email: string
  name: string
  profile?: UserProfile | null
}

// Основной интерфейс состояния
interface UserState {
  id: string | null
  email: string | null
  name: string | null
  profile: UserProfile | null
  isAuthenticated: boolean
  role: string | null
  permissions: string[]
  
  // Действия
  setUser: (user: UserData) => void
  clearUser: () => void
  setRoleAndPermissions: (role: string | null, permissions: string[]) => void
}

export const useUserStore = create<UserState>()(
  devtools(
    persist(
      (set) => ({
        // Начальное состояние
        id: null,
        email: null,
        name: null,
        profile: null,
        isAuthenticated: false,
        role: null,
        permissions: [],
        
        // Действия
        setUser: (user: UserData) => {
          console.log('setUser вызван с данными:', user);
          console.log('Профиль пользователя в данных:', user.profile);
          
          // Явно создаем новый объект для профиля, чтобы избежать ссылочных проблем
          let processedProfile = null;
          let profileName = '';
          
          if (user.profile) {
            // Создаем глубокую копию профиля для безопасности
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
              roleId: user.profile.roleId
            };
            profileName = [user.profile.firstName, user.profile.lastName].filter(Boolean).join(' ');
            console.log('Обработанный профиль перед сохранением:', processedProfile);
          }
          
          set({
            id: user.id,
            email: user.email,
            name: profileName || '',
            profile: processedProfile,
            isAuthenticated: true,
            role: null,
            permissions: []
          });
          
          console.log('Новое состояние:', useUserStore.getState());
          console.log('Профиль в новом состоянии:', useUserStore.getState().profile);
        },
        
        clearUser: () => set({
          id: null,
          email: null,
          name: null,
          profile: null,
          isAuthenticated: false,
          role: null,
          permissions: []
        }),
        
        setRoleAndPermissions: (role, permissions) => set({
          role,
          permissions
        })
      }),
      {
        name: 'user-storage',
        partialize: (state) => {
          console.log('Partialize state:', state);
          const partializedState = {
            id: state.id,
            email: state.email,
            name: state.name,
            profile: state.profile,
            isAuthenticated: state.isAuthenticated,
            role: state.role,
            permissions: state.permissions
          };
          console.log('Serialized state:', partializedState);
          return partializedState;
        },
      }
    )
  )
) 