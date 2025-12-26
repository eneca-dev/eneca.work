/**
 * Debug Store
 *
 * Управляет debug режимом и эмуляцией ролей для тестирования.
 * Позволяет переключать роли пользователя без перелогина.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { SystemRole } from '@/modules/filter-permissions'

export interface DebugRoleOverride {
  /** Эмулируемая роль */
  role: SystemRole
  /** ID команды (для team_lead) */
  teamId?: string
  /** ID отдела (для department_head) */
  departmentId?: string
  /** ID подразделения (для subdivision_head) */
  subdivisionId?: string
  /** ID проектов (для project_manager) */
  projectIds?: string[]
}

interface DebugState {
  /** Debug панель открыта */
  isPanelOpen: boolean
  /** Логирование включено */
  isLoggingEnabled: boolean
  /** Override роли (null = использовать реальную роль) */
  roleOverride: DebugRoleOverride | null
  /** История действий */
  actionHistory: Array<{
    timestamp: string
    action: string
    details?: unknown
  }>
}

interface DebugActions {
  /** Открыть/закрыть панель */
  togglePanel: () => void
  setIsPanelOpen: (open: boolean) => void
  /** Включить/выключить логирование */
  toggleLogging: () => void
  setLoggingEnabled: (enabled: boolean) => void
  /** Установить override роли */
  setRoleOverride: (override: DebugRoleOverride | null) => void
  /** Очистить override */
  clearRoleOverride: () => void
  /** Добавить в историю действий */
  addToHistory: (action: string, details?: unknown) => void
  /** Очистить историю */
  clearHistory: () => void
  /** Сброс всех настроек */
  reset: () => void
}

const initialState: DebugState = {
  isPanelOpen: false,
  isLoggingEnabled: true,
  roleOverride: null,
  actionHistory: [],
}

export const useDebugStore = create<DebugState & DebugActions>()(
  persist(
    (set, get) => ({
      ...initialState,

      togglePanel: () => set((state) => ({ isPanelOpen: !state.isPanelOpen })),
      setIsPanelOpen: (open) => set({ isPanelOpen: open }),

      toggleLogging: () =>
        set((state) => ({ isLoggingEnabled: !state.isLoggingEnabled })),
      setLoggingEnabled: (enabled) => set({ isLoggingEnabled: enabled }),

      setRoleOverride: (override) => {
        set({ roleOverride: override })
        get().addToHistory('Role Override Set', override)
      },

      clearRoleOverride: () => {
        set({ roleOverride: null })
        get().addToHistory('Role Override Cleared')
      },

      addToHistory: (action, details) =>
        set((state) => ({
          actionHistory: [
            { timestamp: new Date().toISOString(), action, details },
            ...state.actionHistory.slice(0, 49), // Keep last 50
          ],
        })),

      clearHistory: () => set({ actionHistory: [] }),

      reset: () => set(initialState),
    }),
    {
      name: 'debug-store',
      partialize: (state) => ({
        isLoggingEnabled: state.isLoggingEnabled,
        roleOverride: state.roleOverride,
      }),
    }
  )
)

/**
 * Проверяет, включён ли debug режим
 */
export function isDebugMode(): boolean {
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_DEBUG_MODE === 'true'
  }
  return (
    process.env.NEXT_PUBLIC_DEBUG_MODE === 'true' ||
    localStorage.getItem('debug_mode') === 'true'
  )
}

/**
 * Получить текущий override роли (если есть)
 */
export function getRoleOverride(): DebugRoleOverride | null {
  if (!isDebugMode()) return null
  return useDebugStore.getState().roleOverride
}
