/**
 * Timeline Row Calculations
 *
 * Вспомогательные функции для расчёта метрик в строках Timeline
 */

import { parseISO, differenceInDays } from 'date-fns'
import type {
  Section,
  DecompositionItem,
  WorkLog,
  ReadinessPoint,
} from '../../../types'

// ============================================================================
// Stage Readiness Calculation
// ============================================================================

export interface StageStats {
  /** Готовность в % (0-100) */
  readiness: number
  /** Плановые часы (сумма по всем items) */
  plannedHours: number
  /** Фактические часы (сумма work logs) */
  actualHours: number
  /** Есть ли данные для расчёта */
  hasData: boolean
}

/**
 * Рассчитывает готовность этапа на основе его задач
 * Формула: SUM(item.progress * item.plannedHours) / SUM(item.plannedHours)
 */
export function calculateStageReadiness(items: DecompositionItem[], workLogs?: WorkLog[]): StageStats {
  if (!items || items.length === 0) {
    return { readiness: 0, plannedHours: 0, actualHours: 0, hasData: false }
  }

  // Считаем плановые часы и взвешенный прогресс
  let totalWeightedProgress = 0
  let totalPlannedHours = 0

  for (const item of items) {
    if (item.plannedHours > 0) {
      const progress = item.progress ?? 0
      totalWeightedProgress += progress * item.plannedHours
      totalPlannedHours += item.plannedHours
    }
  }

  // Считаем фактические часы из work logs
  let totalActualHours = 0
  if (workLogs) {
    const itemIds = new Set(items.map(i => i.id))
    for (const log of workLogs) {
      if (itemIds.has(log.itemId)) {
        totalActualHours += log.hours
      }
    }
  }

  // Если нет плановых часов — возвращаем 0
  if (totalPlannedHours === 0) {
    return {
      readiness: 0,
      plannedHours: 0,
      actualHours: totalActualHours,
      hasData: false,
    }
  }

  // Взвешенное среднее
  const readiness = Math.round(totalWeightedProgress / totalPlannedHours)

  return {
    readiness,
    plannedHours: totalPlannedHours,
    actualHours: totalActualHours,
    hasData: true,
  }
}

// ============================================================================
// Object Aggregated Metrics
// ============================================================================

export interface AggregatedMetrics {
  plannedReadiness: ReadinessPoint[]
  actualReadiness: ReadinessPoint[]
  budgetSpending: { date: string; spent: number; percentage: number }[]
  totalPlannedHours: number
}

/**
 * Интерполирует плановую готовность раздела на конкретную дату
 * - До начала раздела: 0%
 * - После окончания раздела: 100%
 * - Между чекпоинтами: линейная интерполяция
 */
export function interpolateSectionPlan(section: Section, dateStr: string): number {
  const date = parseISO(dateStr)

  // Если нет дат раздела, возвращаем 0
  if (!section.startDate || !section.endDate) return 0

  const startDate = parseISO(section.startDate)
  const endDate = parseISO(section.endDate)

  // До начала раздела = 0%
  if (date < startDate) return 0

  // После окончания раздела = 100%
  if (date > endDate) return 100

  // Если есть чекпоинты, интерполируем между ними
  if (section.readinessCheckpoints.length > 0) {
    const sorted = [...section.readinessCheckpoints].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    )

    // Находим левый и правый чекпоинты для интерполяции
    let leftPoint: { date: string; value: number } | null = null
    let rightPoint: { date: string; value: number } | null = null

    for (const cp of sorted) {
      const cpDate = parseISO(cp.date)
      if (cpDate <= date) {
        leftPoint = cp
      }
      if (cpDate >= date && !rightPoint) {
        rightPoint = cp
      }
    }

    // Если точно на чекпоинте
    if (leftPoint && rightPoint && leftPoint.date === rightPoint.date) {
      return leftPoint.value
    }

    // Если до первого чекпоинта - интерполируем от 0% на startDate до первого чекпоинта
    if (!leftPoint && rightPoint) {
      const firstCpDate = parseISO(rightPoint.date)
      const totalDays = differenceInDays(firstCpDate, startDate)
      if (totalDays <= 0) return rightPoint.value
      const daysFromStart = differenceInDays(date, startDate)
      return (rightPoint.value * daysFromStart) / totalDays
    }

    // Если после последнего чекпоинта - интерполируем от последнего чекпоинта до 100% на endDate
    if (leftPoint && !rightPoint) {
      const lastCpDate = parseISO(leftPoint.date)
      const totalDays = differenceInDays(endDate, lastCpDate)
      if (totalDays <= 0) return 100
      const daysFromLast = differenceInDays(date, lastCpDate)
      return leftPoint.value + ((100 - leftPoint.value) * daysFromLast) / totalDays
    }

    // Между двумя чекпоинтами - линейная интерполяция
    if (leftPoint && rightPoint) {
      const leftDate = parseISO(leftPoint.date)
      const rightDate = parseISO(rightPoint.date)
      const totalDays = differenceInDays(rightDate, leftDate)
      if (totalDays <= 0) return leftPoint.value
      const daysFromLeft = differenceInDays(date, leftDate)
      return leftPoint.value + ((rightPoint.value - leftPoint.value) * daysFromLeft) / totalDays
    }
  }

  // Если нет чекпоинтов - линейная интерполяция от 0% до 100%
  const totalDays = differenceInDays(endDate, startDate)
  if (totalDays <= 0) return 100
  const daysFromStart = differenceInDays(date, startDate)
  return (100 * daysFromStart) / totalDays
}

