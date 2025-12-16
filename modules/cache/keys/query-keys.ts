/**
 * Query Keys Factory
 *
 * Централизованное управление ключами кеша для TanStack Query.
 * Обеспечивает типобезопасность и предсказуемую инвалидацию.
 *
 * Структура ключей:
 * - all: базовый ключ для всей сущности
 * - lists: все списки сущности
 * - list(filters): конкретный список с фильтрами
 * - details: все детальные запросы
 * - detail(id): конкретная запись
 */

import type { BaseFilters } from '../types'

// ============================================================================
// Фильтры для разных сущностей
// ============================================================================

export interface UserFilters extends BaseFilters {
  departmentId?: string
  teamId?: string
  positionId?: string
  isActive?: boolean
}

export interface ProjectFilters extends BaseFilters {
  status?: string
  managerId?: string
  clientId?: string
}

export interface SectionFilters extends BaseFilters {
  projectId?: string
  objectId?: string
  responsibleId?: string
  statusId?: string
}

export interface LoadingFilters extends BaseFilters {
  responsibleId?: string
  sectionId?: string
  projectId?: string
  dateFrom?: string
  dateTo?: string
  status?: 'active' | 'archived'
}

export interface BudgetFilters extends BaseFilters {
  entityType?: 'section' | 'object' | 'stage' | 'project'
  entityId?: string
  isActive?: boolean
  tagIds?: string[]
}

// ============================================================================
// Query Keys Factory
// ============================================================================

