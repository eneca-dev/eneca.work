/**
 * Loading Bars Utilities
 *
 * Утилиты для расчёта и отрисовки баров загрузок на timeline
 */

import { format, parseISO, eachDayOfInterval, isWithinInterval } from 'date-fns'
import type { SectionLoading, DayCell, ObjectSection } from '../types'
import { getSectionColor } from '@/components/shared/timeline/loading-bars-utils'

// ============================================================================
// Constants
// ============================================================================

export const BASE_BAR_HEIGHT = 32
export const BAR_GAP = 4
export const COMMENT_HEIGHT = 18
export const COMMENT_GAP = 2

// ============================================================================
// Types
// ============================================================================

export interface BarPeriod {
  id: string
  type: 'loading'
  startDate: Date
  endDate: Date
  rate: number
  color: string
  employeeName: string
  projectName?: string
  objectName?: string
  sectionName?: string
  stageName?: string
  comment?: string
  loading: SectionLoading // Original loading data
}

export interface BarRender {
  period: BarPeriod
  startIdx: number
  endIdx: number
  left: number
  width: number
  color: string
  layer: number // Слой для вертикального стакинга (0, 1, 2, ...)
}

// ============================================================================
// Color Generation
// ============================================================================

interface BarColorScheme {
  bg: string
  stripe: string
  text: string
}

const BAR_COLORS: BarColorScheme[] = [
  { bg: 'rgba(147, 51, 234, 0.85)', stripe: 'rgba(147, 51, 234, 0.55)', text: '#fff' },  // purple
  { bg: 'rgba(37, 99, 235, 0.85)', stripe: 'rgba(37, 99, 235, 0.55)', text: '#fff' },    // blue
  { bg: 'rgba(22, 163, 74, 0.85)', stripe: 'rgba(22, 163, 74, 0.55)', text: '#fff' },    // green
  { bg: 'rgba(234, 88, 12, 0.85)', stripe: 'rgba(234, 88, 12, 0.55)', text: '#fff' },    // orange
  { bg: 'rgba(219, 39, 119, 0.85)', stripe: 'rgba(219, 39, 119, 0.55)', text: '#fff' },  // pink
  { bg: 'rgba(79, 70, 229, 0.85)', stripe: 'rgba(79, 70, 229, 0.55)', text: '#fff' },    // indigo
  { bg: 'rgba(13, 148, 136, 0.85)', stripe: 'rgba(13, 148, 136, 0.55)', text: '#fff' },  // teal
  { bg: 'rgba(202, 138, 4, 0.85)', stripe: 'rgba(202, 138, 4, 0.55)', text: '#fff' },    // yellow
]

function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

export function getLoadingColorScheme(loadingId: string): BarColorScheme {
  return BAR_COLORS[hashString(loadingId) % BAR_COLORS.length]
}

export function getLoadingColor(loadingId: string): string {
  return getLoadingColorScheme(loadingId).bg
}

// ============================================================================
// Convert Loadings to Periods
// ============================================================================

export function loadingsToPeriods(loadings: SectionLoading[]): BarPeriod[] {
  return loadings.map((loading) => ({
    id: loading.id,
    type: 'loading' as const,
    startDate: parseISO(loading.startDate),
    endDate: parseISO(loading.endDate),
    rate: loading.rate,
    color: getSectionColor(loading.projectId, loading.sectionId, loading.stageId, false),
    employeeName: loading.employeeName,
    projectName: loading.projectName || '',
    objectName: loading.objectName || '',
    sectionName: loading.sectionName,
    stageName: loading.stageName || undefined,
    comment: loading.comment,
    loading,
  }))
}

// ============================================================================
// Calculate Bar Renders
// ============================================================================

export function calculateBarRenders(
  periods: BarPeriod[],
  dayCells: DayCell[],
  dayCellWidth: number
): BarRender[] {
  const renders: BarRender[] = []

  // Горизонтальный отступ между соседними полосками (в пикселях)
  const HORIZONTAL_GAP = 3

  for (const period of periods) {
    // Find start and end indices in dayCells
    const startIndex = dayCells.findIndex((cell) => {
      const cellDate = format(cell.date, 'yyyy-MM-dd')
      const periodStart = format(period.startDate, 'yyyy-MM-dd')
      return cellDate === periodStart
    })

    const endIndex = dayCells.findIndex((cell) => {
      const cellDate = format(cell.date, 'yyyy-MM-dd')
      const periodEnd = format(period.endDate, 'yyyy-MM-dd')
      return cellDate === periodEnd
    })

    // Skip if completely outside visible range
    if (startIndex === -1 && endIndex === -1) {
      // Check if period spans entire visible range
      const firstDay = dayCells[0].date
      const lastDay = dayCells[dayCells.length - 1].date
      if (period.startDate <= firstDay && period.endDate >= lastDay) {
        renders.push({
          period,
          startIdx: 0,
          endIdx: dayCells.length - 1,
          left: HORIZONTAL_GAP / 2,
          width: dayCells.length * dayCellWidth - HORIZONTAL_GAP,
          color: period.color,
          layer: 0,
        })
      }
      continue
    }

    // Calculate visible portion
    const visibleStartIndex = Math.max(0, startIndex === -1 ? 0 : startIndex)
    const visibleEndIndex = endIndex === -1 ? dayCells.length - 1 : endIndex

    const left = visibleStartIndex * dayCellWidth + HORIZONTAL_GAP / 2
    const width = (visibleEndIndex - visibleStartIndex + 1) * dayCellWidth - HORIZONTAL_GAP

    renders.push({
      period,
      startIdx: visibleStartIndex,
      endIdx: visibleEndIndex,
      left,
      width,
      color: period.color,
      layer: 0,
    })
  }

  // Calculate stack indices for overlapping bars
  renders.sort((a, b) => a.left - b.left)

  for (let i = 0; i < renders.length; i++) {
    const current = renders[i]
    let maxStack = 0

    for (let j = 0; j < i; j++) {
      const other = renders[j]
      const currentRight = current.left + current.width
      const otherRight = other.left + other.width

      // Check if bars overlap
      if (current.left < otherRight && currentRight > other.left) {
        maxStack = Math.max(maxStack, other.layer + 1)
      }
    }

    current.layer = maxStack
  }

  return renders
}

