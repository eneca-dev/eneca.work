import { queryKeys } from '../keys/query-keys'

/**
 * Типы событий Postgres Realtime
 */
export type RealtimeEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*'

/**
 * Конфигурация подписки на таблицу
 */
export interface TableSubscription {
  /** Имя таблицы в БД */
  table: string
  /** События для подписки (по умолчанию все) */
  events?: RealtimeEvent[]
  /** Query keys для инвалидации при изменении */
  invalidateKeys: readonly (readonly unknown[])[]
  /** Дополнительный фильтр (например, filter: 'user_id=eq.123') */
  filter?: string
}

/**
 * Конфигурация всех подписок
 *
 * Чтобы добавить новую таблицу:
 * 1. Добавь запись в этот массив
 * 2. Укажи какие query keys инвалидировать
 *
 * @example
 * {
 *   table: 'my_table',
 *   invalidateKeys: [queryKeys.myEntity.all],
 * }
 */
export const realtimeSubscriptions: TableSubscription[] = [
  // ============================================================================
  // Проекты и структура
  // ============================================================================
  {
    table: 'projects',
    invalidateKeys: [queryKeys.projects.all],
  },
  {
    table: 'stages',
    invalidateKeys: [queryKeys.projects.all], // Структура проекта
  },
  {
    table: 'objects',
    invalidateKeys: [queryKeys.projects.all], // Структура проекта
  },
  {
    table: 'sections',
    invalidateKeys: [
      queryKeys.sections.all,
      queryKeys.projects.all, // Структура проекта тоже обновляется
      queryKeys.resourceGraph.all, // График ресурсов
      queryKeys.sectionsPage.all, // Страница разделов (иерархия отделы → проекты → разделы)
    ],
  },

  // ============================================================================
  // Сотрудники
  // ============================================================================
  {
    table: 'profiles',
    invalidateKeys: [
      queryKeys.users.all,
      queryKeys.departmentsTimeline.all, // Таймлайн отделов (сотрудники в командах)
      queryKeys.sectionsPage.all, // Страница разделов (сотрудники с загрузками)
    ],
  },

  // ============================================================================
  // Загрузки
  // ============================================================================
  {
    table: 'loadings',
    invalidateKeys: [
      queryKeys.loadings.all,
      // НЕ инвалидируем sections.all - слишком агрессивно, вызывает лаги
      // Optimistic updates обрабатывают UI, подсчёты пересчитаются при refetch
      // Resource graph loadings (lazy-loaded per section)
      [...queryKeys.resourceGraph.all, 'loadings'],
      queryKeys.departmentsTimeline.all, // Таймлайн отделов (загрузки сотрудников)
      queryKeys.sectionsPage.all, // Страница разделов (загрузки по разделам)
      queryKeys.budgets.calc(), // Расчётный бюджет из loadings (страница бюджетов)
    ],
  },
  // Настройки ставок отделов — влияют на расчётный бюджет
  {
    table: 'department_budget_settings',
    invalidateKeys: [
      queryKeys.budgets.departmentSettings(),
      queryKeys.budgets.calc(),
    ],
  },
  {
    table: 'decomposition_stages',
    invalidateKeys: [
      queryKeys.decomposition.all, // Этапы декомпозиции
      queryKeys.sections.all, // Подсчёты в секциях
      queryKeys.resourceGraph.all, // График ресурсов
      queryKeys.kanban.all, // Канбан-доска
      // Ответственные за этапы (lazy-loaded данные)
      [...queryKeys.resourceGraph.all, 'stageResponsibles'],
    ],
  },
  {
    table: 'decomposition_items',
    invalidateKeys: [
      queryKeys.decomposition.all, // Задачи декомпозиции
      queryKeys.sections.all, // Подсчёты в секциях
      queryKeys.resourceGraph.all, // График ресурсов
      queryKeys.kanban.all, // Канбан-доска (задачи)
    ],
  },

  // ============================================================================
  // Готовность разделов
  // ============================================================================
  {
    table: 'section_readiness_checkpoints',
    invalidateKeys: [
      queryKeys.resourceGraph.all, // Плановая готовность
    ],
  },
  {
    table: 'section_readiness_snapshots',
    invalidateKeys: [
      queryKeys.resourceGraph.all, // Фактическая готовность
    ],
  },
  // stage_readiness_snapshots, work_logs, project_reports, budgets, budget_parts —
  // не добавлены в supabase_realtime publication и слабо используются на фронте.
  // Убраны чтобы не вызывать CHANNEL_ERROR и снизить нагрузку на realtime.

  // ============================================================================
  // Справочники
  // ============================================================================
  {
    table: 'departments',
    invalidateKeys: [
      queryKeys.departments.all,
      queryKeys.admin.departments(), // Admin панель — отделы
      queryKeys.departmentsTimeline.all, // Таймлайн отделов
      queryKeys.sectionsPage.all, // Страница разделов (группировка по отделам)
    ],
  },
  {
    table: 'teams',
    invalidateKeys: [
      queryKeys.teams.all,
      queryKeys.admin.teams(), // Admin панель — команды
      queryKeys.departmentsTimeline.all, // Таймлайн отделов (команды внутри отделов)
    ],
  },
  {
    table: 'clients',
    invalidateKeys: [queryKeys.projects.all], // Клиенты в проектах
  },

  // ============================================================================
  // Уведомления (опционально - можно убрать если не нужно)
  // ============================================================================
  {
    table: 'notifications',
    invalidateKeys: [queryKeys.notifications.all],
  },
  {
    table: 'user_notifications',
    invalidateKeys: [queryKeys.notifications.all],
  },

  // ============================================================================
  // Checkpoints (чекпоинты/дедлайны разделов)
  // ============================================================================
  {
    table: 'section_checkpoints',
    invalidateKeys: [
      queryKeys.checkpoints.all,
      queryKeys.sections.all,
      queryKeys.resourceGraph.all,
    ],
  },
  {
    table: 'checkpoint_section_links',
    invalidateKeys: [
      queryKeys.checkpoints.all,
    ],
  },
  {
    table: 'checkpoint_audit',
    events: ['INSERT'],
    invalidateKeys: [
      queryKeys.checkpoints.all,
    ],
  },
  {
    table: 'checkpoint_types',
    invalidateKeys: [
      queryKeys.checkpointTypes.all,
      queryKeys.checkpoints.all,
    ],
  },

  // ============================================================================
  // Роли и разрешения (для filter permissions)
  // ============================================================================
  {
    table: 'user_roles',
    invalidateKeys: [
      queryKeys.filterPermissions.all,
      queryKeys.users.all, // Роли влияют на пользователя
    ],
  },
  {
    table: 'role_permissions',
    invalidateKeys: [
      queryKeys.filterPermissions.all,
    ],
  },
]

/**
 * Имя канала Realtime
 */
export const REALTIME_CHANNEL_NAME = 'cache-sync'

/**
 * Debounce время в мс для группировки инвалидаций
 */
export const INVALIDATION_DEBOUNCE_MS = 100