export const queryKeys = {
  // -------------------------------------------------------------------------
  // Users / Profiles
  // -------------------------------------------------------------------------
  users: {
    all: ['users'] as const,
    lists: () => [...queryKeys.users.all, 'list'] as const,
    list: (filters?: UserFilters) => [...queryKeys.users.lists(), filters] as const,
    details: () => [...queryKeys.users.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.users.details(), id] as const,
    current: () => [...queryKeys.users.all, 'current'] as const,
    permissions: (id: string) => [...queryKeys.users.detail(id), 'permissions'] as const,
  },

  // -------------------------------------------------------------------------
  // Projects
  // -------------------------------------------------------------------------
  projects: {
    all: ['projects'] as const,
    lists: () => [...queryKeys.projects.all, 'list'] as const,
    list: (filters?: ProjectFilters) => [...queryKeys.projects.lists(), filters] as const,
    details: () => [...queryKeys.projects.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.projects.details(), id] as const,
    statistics: (id: string) => [...queryKeys.projects.detail(id), 'statistics'] as const,
    hierarchy: (id: string) => [...queryKeys.projects.detail(id), 'hierarchy'] as const,
    favorites: () => [...queryKeys.projects.all, 'favorites'] as const,
  },

  // -------------------------------------------------------------------------
  // Sections
  // -------------------------------------------------------------------------
  sections: {
    all: ['sections'] as const,
    lists: () => [...queryKeys.sections.all, 'list'] as const,
    list: (filters?: SectionFilters) => [...queryKeys.sections.lists(), filters] as const,
    details: () => [...queryKeys.sections.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.sections.details(), id] as const,
    hierarchy: (projectId: string) => [...queryKeys.sections.all, 'hierarchy', projectId] as const,
    decomposition: (id: string) => [...queryKeys.sections.detail(id), 'decomposition'] as const,
  },

  // -------------------------------------------------------------------------
  // Loadings (загрузки)
  // -------------------------------------------------------------------------
  loadings: {
    all: ['loadings'] as const,
    lists: () => [...queryKeys.loadings.all, 'list'] as const,
    list: (filters?: LoadingFilters) => [...queryKeys.loadings.lists(), filters] as const,
    details: () => [...queryKeys.loadings.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.loadings.details(), id] as const,
    byEmployee: (userId: string, dateRange?: { from: string; to: string }) =>
      [...queryKeys.loadings.all, 'employee', userId, dateRange] as const,
    bySection: (sectionId: string) => [...queryKeys.loadings.all, 'section', sectionId] as const,
  },

  // -------------------------------------------------------------------------
  // Справочники (редко меняются)
  // -------------------------------------------------------------------------
  departments: {
    all: ['departments'] as const,
    list: () => [...queryKeys.departments.all, 'list'] as const,
    detail: (id: string) => [...queryKeys.departments.all, 'detail', id] as const,
  },

  teams: {
    all: ['teams'] as const,
    list: (departmentId?: string) => [...queryKeys.teams.all, 'list', departmentId] as const,
    detail: (id: string) => [...queryKeys.teams.all, 'detail', id] as const,
  },

  positions: {
    all: ['positions'] as const,
    list: () => [...queryKeys.positions.all, 'list'] as const,
  },

  categories: {
    all: ['categories'] as const,
    list: () => [...queryKeys.categories.all, 'list'] as const,
  },

  workCategories: {
    all: ['work-categories'] as const,
    list: () => [...queryKeys.workCategories.all, 'list'] as const,
  },

  // -------------------------------------------------------------------------
  // Notifications
  // -------------------------------------------------------------------------
  notifications: {
    all: ['notifications'] as const,
    list: (userId: string) => [...queryKeys.notifications.all, 'list', userId] as const,
    unreadCount: (userId: string) => [...queryKeys.notifications.all, 'unread', userId] as const,
  },

  // -------------------------------------------------------------------------
  // Calendar
  // -------------------------------------------------------------------------
  calendar: {
    all: ['calendar'] as const,
    events: (params: { year: number; month: number; userId?: string }) =>
      [...queryKeys.calendar.all, 'events', params] as const,
    global: (params: { year: number; month: number }) =>
      [...queryKeys.calendar.all, 'global', params] as const,
  },

  // -------------------------------------------------------------------------
  // Resource Graph (график ресурсов)
  // -------------------------------------------------------------------------
  resourceGraph: {
    all: ['resource-graph'] as const,
    lists: () => [...queryKeys.resourceGraph.all, 'list'] as const,
    list: (filters?: Record<string, unknown>) => [...queryKeys.resourceGraph.lists(), filters] as const,
    user: (userId: string) => [...queryKeys.resourceGraph.all, 'user', userId] as const,
    /** Work logs для раздела (lazy load при развороте) */
    workLogs: (sectionId: string) => [...queryKeys.resourceGraph.all, 'workLogs', sectionId] as const,
    /** Loadings для раздела (lazy load при развороте) */
    loadings: (sectionId: string) => [...queryKeys.resourceGraph.all, 'loadings', sectionId] as const,
    /** Stage readiness для раздела (lazy load при развороте) */
    stageReadiness: (sectionId: string) => [...queryKeys.resourceGraph.all, 'stageReadiness', sectionId] as const,
  },

  // -------------------------------------------------------------------------
  // Budgets (бюджеты)
  // -------------------------------------------------------------------------
  budgets: {
    all: ['budgets'] as const,
    lists: () => [...queryKeys.budgets.all, 'list'] as const,
    list: (filters?: BudgetFilters) => [...queryKeys.budgets.lists(), filters] as const,
    details: () => [...queryKeys.budgets.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.budgets.details(), id] as const,
    versions: (budgetId: string) => [...queryKeys.budgets.detail(budgetId), 'versions'] as const,
    byEntity: (entityType: string, entityId: string) =>
      [...queryKeys.budgets.all, 'entity', entityType, entityId] as const,
    sectionSummary: (projectId?: string) =>
      [...queryKeys.budgets.all, 'section-summary', projectId] as const,
  },

  // -------------------------------------------------------------------------
  // Budget Tags (теги бюджетов)
  // -------------------------------------------------------------------------
  budgetTags: {
    all: ['budget-tags'] as const,
    list: () => [...queryKeys.budgetTags.all, 'list'] as const,
    detail: (id: string) => [...queryKeys.budgetTags.all, 'detail', id] as const,
  },
} as const

// ============================================================================
// Type helpers
// ============================================================================

export type QueryKeys = typeof queryKeys
