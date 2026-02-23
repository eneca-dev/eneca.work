import { create } from 'zustand'
import { devtools, persist, createJSONStorage } from 'zustand/middleware'
import { checkPermission, checkAnyPermission, checkAllPermissions, getPermissionLevel } from '../utils/permissionUtils'
import type { FilterScope, OrgContext } from '../types'

interface PermissionsState {
  // Состояние
  permissions: string[]
  isLoading: boolean
  error: string | null
  lastUpdated: number | null // timestamp вместо Date для сериализации

  // Filter scope & org context (unified permissions)
  filterScope: FilterScope | null
  orgContext: OrgContext | null

  // ID пользователя, которому принадлежат permissions (для валидации кеша)
  userId: string | null

  // Методы
  setPermissions: (permissions: string[]) => void
  setFilterScope: (scope: FilterScope | null) => void
  setOrgContext: (context: OrgContext | null) => void
  setUserId: (userId: string | null) => void
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
  lastUpdated: null as number | null,
  filterScope: null as FilterScope | null,
  orgContext: null as OrgContext | null,
  userId: null as string | null,
}

export const usePermissionsStore = create<PermissionsState>()(
  devtools(
    persist(
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

          let normalized = permissions
          if (hasAdmin) {
            normalized = permissions.filter(p =>
              p !== 'hierarchy.is_subdivision_head' &&
              p !== 'hierarchy.is_department_head' &&
              p !== 'hierarchy.is_team_lead' &&
              p !== 'hierarchy.is_user'
            )
          } else if (hasSubdivisionHead) {
            normalized = permissions.filter(p =>
              p !== 'hierarchy.is_department_head' &&
              p !== 'hierarchy.is_team_lead' &&
              p !== 'hierarchy.is_user'
            )
          } else if (hasDeptHead) {
            normalized = permissions.filter(p =>
              p !== 'hierarchy.is_team_lead' &&
              p !== 'hierarchy.is_user'
            )
          } else if (hasTeamLead) {
            normalized = permissions.filter(p =>
              p !== 'hierarchy.is_user'
            )
          }

          set({
            permissions: normalized,
            lastUpdated: Date.now(),
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

        setUserId: (userId: string | null) => {
          set({ userId })
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
        name: 'permissions-storage',
        storage: createJSONStorage(() => localStorage),
        version: 1,
        // Кешируем только данные, НЕ transient state (isLoading, error)
        partialize: (state) => ({
          permissions: state.permissions,
          filterScope: state.filterScope,
          orgContext: state.orgContext,
          userId: state.userId,
          lastUpdated: state.lastUpdated,
        }),
      }
    ),
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
