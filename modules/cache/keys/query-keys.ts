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

export interface CheckpointFilters extends BaseFilters {
  sectionId?: string
  projectId?: string
  status?: 'pending' | 'completed' | 'completed_late' | 'overdue'
  dateFrom?: string
  dateTo?: string
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
  // Employees (расширенные данные сотрудников для назначения ответственных)
  // -------------------------------------------------------------------------
  employees: {
    all: ['employees'] as const,
    list: () => [...queryKeys.employees.all, 'list'] as const,
    detail: (id: string) => [...queryKeys.employees.all, 'detail', id] as const,
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
    /** Контрольные точки плановой готовности раздела */
    readinessCheckpoints: (sectionId: string) => [...queryKeys.sections.detail(sectionId), 'readiness-checkpoints'] as const,
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
  // Difficulty Levels (уровни сложности декомпозиции)
  // -------------------------------------------------------------------------
  difficultyLevels: {
    all: ['difficulty-levels'] as const,
    list: () => [...queryKeys.difficultyLevels.all, 'list'] as const,
  },

  // -------------------------------------------------------------------------
  // Stage Statuses (статусы этапов декомпозиции)
  // -------------------------------------------------------------------------
  stageStatuses: {
    all: ['stage-statuses'] as const,
    list: () => [...queryKeys.stageStatuses.all, 'list'] as const,
  },

  // -------------------------------------------------------------------------
  // Decomposition (этапы и задачи декомпозиции)
  // -------------------------------------------------------------------------
  decomposition: {
    all: ['decomposition'] as const,
    /** Bootstrap данные для раздела (этапы + items + справочники) */
    bootstrap: (sectionId: string) => [...queryKeys.decomposition.all, 'bootstrap', sectionId] as const,
    /** Этапы декомпозиции для раздела */
    stages: (sectionId: string) => [...queryKeys.decomposition.all, 'stages', sectionId] as const,
    /** Задачи для этапа */
    items: (stageId: string) => [...queryKeys.decomposition.all, 'items', stageId] as const,
    /** Агрегированные часы работы для задач */
    workLogs: (itemIdsKey: string) => [...queryKeys.decomposition.all, 'work-logs', itemIdsKey] as const,
  },

  // -------------------------------------------------------------------------
  // Notifications
  // -------------------------------------------------------------------------
  notifications: {
    all: ['notifications'] as const,
    lists: () => [...queryKeys.notifications.all, 'list'] as const,
    list: (
      userId: string,
      filters?: {
        onlyUnread?: boolean
        includeArchived?: boolean
        types?: string[]
      }
    ) => [...queryKeys.notifications.lists(), userId, filters] as const,
    infinite: (
      userId: string,
      filters?: {
        onlyUnread?: boolean
        includeArchived?: boolean
        types?: string[]
      }
    ) => [...queryKeys.notifications.list(userId, filters), 'infinite'] as const,
    unreadCount: (userId: string) =>
      [...queryKeys.notifications.all, 'unread-count', userId] as const,
    typeCounts: (userId: string, options?: { includeArchived?: boolean }) =>
      [...queryKeys.notifications.all, 'type-counts', userId, options] as const,
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
    /** Stage reports для стадии (lazy load при развороте) */
    stageReports: (stageId: string) => [...queryKeys.resourceGraph.all, 'stageReports', stageId] as const,
    /** Stage responsibles для раздела (lazy load при развороте) */
    stageResponsibles: (sectionId: string) => [...queryKeys.resourceGraph.all, 'stageResponsibles', sectionId] as const,
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

  // -------------------------------------------------------------------------
  // Checkpoints (чекпоинты/дедлайны)
  // -------------------------------------------------------------------------
  checkpoints: {
    all: ['checkpoints'] as const,
    lists: () => [...queryKeys.checkpoints.all, 'list'] as const,
    list: (filters?: CheckpointFilters) => [...queryKeys.checkpoints.lists(), filters] as const,
    details: () => [...queryKeys.checkpoints.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.checkpoints.details(), id] as const,
    audit: (id: string) => [...queryKeys.checkpoints.all, 'audit', id] as const,
    bySection: (sectionId: string) => [...queryKeys.checkpoints.lists(), { sectionId }] as const,
    byProject: (projectId: string) => [...queryKeys.checkpoints.lists(), { projectId }] as const,
  },

  // -------------------------------------------------------------------------
  // Checkpoint Types (типы чекпоинтов)
  // -------------------------------------------------------------------------
  checkpointTypes: {
    all: ['checkpoint-types'] as const,
    list: () => [...queryKeys.checkpointTypes.all, 'list'] as const,
    details: () => [...queryKeys.checkpointTypes.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.checkpointTypes.details(), id] as const,
  },

  // -------------------------------------------------------------------------
  // Kanban
  // -------------------------------------------------------------------------
  kanban: {
    all: ['kanban'] as const,
    lists: () => [...queryKeys.kanban.all, 'list'] as const,
    list: (filters?: Record<string, unknown>) => [...queryKeys.kanban.lists(), filters] as const,
    /** Infinite query key для пагинации */
    infinite: (filters?: Record<string, unknown>) => [...queryKeys.kanban.list(filters), 'infinite'] as const,
    details: () => [...queryKeys.kanban.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.kanban.details(), id] as const,
  },

  // -------------------------------------------------------------------------
  // Section Statuses (статусы разделов)
  // -------------------------------------------------------------------------
  sectionStatuses: {
    all: ['section-statuses'] as const,
    list: () => [...queryKeys.sectionStatuses.all, 'list'] as const,
  },

  // -------------------------------------------------------------------------
  // Filter Structure (структуры для автокомплита InlineFilter)
  // -------------------------------------------------------------------------
  filterStructure: {
    all: ['filter-structure'] as const,
    /** Организационная структура (подразделения, отделы) */
    org: () => [...queryKeys.filterStructure.all, 'org'] as const,
    /** Проектная структура (проекты) */
    project: () => [...queryKeys.filterStructure.all, 'project'] as const,
    /** Теги проектов */
    tags: () => [...queryKeys.filterStructure.all, 'tags'] as const,
  },

  // -------------------------------------------------------------------------
  // Project Tags (теги проектов)
  // -------------------------------------------------------------------------
  projectTags: {
    all: ['project-tags'] as const,
    /** Список всех тегов (справочник) */
    list: () => [...queryKeys.projectTags.all, 'list'] as const,
    /** Map тегов по проектам (Record<projectId, tags[]>) */
    map: () => [...queryKeys.projectTags.all, 'map'] as const,
  },

  // -------------------------------------------------------------------------
  // Company Calendar (праздники и переносы)
  // -------------------------------------------------------------------------
  companyCalendar: {
    all: ['company-calendar'] as const,
    /** События календаря (праздники и переносы) */
    events: () => [...queryKeys.companyCalendar.all, 'events'] as const,
  },
} as const

// ============================================================================
// Type helpers
// ============================================================================

export type QueryKeys = typeof queryKeys
