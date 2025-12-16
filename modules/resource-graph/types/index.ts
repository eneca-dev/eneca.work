/**
 * Resource Graph Module - Types
 *
 * Типы данных для модуля графика ресурсов
 */

import type { Database } from '@/types/db'

// ============================================================================
// Database Type Helpers
// ============================================================================

/** Извлекает тип строки из view */
export type ViewRow<T extends keyof Database['public']['Views']> =
  Database['public']['Views'][T]['Row']

/** Извлекает тип enum */
export type DbEnum<T extends keyof Database['public']['Enums']> =
  Database['public']['Enums'][T]

// ============================================================================
// Database Types (from generated types)
// ============================================================================

/** Строка из view v_resource_graph - полная иерархия проекта */
export type ResourceGraphRow = ViewRow<'v_resource_graph'>

/** Статус проекта из БД */
export type ProjectStatusType = DbEnum<'project_status_enum'>

// ============================================================================
// Domain Types - Иерархия проекта
// ============================================================================

/**
 * Элемент декомпозиции (самый нижний уровень)
 * Project → Stage → Object → Section → DecompositionStage → DecompositionItem
 */
export interface DecompositionItem {
  id: string
  description: string
  plannedHours: number
  plannedDueDate: string | null
  progress: number | null
  order: number
  responsible: {
    id: string | null
    firstName: string | null
    lastName: string | null
    name: string | null
  }
  status: {
    id: string | null
    name: string | null
    color: string | null
  }
  difficulty: {
    id: string | null
    abbr: string | null
    name: string | null
  }
  workCategoryId: string | null
  workCategoryName: string | null
}

/**
 * Этап декомпозиции
 * Project → Stage → Object → Section → DecompositionStage
 */
export interface DecompositionStage {
  id: string
  name: string
  startDate: string | null
  finishDate: string | null
  status: {
    id: string | null
    name: string | null
    color: string | null
  }
  items: DecompositionItem[]
  /** Фактическая готовность (ежедневные снэпшоты) */
  actualReadiness?: ReadinessPoint[]
}

/**
 * Точка готовности (плановая или фактическая)
 */
export interface ReadinessPoint {
  /** Дата */
  date: string
  /** Готовность в % (0-100) */
  value: number
}

/** @deprecated Используй ReadinessPoint */
export type ReadinessCheckpoint = ReadinessPoint

/**
 * Точка расходования бюджета (накопительно по дням)
 */
export interface BudgetSpendingPoint {
  /** Дата */
  date: string
  /** Накопленная сумма расхода */
  spent: number
  /** Процент от бюджета (0-100+) */
  percentage: number
}

// ============================================================================
// Work Log Types - Отчёты о работе
// ============================================================================

/**
 * Отчёт о работе (work_log)
 * Привязан к decomposition_item
 */
export interface WorkLog {
  /** ID отчёта */
  id: string
  /** ID элемента декомпозиции */
  itemId: string
  /** Дата отчёта */
  date: string
  /** Количество часов */
  hours: number
  /** Сумма в деньгах (hours * hourly_rate) */
  amount: number
  /** Описание работы (для tooltip) */
  description: string
  /** Кто создал отчёт */
  createdBy: {
    id: string | null
    firstName: string | null
    lastName: string | null
    name: string | null
  }
  /** Бюджет (budget_id теперь обязателен) */
  budget: {
    id: string
    name: string
    typeName: string | null
    typeColor: string | null
  }
}

// ============================================================================
// Loading Types - Загрузки сотрудников
// ============================================================================

/**
 * Загрузка сотрудника на этап декомпозиции
 */
export interface Loading {
  /** ID загрузки */
  id: string
  /** ID этапа декомпозиции */
  stageId: string
  /** Дата начала загрузки */
  startDate: string
  /** Дата окончания загрузки */
  finishDate: string
  /** Ставка (0.25, 0.5, 0.75, 1) */
  rate: number
  /** Комментарий к загрузке */
  comment: string | null
  /** Статус загрузки */
  status: 'active' | 'completed' | 'cancelled'
  /** Это запрос на ресурс (нехватка) */
  isShortage: boolean
  /** Сотрудник */
  employee: {
    id: string | null
    firstName: string | null
    lastName: string | null
    name: string | null
    avatarUrl: string | null
  }
}

