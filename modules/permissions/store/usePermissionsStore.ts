import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { DataConstraint, UserPermissions } from '../types'
import { checkPermission, checkAnyPermission, checkAllPermissions, getPermissionLevel } from '../utils/permissionUtils'

interface PermissionsState {
  // Состояние
  permissions: string[]
  constraints: DataConstraint[]
  roles: string[]
  isLoading: boolean
  error: string | null
  lastUpdated: Date | null
  
  // Методы
  setPermissions: (permissions: string[]) => void
  setConstraints: (constraints: DataConstraint[]) => void
  setRoles: (roles: string[]) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  clearError: () => void
  reset: () => void
  
  // Проверки разрешений
  hasPermission: (permission: string) => boolean
  hasAnyPermission: (permissions: string[]) => boolean
  hasAllPermissions: (permissions: string[]) => boolean
  getPermissionLevel: (module: string) => 'none' | 'view' | 'edit' | 'admin'
  
  // Загрузка данных
  loadPermissions: (userId: string) => Promise<void>
  refreshPermissions: () => Promise<void>
}

const initialState = {
  permissions: [],
  constraints: [],
  roles: [],
  isLoading: false,
  error: null,
  lastUpdated: null
}

export const usePermissionsStore = create<PermissionsState>()(
  devtools(
    (set, get) => ({
      ...initialState,
      
      // Базовые сеттеры
      setPermissions: (permissions: string[]) => {
        set({ 
          permissions, 
          lastUpdated: new Date(),
          error: null 
        })
      },
      
      setConstraints: (constraints: DataConstraint[]) => {
        set({ 
          constraints, 
          lastUpdated: new Date() 
        })
      },
      
      setRoles: (roles: string[]) => {
        set({ 
          roles, 
          lastUpdated: new Date() 
        })
      },
      
      setLoading: (loading: boolean) => {
        set({ isLoading: loading })
      },
      
      setError: (error: string | null) => {
        set({ error, isLoading: false })
      },
      
      clearError: () => {
        set({ error: null })
      },
      
      reset: () => {
        set(initialState)
      },
      
      // Проверки разрешений
      hasPermission: (permission: string) => {
        const { permissions } = get()
        return checkPermission(permissions, permission)
      },
      
      hasAnyPermission: (permissions: string[]) => {
        const { permissions: userPermissions } = get()
        return checkAnyPermission(userPermissions, permissions)
      },
      
      hasAllPermissions: (permissions: string[]) => {
        const { permissions: userPermissions } = get()
        return checkAllPermissions(userPermissions, permissions)
      },
      
      getPermissionLevel: (module: string) => {
        const { permissions } = get()
        return getPermissionLevel(permissions, module)
      },
      
      // Загрузка разрешений
      loadPermissions: async (userId: string) => {
        set({ isLoading: true, error: null })
        
        try {
          // TODO: Реализовать через Supabase
          // const { permissions, constraints, roles } = await fetchUserPermissions(userId)
          
          // Пока используем заглушку
          const permissions: string[] = []
          const constraints: DataConstraint[] = []
          const roles: string[] = []
          
          set({
            permissions,
            constraints,
            roles,
            isLoading: false,
            lastUpdated: new Date(),
            error: null
          })
        } catch (error) {
          console.error('Ошибка загрузки разрешений:', error)
          set({
            error: error instanceof Error ? error.message : 'Ошибка загрузки разрешений',
            isLoading: false
          })
        }
      },
      
      refreshPermissions: async () => {
        const userId = get().roles[0] // Временная заглушка
        if (userId) {
          await get().loadPermissions(userId)
        }
      }
    }),
    {
      name: 'permissions-store'
    }
  )
)

// Селекторы для оптимизации ре-рендеров
export const usePermissions = () => usePermissionsStore(state => state.permissions)
export const useConstraints = () => usePermissionsStore(state => state.constraints)
export const useRoles = () => usePermissionsStore(state => state.roles)
export const usePermissionsLoading = () => usePermissionsStore(state => state.isLoading)
export const usePermissionsError = () => usePermissionsStore(state => state.error)

// Хелперы для проверки разрешений
export const useHasPermission = (permission: string) => 
  usePermissionsStore(state => state.hasPermission(permission))

export const useHasAnyPermission = (permissions: string[]) => 
  usePermissionsStore(state => state.hasAnyPermission(permissions))

export const usePermissionLevel = (module: string) => 
  usePermissionsStore(state => state.getPermissionLevel(module)) 