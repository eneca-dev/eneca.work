/**
 * Resource Graph Module - Utilities
 *
 * Утилиты для работы с данными графика ресурсов
 */

import { addDays, differenceInDays, startOfWeek, endOfWeek, format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { formatMinskDate, getMinskDayOfWeek, getTodayMinsk } from '@/lib/timezone-utils'
import type {
  TimelineRange,
  TimelineScale,
  ResourceGraphRow,
  Project,
  ProjectObject,
  Section,
  DecompositionStage,
  DecompositionItem,
  CompanyCalendarEvent,
  DayInfo,
  ReadinessCheckpoint,
  BudgetSpendingPoint,
} from '../types'
import { DEFAULT_MONTHS_RANGE } from '../constants'

// ============================================================================
// Timeline Utilities
// ============================================================================

/**
 * Создаёт диапазон временной шкалы
 *
 * @param start - Начальная дата (по умолчанию сегодня)
 * @param months - Количество месяцев (по умолчанию DEFAULT_MONTHS_RANGE)
 * @returns Диапазон временной шкалы
 */
export function createTimelineRange(
  start: Date = getTodayMinsk(),
  months: number = DEFAULT_MONTHS_RANGE
): TimelineRange {
  const end = addDays(start, months * 30)
  return {
    start,
    end,
    totalDays: differenceInDays(end, start),
  }
}

/**
 * Генерирует массив дат для временной шкалы
 *
 * @param range - Диапазон временной шкалы
 * @param scale - Масштаб (day, week, month)
 * @returns Массив дат
 */
export function generateTimelineDates(
  range: TimelineRange,
  scale: TimelineScale
): Date[] {
  const dates: Date[] = []
  let current = range.start

  while (current <= range.end) {
    dates.push(current)

    switch (scale) {
      case 'day':
        current = addDays(current, 1)
        break
      case 'week':
        current = addDays(current, 7)
        break
      case 'month':
        current = addDays(current, 30)
        break
      case 'quarter':
        current = addDays(current, 90)
        break
    }
  }

  return dates
}

/**
 * Форматирует дату для отображения в заголовке
 *
 * @param date - Дата
 * @param scale - Масштаб
 * @returns Отформатированная строка
 */
export function formatTimelineHeader(date: Date, scale: TimelineScale): string {
  switch (scale) {
    case 'day':
      return format(date, 'd', { locale: ru })
    case 'week':
      return format(date, 'dd.MM', { locale: ru })
    case 'month':
      return format(date, 'LLL', { locale: ru })
    case 'quarter':
      return `Q${Math.ceil((date.getMonth() + 1) / 3)}`
  }
}

// ============================================================================
// Position Utilities
// ============================================================================

/**
 * Вычисляет позицию элемента на временной шкале
 *
 * @param itemStart - Начало элемента
 * @param itemEnd - Конец элемента
 * @param timelineRange - Диапазон временной шкалы
 * @param totalWidth - Общая ширина шкалы в пикселях
 * @returns Позиция и ширина элемента
 */
export function calculateItemPosition(
  itemStart: Date,
  itemEnd: Date,
  timelineRange: TimelineRange,
  totalWidth: number
): { left: number; width: number } {
  const pixelsPerDay = totalWidth / timelineRange.totalDays

  const startOffset = Math.max(
    0,
    differenceInDays(itemStart, timelineRange.start)
  )
  const endOffset = Math.min(
    timelineRange.totalDays,
    differenceInDays(itemEnd, timelineRange.start)
  )

  const left = startOffset * pixelsPerDay
  const width = Math.max(1, (endOffset - startOffset) * pixelsPerDay)

  return { left, width }
}

// ============================================================================
// Data Utilities
// ============================================================================

/**
 * Проверяет, является ли день выходным
 *
 * @param date - Дата
 * @returns true если выходной
 */
export function isWeekend(date: Date): boolean {
  const day = date.getDay()
  return day === 0 || day === 6
}

/**
 * Получает границы недели
 *
 * @param date - Дата
 * @returns Начало и конец недели
 */
export function getWeekBounds(date: Date): { start: Date; end: Date } {
  return {
    start: startOfWeek(date, { weekStartsOn: 1 }),
    end: endOfWeek(date, { weekStartsOn: 1 }),
  }
}

// ============================================================================
// Hierarchy Transformation
// ============================================================================

/**
 * Трансформирует плоские строки из v_resource_graph в иерархическую структуру
 *
 * Иерархия: Project → Object → Section → DecompositionStage → DecompositionItem
 *
 * @param rows - Строки из view v_resource_graph
 * @returns Массив проектов с вложенной иерархией
 */
export function transformRowsToHierarchy(rows: ResourceGraphRow[]): Project[] {
  const projectsMap = new Map<string, Project>()

  for (const row of rows) {
    // Skip rows without project_id
    if (!row.project_id) continue

    // Get or create project
    let project = projectsMap.get(row.project_id)
    if (!project) {
      project = {
        id: row.project_id,
        name: row.project_name || '',
        status: row.project_status || null,
        stageType: row.stage_type || null,
        manager: {
          id: row.manager_id || null,
          firstName: row.manager_first_name || null,
          lastName: row.manager_last_name || null,
          name: row.manager_name || null,
        },
        objects: [],
      }
      projectsMap.set(row.project_id, project)
    }

    // Skip if no object
    if (!row.object_id) continue

    // Get or create object
    let object = project.objects.find(o => o.id === row.object_id)
    if (!object) {
      object = {
        id: row.object_id,
        name: row.object_name || '',
        sections: [],
      }
      project.objects.push(object)
    }

    // Skip if no section
    if (!row.section_id) continue

    // Get or create section
    let section = object.sections.find(s => s.id === row.section_id)
    if (!section) {
      // Парсим JSONB checkpoints (плановая готовность)
      const rawCheckpoints = row.section_readiness_checkpoints
      let readinessCheckpoints: ReadinessCheckpoint[] = []
      if (rawCheckpoints && Array.isArray(rawCheckpoints)) {
        readinessCheckpoints = rawCheckpoints as ReadinessCheckpoint[]
      }

      // Парсим JSONB actual readiness (фактическая готовность)
      const rawActual = (row as Record<string, unknown>).section_actual_readiness
      let actualReadiness: ReadinessCheckpoint[] = []
      if (rawActual && Array.isArray(rawActual)) {
        actualReadiness = rawActual as ReadinessCheckpoint[]
      }

      // Парсим JSONB budget spending (расходование бюджета)
      const rawBudgetSpending = (row as Record<string, unknown>).section_budget_spending
      let budgetSpending: BudgetSpendingPoint[] = []
      if (rawBudgetSpending && Array.isArray(rawBudgetSpending)) {
        budgetSpending = rawBudgetSpending as BudgetSpendingPoint[]
      }

      section = {
        id: row.section_id,
        name: row.section_name || '',
        description: row.section_description || null,
        startDate: row.section_start_date || null,
        endDate: row.section_end_date || null,
        responsible: {
          id: row.section_responsible_id || null,
          firstName: row.section_responsible_first_name || null,
          lastName: row.section_responsible_last_name || null,
          name: row.section_responsible_name || null,
          avatarUrl: (row as Record<string, unknown>).section_responsible_avatar as string | null || null,
        },
        status: {
          id: row.section_status_id || null,
          name: row.section_status_name || null,
          color: row.section_status_color || null,
        },
        readinessCheckpoints,
        actualReadiness,
        budgetSpending,
        decompositionStages: [],
      }
      object.sections.push(section)
    }

    // Skip if no decomposition stage
    if (!row.decomposition_stage_id) continue

    // Get or create decomposition stage
    let decompStage = section.decompositionStages.find(
      ds => ds.id === row.decomposition_stage_id
    )
    if (!decompStage) {
      decompStage = {
        id: row.decomposition_stage_id,
        name: row.decomposition_stage_name || '',
        startDate: row.decomposition_stage_start || null,
        finishDate: row.decomposition_stage_finish || null,
        status: {
          id: row.decomposition_stage_status_id || null,
          name: row.decomposition_stage_status_name || null,
          color: row.decomposition_stage_status_color || null,
        },
        items: [],
      }
      section.decompositionStages.push(decompStage)
    }

    // Skip if no decomposition item
    if (!row.decomposition_item_id) continue

    // Check if item already exists
    const existingItem = decompStage.items.find(
      i => i.id === row.decomposition_item_id
    )
    if (existingItem) continue

    // Create decomposition item
    const item: DecompositionItem = {
      id: row.decomposition_item_id,
      description: row.decomposition_item_description || '',
      plannedHours: row.decomposition_item_planned_hours || 0,
      plannedDueDate: row.decomposition_item_planned_due_date || null,
      progress: row.decomposition_item_progress || null,
      order: row.decomposition_item_order || 0,
      responsible: {
        id: row.item_responsible_id || null,
        firstName: row.item_responsible_first_name || null,
        lastName: row.item_responsible_last_name || null,
        name: row.item_responsible_name || null,
      },
      status: {
        id: row.decomposition_item_status_id || null,
        name: row.item_status_name || null,
        color: row.item_status_color || null,
      },
      difficulty: {
        id: row.decomposition_item_difficulty_id || null,
        abbr: row.item_difficulty_abbr || null,
        name: row.item_difficulty_name || null,
      },
      workCategoryId: row.decomposition_item_work_category_id || null,
      workCategoryName: row.work_category_name || null,
    }
    decompStage.items.push(item)
  }

  // Sort items by order
  for (const project of projectsMap.values()) {
    for (const object of project.objects) {
      for (const section of object.sections) {
        for (const decompStage of section.decompositionStages) {
          decompStage.items.sort((a, b) => a.order - b.order)
        }
      }
    }
  }

  return Array.from(projectsMap.values())
}

// ============================================================================
// Calendar Utilities - Праздники и переносы
// ============================================================================

/**
 * Форматирует дату в строку для использования в качестве ключа
 * Использует часовой пояс Минска для консистентности
 *
 * @param date - Дата
 * @returns Строка в формате 'YYYY-MM-DD' в часовом поясе Минска
 */
export function formatDateKey(date: Date): string {
  return formatMinskDate(date)
}

/**
 * Создаёт карту информации о днях на основе событий календаря
 *
 * Учитывает:
 * - Праздники (isHoliday = true, isWorkday = false)
 * - Переносы: рабочая суббота (isTransferredWorkday = true)
 * - Переносы: выходной будний день (isTransferredDayOff = true)
 *
 * @param events - Массив событий календаря
 * @returns Map<dateKey, DayInfo>
 */
export function buildCalendarMap(events: CompanyCalendarEvent[]): Map<string, Partial<DayInfo>> {
  const map = new Map<string, Partial<DayInfo>>()

  for (const event of events) {
    // Парсим дату начала
    const startDate = new Date(event.dateStart)
    const endDate = event.dateEnd ? new Date(event.dateEnd) : startDate

    // Обрабатываем каждый день диапазона
    let current = startDate
    while (current <= endDate) {
      const key = formatDateKey(current)

      if (event.type === 'Праздник') {
        // Праздник - день становится выходным
        map.set(key, {
          ...map.get(key),
          isHoliday: true,
          holidayName: event.name,
          isWorkday: false,
        })
      } else if (event.type === 'Перенос') {
        // Перенос рабочего дня
        if (event.isWorkday === true) {
          // Суббота/воскресенье становится рабочим днём
          map.set(key, {
            ...map.get(key),
            isTransferredWorkday: true,
            isWorkday: true,
          })
        } else if (event.isWorkday === false) {
          // Будний день становится выходным
          map.set(key, {
            ...map.get(key),
            isTransferredDayOff: true,
            isWorkday: false,
          })
        }
      }

      current = addDays(current, 1)
    }
  }

  return map
}

/**
 * Вычисляет полную информацию о дне с учётом праздников и переносов
 *
 * @param date - Дата
 * @param calendarMap - Карта календарных событий
 * @returns Полная информация о дне
 */
export function getDayInfo(date: Date, calendarMap: Map<string, Partial<DayInfo>>): DayInfo {
  const key = formatDateKey(date)
  const calendarInfo = calendarMap.get(key)
  // Используем день недели в часовом поясе Минска
  const dayOfWeek = getMinskDayOfWeek(date)
  const isDefaultWeekend = dayOfWeek === 0 || dayOfWeek === 6

  // Базовые значения
  const baseInfo: DayInfo = {
    date,
    isHoliday: false,
    holidayName: null,
    isWorkday: !isDefaultWeekend, // По умолчанию: Пн-Пт - рабочие, Сб-Вс - выходные
    isDefaultWeekend,
    isTransferredWorkday: false,
    isTransferredDayOff: false,
  }

  // Если нет информации в календаре - возвращаем базовые значения
  if (!calendarInfo) {
    return baseInfo
  }

  // Применяем информацию из календаря
  return {
    ...baseInfo,
    isHoliday: calendarInfo.isHoliday ?? baseInfo.isHoliday,
    holidayName: calendarInfo.holidayName ?? baseInfo.holidayName,
    isWorkday: calendarInfo.isWorkday ?? baseInfo.isWorkday,
    isTransferredWorkday: calendarInfo.isTransferredWorkday ?? baseInfo.isTransferredWorkday,
    isTransferredDayOff: calendarInfo.isTransferredDayOff ?? baseInfo.isTransferredDayOff,
  }
}

// ============================================================================
// Employee Color Utilities - Цвета сотрудников
// ============================================================================

/**
 * Палитра цветов для сотрудников
 * Яркие, различимые цвета для тёмной темы
 */
export const EMPLOYEE_COLORS = [
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#06b6d4', // cyan
  '#22c55e', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#ec4899', // pink
  '#14b8a6', // teal
  '#f97316', // orange
  '#6366f1', // indigo
] as const

/**
 * Цвет на основе ID сотрудника
 * Один и тот же сотрудник всегда получает один цвет
 *
 * @param employeeId - UUID сотрудника
 * @returns Hex цвет из палитры
 */
export function getEmployeeColor(employeeId: string | null): string {
  if (!employeeId) return '#6b7280' // gray-500 для неназначенных

  // Простой хеш из ID для получения индекса цвета
  let hash = 0
  for (let i = 0; i < employeeId.length; i++) {
    hash = ((hash << 5) - hash) + employeeId.charCodeAt(i)
    hash = hash & hash // Convert to 32bit integer
  }

  const index = Math.abs(hash) % EMPLOYEE_COLORS.length
  return EMPLOYEE_COLORS[index]
}

// ============================================================================
// Checkpoint Mapping
// ============================================================================

import type { BatchCheckpoint } from '../types'
import type { Checkpoint } from '@/modules/checkpoints/actions/checkpoints'

/**
 * Преобразует BatchCheckpoint (из batch загрузки) в Checkpoint (для CheckpointMarkers)
 *
 * Batch-тип использует camelCase и содержит только поля, нужные для отображения.
 * Checkpoint использует snake_case и включает дополнительные поля для модалок.
 *
 * @param batch - Чекпоинт из batch данных
 * @returns Чекпоинт в формате для CheckpointMarkers
 */
export function mapBatchCheckpointToCheckpoint(batch: BatchCheckpoint): Checkpoint {
  return {
    checkpoint_id: batch.id,
    section_id: batch.sectionId,
    type_id: batch.typeId,
    type_code: batch.typeCode,
    type_name: batch.typeName,
    is_custom: batch.isCustom,
    title: batch.title ?? '',
    description: batch.description,
    checkpoint_date: batch.checkpointDate,
    icon: batch.icon,
    color: batch.color,
    completed_at: batch.completedAt,
    completed_by: null, // Не используется в CheckpointMarkers
    status: batch.status,
    status_label: batch.statusLabel,
    created_by: null, // Не используется в CheckpointMarkers
    created_at: '', // Не используется в CheckpointMarkers
    updated_at: '', // Не используется в CheckpointMarkers
    section_responsible: null, // Не используется в CheckpointMarkers
    project_manager: null, // Не используется в CheckpointMarkers
    linked_sections: batch.linkedSections.map(ls => ({
      section_id: ls.section_id,
      section_name: ls.section_name,
      object_id: ls.object_id,
    })),
    linked_sections_count: batch.linkedSectionsCount,
  }
}

// ============================================================================
// Re-exports from format.ts
// ============================================================================

export {
  formatHoursCompact,
  formatBudgetAmount,
  formatDateShort,
  formatDateFull,
  formatRate,
  getInitials,
  getProgressColor,
} from './format'

// ============================================================================
// Re-exports from hierarchy.ts
// ============================================================================

export {
  updateInHierarchy,
  updateByIdInHierarchy,
  updateItemProgress as updateItemProgressInHierarchy,
  updateDecompositionStageDates,
  updateSectionDates as updateSectionDatesInHierarchy,
  type HierarchyLevel,
} from './hierarchy'