/**
 * Раздел проекта
 * Project → Stage → Object → Section
 */
export interface Section {
  id: string
  name: string
  startDate: string | null
  endDate: string | null
  responsible: {
    id: string | null
    firstName: string | null
    lastName: string | null
    name: string | null
    avatarUrl: string | null
  }
  status: {
    id: string | null
    name: string | null
    color: string | null
  }
  /** Контрольные точки плановой готовности */
  readinessCheckpoints: ReadinessCheckpoint[]
  /** Фактическая готовность (ежедневные снэпшоты) */
  actualReadiness: ReadinessPoint[]
  /** Расходование бюджета (накопительно по дням) */
  budgetSpending: BudgetSpendingPoint[]
  decompositionStages: DecompositionStage[]
}

/**
 * Объект проекта
 * Project → Stage → Object
 */
export interface ProjectObject {
  id: string
  name: string
  sections: Section[]
}

/**
 * Стадия проекта
 * Project → Stage
 */
export interface Stage {
  id: string
  name: string
  objects: ProjectObject[]
}

/**
 * Проект с полной структурой
 * Project (верхний уровень)
 */
export interface Project {
  id: string
  name: string
  status: ProjectStatusType | null
  manager: {
    id: string | null
    firstName: string | null
    lastName: string | null
    name: string | null
  }
  stages: Stage[]
}

// ============================================================================
// Filter Types
// ============================================================================

/** Тег проекта */
export interface ProjectTag {
  id: string
  name: string
  color: string | null
}

// ============================================================================
// Calendar Types - Праздники и переносы
// ============================================================================

/** Тип события календаря */
export type CalendarEventType = 'Праздник' | 'Перенос'

/**
 * Событие календаря компании (праздник или перенос)
 */
export interface CompanyCalendarEvent {
  /** ID события */
  id: string
  /** Тип: Праздник или Перенос */
  type: CalendarEventType
  /** Дата начала */
  dateStart: string
  /** Дата окончания (может быть null для однодневных событий) */
  dateEnd: string | null
  /** Название/комментарий (например "Новый год") */
  name: string | null
  /**
   * Является ли рабочим днём (для переносов)
   * true = суббота стала рабочей
   * false = будний день стал выходным
   * null = не применимо (для праздников)
   */
  isWorkday: boolean | null
}

/**
 * Информация о дне для timeline
 */
export interface DayInfo {
  /** Дата */
  date: Date
  /** Является ли праздником */
  isHoliday: boolean
  /** Название праздника */
  holidayName: string | null
  /** Является ли рабочим днём (с учётом переносов) */
  isWorkday: boolean
  /** Является ли выходным днём по умолчанию (Сб/Вс) */
  isDefaultWeekend: boolean
  /** Это перенесённый рабочий день */
  isTransferredWorkday: boolean
  /** Это перенесённый выходной */
  isTransferredDayOff: boolean
}

// ============================================================================
// View Types - Настройки отображения
// ============================================================================

/** Диапазон временной шкалы */
export interface TimelineRange {
  start: Date
  end: Date
  totalDays: number
}

/** Масштаб временной шкалы */
export type TimelineScale = 'day' | 'week' | 'month' | 'quarter'

/** Настройки отображения */
export interface DisplaySettings {
  scale: TimelineScale
  showWeekends: boolean
  showHolidays: boolean
  compactMode: boolean
}

// ============================================================================
// Tree Node Types - для отображения иерархии
// ============================================================================

/** Тип узла дерева */
export type TreeNodeType =
  | 'project'
  | 'stage'
  | 'object'
  | 'section'
  | 'decomposition_stage'
  | 'decomposition_item'

/** Базовый узел дерева */
export interface TreeNode {
  id: string
  type: TreeNodeType
  name: string
  children?: TreeNode[]
  data?: Record<string, unknown>
}
