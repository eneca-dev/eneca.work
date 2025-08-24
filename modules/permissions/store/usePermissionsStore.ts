import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { checkPermission, checkAnyPermission, checkAllPermissions, getPermissionLevel } from '../utils/permissionUtils'

interface PermissionsState {
  // Состояние
  permissions: string[]
  isLoading: boolean
  error: string | null
  lastUpdated: Date | null
  
  // Методы
  setPermissions: (permissions: string[]) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  clearError: () => void
  reset: () => void
  
  // Проверки разрешений
  hasPermission: (permission: string) => boolean
  hasAnyPermission: (permissions: string[]) => boolean
  hasAllPermissions: (permissions: string[]) => boolean
  getPermissionLevel: (module: string) => 'none' | 'view' | 'edit' | 'admin'
}

const initialState = {
  permissions: [],
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

      // УДАЛЕНО: setFromRole больше не нужен - разрешения загружаются из БД
      
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
      }
    }),
    {
      name: 'permissions-store'
    }
  )
)

// Селекторы для оптимизации ре-рендеров
export const usePermissions = () => usePermissionsStore(state => state.permissions)
export const usePermissionsLoading = () => usePermissionsStore(state => state.isLoading)
export const usePermissionsError = () => usePermissionsStore(state => state.error)

// Хелперы для проверки разрешений
export const useHasPermission = (permission: string) => 
  usePermissionsStore(state => state.hasPermission(permission))

export const useHasAnyPermission = (permissions: string[]) => 
  usePermissionsStore(state => state.hasAnyPermission(permissions))

export const usePermissionLevel = (module: string) => 
  usePermissionsStore(state => state.getPermissionLevel(module))