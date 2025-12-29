/**
 * Filter Permissions Module - Types
 *
 * Система разрешений для inline-фильтров.
 * Определяет область видимости данных на основе permissions из БД.
 *
 * Permissions (в таблице permissions):
 * - filters.scope.all - полный доступ
 * - filters.scope.subdivision - доступ к подразделению
 * - filters.scope.department - доступ к отделу
 * - filters.scope.team - доступ к команде
 * - filters.scope.managed_projects - доступ к управляемым проектам
 */

// ============================================================================
// Filter Scope Permissions
// ============================================================================

/**
 * Permission для filter scope (хранится в БД)
 */
export type FilterScopePermission =
  | 'filters.scope.all'
  | 'filters.scope.subdivision'
  | 'filters.scope.department'
  | 'filters.scope.team'
  | 'filters.scope.managed_projects'

/**
 * Маппинг permission → scope level
 */
export const PERMISSION_TO_SCOPE: Record<FilterScopePermission, FilterScopeLevel> = {
  'filters.scope.all': 'all',
  'filters.scope.subdivision': 'subdivision',
  'filters.scope.department': 'department',
  'filters.scope.team': 'team',
  'filters.scope.managed_projects': 'projects',
}

/**
 * Приоритет permissions (меньше = выше приоритет)
 * Используется для определения итогового scope level
 */
export const PERMISSION_PRIORITY: Record<FilterScopePermission, number> = {
  'filters.scope.all': 1,
  'filters.scope.subdivision': 2,
  'filters.scope.department': 3,
  'filters.scope.managed_projects': 4,
  'filters.scope.team': 5,
}

// ============================================================================
// Filter Scope Types
// ============================================================================

/**
 * Уровень области видимости
 * - all: Администратор, видит всё
 * - subdivision: Начальник подразделения
 * - department: Начальник отдела
 * - team: Тимлид или сотрудник
 * - projects: Руководитель проекта (ортогонально орг. структуре)
 */
export type FilterScopeLevel =
  | 'all'
  | 'subdivision'
  | 'department'
  | 'team'
  | 'projects'

/**
 * Область видимости пользователя
 * Определяет какие данные пользователь может видеть и фильтровать
 */
export interface FilterScope {
  /** Уровень доступа */
  level: FilterScopeLevel

  /** ID подразделений (для subdivision_head) */
  subdivisionIds?: string[]

  /** ID отделов (для department_head или subdivision_head) */
  departmentIds?: string[]

  /** ID команд (для team_lead, department_head или subdivision_head) */
  teamIds?: string[]

  /** ID проектов (для project_manager) */
  projectIds?: string[]

  /** Заблокирован ли scope (нельзя изменить через UI) */
  isLocked: boolean
}

/**
 * Контекст фильтрации пользователя
 * Полная информация о пользователе для определения разрешений фильтров
 */
export interface UserFilterContext {
  /** ID пользователя */
  userId: string

  /** Все роли пользователя */
  roles: string[]

  /** Основная роль (для отображения) */
  primaryRole: string

  /** Все permissions пользователя (для unified permissions store) */
  permissions: string[]

  /** Filter scope permissions пользователя (из БД) */
  filterPermissions: FilterScopePermission[]

  // === Орг. структура пользователя ===

  /** ID команды пользователя */
  ownTeamId: string
  /** Название команды пользователя */
  ownTeamName: string

  /** ID отдела пользователя */
  ownDepartmentId: string
  /** Название отдела пользователя */
  ownDepartmentName: string

  /** ID подразделения пользователя */
  ownSubdivisionId: string
  /** Название подразделения пользователя */
  ownSubdivisionName: string

  // === Руководящие позиции ===

  /** ID команды, которой руководит (для team_lead) */
  leadTeamId?: string
  /** Название команды, которой руководит */
  leadTeamName?: string

  /** ID отдела, которым руководит (для department_head) */
  headDepartmentId?: string
  /** Название отдела, которым руководит */
  headDepartmentName?: string

  /** ID подразделения, которым руководит (для subdivision_head) */
  headSubdivisionId?: string
  /** Название подразделения, которым руководит */
  headSubdivisionName?: string

  /** ID управляемых проектов (для project_manager) */
  managedProjectIds?: string[]
  /** Названия управляемых проектов */
  managedProjectNames?: string[]

  // === Итоговый scope ===

  /** Вычисленная область видимости */
  scope: FilterScope
}

/**
 * Ключи фильтров, которые могут быть заблокированы
 */
export type LockableFilterKey =
  | 'подразделение'
  | 'отдел'
  | 'команда'
  | 'проект'

/**
 * Информация о заблокированном фильтре для отображения в UI
 */
export interface LockedFilter {
  /** Ключ фильтра */
  key: LockableFilterKey
  /** Значение (ID) */
  value: string
  /** Отображаемое название */
  displayName: string
}

/**
 * Конфигурация заблокированных фильтров для компонента InlineFilter
 */
export interface FilterLocks {
  /** Список заблокированных фильтров */
  locked: LockedFilter[]
  /** Уровень scope пользователя */
  scopeLevel: FilterScopeLevel
}

/**
 * Роли системы (для type safety)
 */
export type SystemRole =
  | 'admin'
  | 'subdivision_head'
  | 'department_head'
  | 'project_manager'
  | 'team_lead'
  | 'user'

/**
 * Приоритет ролей (меньше = выше приоритет)
 * Используется для определения primary role
 */
export const ROLE_PRIORITY: Record<SystemRole, number> = {
  admin: 1,
  subdivision_head: 2,
  department_head: 3,
  project_manager: 4,
  team_lead: 5,
  user: 6,
}

/**
 * Получить основную роль из списка ролей
 */
export function getPrimaryRole(roles: string[]): SystemRole {
  const systemRoles = roles.filter(
    (r): r is SystemRole => r in ROLE_PRIORITY
  )

  if (systemRoles.length === 0) return 'user'

  return systemRoles.reduce((primary, current) =>
    ROLE_PRIORITY[current] < ROLE_PRIORITY[primary] ? current : primary
  )
}
