import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { checkPermission, checkAnyPermission, checkAllPermissions, getPermissionLevel } from '../utils/permissionUtils'
import type { FilterScope, OrgContext } from '../types'

interface PermissionsState {
  // Состояние
  permissions: string[]
  isLoading: boolean
  error: string | null
  lastUpdated: Date | null

  // Filter scope & org context (unified permissions)
  filterScope: FilterScope | null
  orgContext: OrgContext | null

  // Методы
  setPermissions: (permissions: string[]) => void
  setFilterScope: (scope: FilterScope | null) => void
  setOrgContext: (context: OrgContext | null) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  clearError: () => void
  reset: () => void
  clearPermissions: () => void  // Alias для reset, используется AuthProvider

  // Проверки разрешений
  hasPermission: (permission: string) => boolean
  hasAnyPermission: (permissions: string[]) => boolean
  hasAllPermissions: (permissions: string[]) => boolean
  getPermissionLevel: (module: string) => 'none' | 'view' | 'edit' | 'admin'
}

const initialState = {
  permissions: [] as string[],
  isLoading: false,
  error: null as string | null,
  lastUpdated: null as Date | null,
  filterScope: null as FilterScope | null,
  orgContext: null as OrgContext | null,
}

export const usePermissionsStore = create<PermissionsState>()(
  devtools(
    (set, get) => ({
      ...initialState,
      
      // Базовые сеттеры
      setPermissions: (permissions: string[]) => {
        // Нормализуем hierarchy.*: оставляем только наивысший уровень
        const setHier = new Set(permissions)
        const hasAdmin = setHier.has('hierarchy.is_admin')
        const hasSubdivisionHead = setHier.has('hierarchy.is_subdivision_head')
        const hasDeptHead = setHier.has('hierarchy.is_department_head')
        const hasTeamLead = setHier.has('hierarchy.is_team_lead')
        const hasUser = setHier.has('hierarchy.is_user')

        let normalized = permissions
        if (hasAdmin) {
          // Admin - удаляем все остальные иерархические роли
          normalized = permissions.filter(p =>
            p !== 'hierarchy.is_subdivision_head' &&
            p !== 'hierarchy.is_department_head' &&
            p !== 'hierarchy.is_team_lead' &&
            p !== 'hierarchy.is_user'
          )
        } else if (hasSubdivisionHead) {
          // Subdivision Head - удаляем department_head, team_lead, user
          normalized = permissions.filter(p =>
            p !== 'hierarchy.is_department_head' &&
            p !== 'hierarchy.is_team_lead' &&
            p !== 'hierarchy.is_user'
          )
        } else if (hasDeptHead) {
          // Department Head - удаляем team_lead, user
          normalized = permissions.filter(p =>
            p !== 'hierarchy.is_team_lead' &&
            p !== 'hierarchy.is_user'
          )
        } else if (hasTeamLead) {
          // Team Lead - удаляем user
          normalized = permissions.filter(p =>
            p !== 'hierarchy.is_user'
          )
        }

        set({
          permissions: normalized,
          lastUpdated: new Date(),
          error: null
        })
      },

      // Filter scope & org context setters
      setFilterScope: (scope: FilterScope | null) => {
        set({ filterScope: scope })
      },

      setOrgContext: (context: OrgContext | null) => {
        set({ orgContext: context })
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

      // Alias для reset — используется AuthProvider при logout
      clearPermissions: () => {
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

// === Unified Permissions Selectors ===

/** Селектор для filter scope */
export const selectFilterScope = (state: PermissionsState) => state.filterScope

/** Селектор для org context */
export const selectOrgContext = (state: PermissionsState) => state.orgContext

/** Проверка на admin */
export const selectIsAdmin = (state: PermissionsState) =>
  state.permissions.includes('hierarchy.is_admin')

/** Хук для получения filter scope */
export const useFilterScope = () => usePermissionsStore(selectFilterScope)

/** Хук для получения org context */
export const useOrgContext = () => usePermissionsStore(selectOrgContext)

/** Хук для проверки admin */
export const useIsAdmin = () => usePermissionsStore(selectIsAdmin)