// ============================================================================
// Calculate Bar Top Position
// ============================================================================

export function calculateBarTop(
  bar: BarRender,
  allBars: BarRender[],
  baseBarHeight: number,
  barGap: number,
  initialOffset: number = 8
): number {
  let top = initialOffset

  // Для каждого слоя ниже текущего, находим максимальную высоту бара в этом слое
  for (let layer = 0; layer < bar.layer; layer++) {
    // Находим все бары в этом слое
    const barsInLayer = allBars.filter(other => other.layer === layer)

    if (barsInLayer.length > 0) {
      // Находим максимальную высоту среди баров этого слоя
      let maxHeightInLayer = baseBarHeight

      barsInLayer.forEach(other => {
        let effectiveHeight = baseBarHeight

        // Если у загрузки есть комментарий — добавляем его высоту
        if (other.period.type === 'loading' && other.period.comment) {
          effectiveHeight += COMMENT_GAP + COMMENT_HEIGHT
        }

        maxHeightInLayer = Math.max(maxHeightInLayer, effectiveHeight)
      })

      top += maxHeightInLayer + barGap
    }
  }

  return top
}

// ============================================================================
// Calculate Row Height
// ============================================================================

export function calculateEmployeeRowHeight(
  loadings: SectionLoading[],
  dayCells: DayCell[],
  dayCellWidth: number,
  baseRowHeight: number = 44
): number {
  if (loadings.length === 0) return baseRowHeight

  const periods = loadingsToPeriods(loadings)
  const barRenders = calculateBarRenders(periods, dayCells, dayCellWidth)

  if (barRenders.length === 0) return baseRowHeight

  let maxBottom = 0
  barRenders.forEach((bar) => {
    const top = calculateBarTop(bar, barRenders, BASE_BAR_HEIGHT, BAR_GAP, 8)
    let totalBarHeight = top + BASE_BAR_HEIGHT
    // Учитываем комментарии
    if (bar.period.type === 'loading' && bar.period.comment) {
      totalBarHeight += COMMENT_GAP + COMMENT_HEIGHT
    }
    maxBottom = Math.max(maxBottom, totalBarHeight)
  })

  return Math.max(baseRowHeight, maxBottom + 8)
}

// ============================================================================
// Format Bar Tooltip
// ============================================================================

export function formatBarTooltip(period: BarPeriod): string {
  const lines = [
    `${period.employeeName}`,
    `Ставка: ${period.rate}`,
    `${format(period.startDate, 'dd.MM.yyyy')} — ${format(period.endDate, 'dd.MM.yyyy')}`,
  ]

  if (period.projectName) {
    lines.push(`Проект: ${period.projectName}`)
  }

  if (period.stageName) {
    lines.push(`Этап: ${period.stageName}`)
  }

  if (period.comment) {
    lines.push(`Комментарий: ${period.comment}`)
  }

  return lines.join('\n')
}

// ============================================================================
// Get Bar Label Parts
// ============================================================================

export function getBarLabelParts(period: BarPeriod): {
  line1: string
  line2?: string
} {
  // Только ставка сверху
  const line1 = `${period.rate}`

  // Раздел снизу (с этапом если есть)
  const sectionText = period.sectionName || period.objectName || ''
  const line2 = period.stageName
    ? `${sectionText} · ${period.stageName}`
    : sectionText

  return { line1, line2: line2 || undefined }
}

// ============================================================================
// Split Period by Non-Working Days
// ============================================================================

export function splitPeriodByNonWorkingDays(
  period: BarPeriod,
  dayCells: DayCell[]
): BarPeriod[] {
  const days = eachDayOfInterval({
    start: period.startDate,
    end: period.endDate,
  })

  const segments: BarPeriod[] = []
  let currentSegmentStart: Date | null = null

  for (const day of days) {
    const dayCell = dayCells.find((cell) => {
      return format(cell.date, 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd')
    })

    const isWorkingDay = dayCell
      ? dayCell.isTransferredWorkday || (!dayCell.isWeekend && !dayCell.isHoliday && !dayCell.isTransferredDayOff)
      : true

    if (isWorkingDay) {
      if (!currentSegmentStart) {
        currentSegmentStart = day
      }
    } else {
      if (currentSegmentStart) {
        // End current segment
        const prevDay = new Date(day)
        prevDay.setDate(prevDay.getDate() - 1)
        segments.push({
          ...period,
          startDate: currentSegmentStart,
          endDate: prevDay,
        })
        currentSegmentStart = null
      }
    }
  }

  // Close last segment
  if (currentSegmentStart) {
    segments.push({
      ...period,
      startDate: currentSegmentStart,
      endDate: period.endDate,
    })
  }

  return segments.length > 0 ? segments : [period]
}
