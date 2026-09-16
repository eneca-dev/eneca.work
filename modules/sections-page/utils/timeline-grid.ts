/**
 * Timeline Grid — единая точка вычисления «в каком масштабе рисуем строку»
 * и колонок этого масштаба.
 *
 * До появления месячного режима этот блок был скопирован в каждую строку
 * иерархии (DepartmentRow / ProjectRow / ObjectSectionRow / EmployeeRow) в двух
 * вариантах — день и неделя. Третий масштаб превратил бы копипасту в четыре
 * файла × три ветки, и она уже начала расходиться по именам переменных.
 *
 * Режим определяется наличием ячеек: недельные/месячные ячейки приходят пропом
 * только в соответствующем режиме (см. SectionsPageInternal).
 */

import { DAY_CELL_WIDTH } from '../constants'
import { WEEK_CELL_WIDTH, SECTIONS_MONTH_CELL_WIDTH } from '@/modules/resource-graph/constants'
import type { DayCell } from '../types'
import type { WeekCell } from '@/modules/resource-graph/utils/weekly-cell-utils'
import type { MonthCell } from '@/modules/resource-graph/utils/monthly-cell-utils'
import type { VirtualColumn } from '@/modules/shared/virtualized-tree'

const EMPTY_COLUMNS: VirtualColumn[] = []

export interface TimelineGridInput {
  dayCells: DayCell[]
  /** Недельные ячейки — заданы только в недельном режиме */
  weekCells?: WeekCell[]
  /** Месячные ячейки — заданы только в месячном режиме */
  monthCells?: MonthCell[]
  /** Видимые колонки от виртуализатора. undefined → строим все. */
  columns?: VirtualColumn[]
}

export interface TimelineGrid {
  isDailyMode: boolean
  isWeeklyMode: boolean
  isMonthlyMode: boolean
  /** Неделя или месяц: широкая сетка — без drag-resize и ножниц */
  isWideGrid: boolean
  /** Ширина области таймлайна в пикселях */
  timelineWidth: number
  /** Колонки активного режима; для неактивных — пустой массив (они не читаются) */
  dayCols: VirtualColumn[]
  weekCols: VirtualColumn[]
  monthCols: VirtualColumn[]
}

function buildColumns(count: number, width: number): VirtualColumn[] {
  return Array.from({ length: count }, (_, index) => ({
    index,
    start: index * width,
    size: width,
  }))
}

export function getTimelineGrid({
  dayCells,
  weekCells,
  monthCells,
  columns,
}: TimelineGridInput): TimelineGrid {
  const isWeeklyMode = weekCells !== undefined
  const isMonthlyMode = monthCells !== undefined
  const isDailyMode = !isWeeklyMode && !isMonthlyMode

  const timelineWidth = isWeeklyMode
    ? weekCells.length * WEEK_CELL_WIDTH
    : isMonthlyMode
    ? monthCells.length * SECTIONS_MONTH_CELL_WIDTH
    : dayCells.length * DAY_CELL_WIDTH

  return {
    isDailyMode,
    isWeeklyMode,
    isMonthlyMode,
    isWideGrid: isWeeklyMode || isMonthlyMode,
    timelineWidth,
    dayCols: isDailyMode
      ? columns ?? buildColumns(dayCells.length, DAY_CELL_WIDTH)
      : EMPTY_COLUMNS,
    weekCols: isWeeklyMode
      ? columns ?? buildColumns(weekCells.length, WEEK_CELL_WIDTH)
      : EMPTY_COLUMNS,
    monthCols: isMonthlyMode
      ? columns ?? buildColumns(monthCells.length, SECTIONS_MONTH_CELL_WIDTH)
      : EMPTY_COLUMNS,
  }
}
