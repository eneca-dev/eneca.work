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
  userId: string | null // Для предотвращения race conditions
  
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
  lastUpdated: null,
  userId: null
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
        const currentState = get()
        
        // Предотвращаем множественные запросы для одного пользователя
        if (currentState.isLoading && currentState.userId === userId) {
          console.log('⏸️ Разрешения уже загружаются для пользователя:', userId)
          return
        }
        
        set({ isLoading: true, error: null, userId })
        
        try {
          // Загружаем разрешения из Supabase
          const { getUserPermissions, getDataConstraints } = await import('../supabase/supabasePermissions')
          
          console.log('🔄 Загружаем разрешения для пользователя:', userId)
          
          const [permissions, constraints] = await Promise.all([
            getUserPermissions(userId),
            getDataConstraints(userId)
          ])
          
          // Проверяем что пользователь не изменился во время загрузки
          const finalState = get()
          if (finalState.userId !== userId) {
            console.log('🔄 Пользователь изменился во время загрузки, игнорируем результат')
            return
          }
          
          console.log('✅ Разрешения загружены:', { permissions, constraints })
          
          set({
            permissions,
            constraints,
            roles: [], // TODO: Добавить загрузку ролей пользователя если нужно
            isLoading: false,
            lastUpdated: new Date(),
            error: null
          })
        } catch (error) {
          console.error('❌ Ошибка загрузки разрешений:', error)
          set({
            error: error instanceof Error ? error.message : 'Ошибка загрузки разрешений',
            isLoading: false
          })
        }
      },
      
      refreshPermissions: async (userId?: string) => {
        // Получаем userId из аргумента или из текущего состояния (потребуется интеграция с useUserStore)
        if (!userId) {
          console.warn('⚠️ userId не предоставлен для refreshPermissions')
          return
        }
        
        console.log('🔄 Обновляем разрешения для пользователя:', userId)
        await get().loadPermissions(userId)
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