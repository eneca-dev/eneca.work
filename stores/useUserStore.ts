import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import { createClient } from "@/utils/supabase/client"
import { getUserRoleAndPermissions, getUserRoleAndPermissionsByRoleId } from "@/services/org-data-service"

export type UserRole = "admin" | "user"

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
  role: string | null
  permissions: string[]
  isLoadingPermissions: boolean
  
  // Действия
  setUser: (user: UserData) => void
  clearUser: () => void
  setRoleAndPermissions: (role: string | null, permissions: string[]) => void
  updateAvatar: (avatarUrl: string) => void
  hasPermission: (permission: string) => boolean
  loadUserPermissions: (userId: string) => Promise<void>
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
        role: null,
        permissions: [],
        isLoadingPermissions: false,
        
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
              roleId: user.profile.roleId,
              avatar_url: user.profile.avatar_url
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
          
          // Автоматически загружаем разрешения после установки пользователя
          const state = get();
          console.log(
            state.profile?.roleId 
              ? `Автоматически загружаем разрешения из profile.roleId: ${state.profile.roleId}`
              : 'profile.roleId отсутствует, загружаем разрешения через user_roles'
          );
          state.loadUserPermissions(user.id);
        },
        
        clearUser: () => set({
          id: null,
          email: null,
          name: null,
          profile: null,
          isAuthenticated: false,
          role: null,
          permissions: [],
          isLoadingPermissions: false,
        }),
        
        setRoleAndPermissions: (role, permissions) => set({
          role,
          permissions
        }),
        
        // Метод для обновления аватара
        updateAvatar: (avatarUrl: string) => {
          const currentState = get();
          
          // Если у пользователя еще нет профиля, создаем его
          if (!currentState.profile) {
            set({ 
              profile: { 
                avatar_url: avatarUrl 
              } 
            });
            return;
          }
          
          // Иначе обновляем существующий профиль
          set({
            profile: {
              ...currentState.profile,
              avatar_url: avatarUrl
            }
          });
          
          console.log('Аватар обновлен:', avatarUrl);
          console.log('Новый профиль:', useUserStore.getState().profile);
        },

        hasPermission: (permission: string) => {
          const state = get()
          return state.permissions.includes(permission)
        },

        loadUserPermissions: async (userId: string) => {
          const currentState = get();
          
          // Проверяем, не идет ли уже загрузка разрешений
          if (currentState.isLoadingPermissions) {
            console.log('Загрузка разрешений уже выполняется, пропускаем запрос');
            return;
          }

          // Устанавливаем флаг загрузки
          set({ isLoadingPermissions: true });

          try {
            console.log('loadUserPermissions вызван для userId:', userId);
            console.log('Текущий профиль пользователя:', currentState.profile);
            
            let rolePermissions;
            
            // Если у пользователя есть roleId в профиле, используем его напрямую
            if (currentState.profile?.roleId) {
              console.log('Используем roleId из профиля:', currentState.profile.roleId);
              rolePermissions = await getUserRoleAndPermissionsByRoleId(currentState.profile.roleId);
            } else {
              console.log('Используем стандартный способ через user_roles');
              rolePermissions = await getUserRoleAndPermissions(userId);
            }
            
            console.log('Полученные разрешения:', rolePermissions);
            
            set({
              role: rolePermissions.role,
              permissions: rolePermissions.permissions,
              isLoadingPermissions: false
            });
            
            console.log('Разрешения успешно загружены и установлены:', {
              role: rolePermissions.role,
              permissions: rolePermissions.permissions
            });
          } catch (error) {
            console.error('Ошибка при загрузке разрешений пользователя:', error);
            
            // Сбрасываем флаг загрузки при ошибке
            set({ isLoadingPermissions: false });
            
            // Перебрасываем ошибку для propagation к вызывающему коду
            throw error;
          }
        },
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