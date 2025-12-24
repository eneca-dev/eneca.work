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
    ],
  },

  // ============================================================================
  // Сотрудники
  // ============================================================================
  {
    table: 'profiles',
    invalidateKeys: [queryKeys.users.all],
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
    ],
  },
  {
    table: 'decomposition_stages',
    invalidateKeys: [
      queryKeys.decomposition.all, // Этапы декомпозиции
      queryKeys.sections.all, // Подсчёты в секциях
      queryKeys.resourceGraph.all, // График ресурсов
      queryKeys.kanban.all, // Канбан-доска
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

  // ============================================================================
  // Отчёты о работе (work_logs)
  // ============================================================================
  {
    table: 'work_logs',
    invalidateKeys: [
      // Инвалидируем все workLogs кеши (lazy-loaded данные)
      [...queryKeys.resourceGraph.all, 'workLogs'],
      // Инвалидируем resourceGraph.all для обновления section_budget_spending во view
      queryKeys.resourceGraph.all,
    ],
  },

  // ============================================================================
  // Отчёты к стадиям (project_reports)
  // ============================================================================
  {
    table: 'project_reports',
    invalidateKeys: [
      // Инвалидируем все stageReports кеши (lazy-loaded данные)
      [...queryKeys.resourceGraph.all, 'stageReports'],
      // Инвалидируем resourceGraph.all для обновления timeline
      queryKeys.resourceGraph.all,
    ],
  },

  // ============================================================================
  // Бюджеты
  // ============================================================================
  {
    table: 'budgets',
    invalidateKeys: [
      // При изменении бюджета обновляем данные графика ресурсов
      queryKeys.resourceGraph.all,
    ],
  },
  {
    table: 'budget_versions',
    invalidateKeys: [
      // При изменении версии бюджета (суммы) обновляем данные графика ресурсов
      queryKeys.resourceGraph.all,
    ],
  },

  // ============================================================================
  // Справочники
  // ============================================================================
  {
    table: 'section_statuses',
    invalidateKeys: [
      queryKeys.sectionStatuses.all,
      queryKeys.sections.all, // секции показывают статусы
      queryKeys.resourceGraph.all, // resource graph показывает статусы
    ],
  },
  {
    table: 'departments',
    invalidateKeys: [queryKeys.departments.all],
  },
  {
    table: 'teams',
    invalidateKeys: [queryKeys.teams.all],
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
]

/**
 * Имя канала Realtime
 */
export const REALTIME_CHANNEL_NAME = 'cache-sync'

/**
 * Debounce время в мс для группировки инвалидаций
 */
export const INVALIDATION_DEBOUNCE_MS = 100