/**
 * Агрегирует метрики из всех разделов объекта
 * Использует взвешенное среднее по плановым часам
 * План интерполируется для каждого дня и монотонно растёт от 0% до 100%
 */
export function aggregateSectionsMetrics(sections: Section[]): AggregatedMetrics | null {
  if (sections.length === 0) return null

  // Считаем плановые часы для каждого раздела (веса)
  const sectionWeights = new Map<string, number>()
  let totalPlannedHours = 0

  for (const section of sections) {
    let sectionHours = 0
    for (const stage of section.decompositionStages) {
      for (const item of stage.items) {
        sectionHours += item.plannedHours || 0
      }
    }
    sectionWeights.set(section.id, sectionHours)
    totalPlannedHours += sectionHours
  }

  // Если нет плановых часов, используем равные веса
  if (totalPlannedHours === 0) {
    const equalWeight = 1 / sections.length
    for (const section of sections) {
      sectionWeights.set(section.id, equalWeight)
    }
    totalPlannedHours = 1
  }

  // Определяем общий диапазон дат объекта
  let minDate: Date | null = null
  let maxDate: Date | null = null

  for (const section of sections) {
    if (section.startDate) {
      const start = parseISO(section.startDate)
      if (!minDate || start < minDate) minDate = start
    }
    if (section.endDate) {
      const end = parseISO(section.endDate)
      if (!maxDate || end > maxDate) maxDate = end
    }
  }

  if (!minDate || !maxDate) return null

  // Собираем ключевые даты для плановой готовности
  // (все чекпоинты + начало/конец каждого раздела)
  const planDates = new Set<string>()
  for (const section of sections) {
    if (section.startDate) planDates.add(section.startDate)
    if (section.endDate) planDates.add(section.endDate)
    section.readinessCheckpoints.forEach(p => planDates.add(p.date))
  }
  const sortedPlanDates = Array.from(planDates).sort()

  // Агрегируем плановую готовность с интерполяцией
  const plannedReadiness: ReadinessPoint[] = []
  for (const dateStr of sortedPlanDates) {
    let weightedSum = 0
    let totalWeight = 0

    for (const section of sections) {
      const weight = sectionWeights.get(section.id) || 0
      if (weight > 0) {
        const interpolatedValue = interpolateSectionPlan(section, dateStr)
        weightedSum += interpolatedValue * weight
        totalWeight += weight
      }
    }

    if (totalWeight > 0) {
      plannedReadiness.push({ date: dateStr, value: Math.round(weightedSum / totalWeight) })
    }
  }

  // Гарантируем монотонный рост плана (каждое следующее значение >= предыдущего)
  for (let i = 1; i < plannedReadiness.length; i++) {
    if (plannedReadiness[i].value < plannedReadiness[i - 1].value) {
      plannedReadiness[i].value = plannedReadiness[i - 1].value
    }
  }

  // Собираем даты для факта и бюджета
  const otherDates = new Set<string>()
  for (const section of sections) {
    section.actualReadiness.forEach(p => otherDates.add(p.date))
    section.budgetSpending.forEach(p => otherDates.add(p.date))
  }
  const sortedOtherDates = Array.from(otherDates).sort()

  // Агрегируем фактическую готовность
  const actualReadiness: ReadinessPoint[] = []
  for (const date of sortedOtherDates) {
    let weightedSum = 0
    let totalWeight = 0

    for (const section of sections) {
      const weight = sectionWeights.get(section.id) || 0
      const point = section.actualReadiness.find(p => p.date === date)
      if (point) {
        weightedSum += point.value * weight
        totalWeight += weight
      }
    }

    if (totalWeight > 0) {
      actualReadiness.push({ date, value: Math.round(weightedSum / totalWeight) })
    }
  }

  // Агрегируем бюджет (сумма расходов / сумма бюджетов)
  const budgetSpending: { date: string; spent: number; percentage: number }[] = []
  for (const date of sortedOtherDates) {
    let totalSpent = 0
    let totalBudgetLimit = 0
    let hasData = false

    for (const section of sections) {
      const point = section.budgetSpending.find(p => p.date === date)
      if (point) {
        totalSpent += point.spent
        // Восстанавливаем лимит из percentage: limit = spent * 100 / percentage
        if (point.percentage > 0) {
          totalBudgetLimit += (point.spent * 100) / point.percentage
        }
        hasData = true
      }
    }

    if (hasData) {
      const percentage = totalBudgetLimit > 0 ? (totalSpent / totalBudgetLimit) * 100 : 0
      budgetSpending.push({ date, spent: totalSpent, percentage: Math.round(percentage) })
    }
  }

  return {
    plannedReadiness,
    actualReadiness,
    budgetSpending,
    totalPlannedHours,
  }
}
