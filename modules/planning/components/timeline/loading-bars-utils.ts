/**
 * Утилиты для работы с полосками загрузок сотрудников
 */

import type { Loading, TimelineUnit } from "../../types"

/**
 * Интерфейс для периода (загрузка, отпуск, больничный или отгул)
 */
export interface BarPeriod {
  id: string
  type: "loading" | "vacation" | "sick_leave" | "time_off"
  startDate: Date
  endDate: Date
  rate: number
  projectId?: string
  projectName?: string
  sectionId?: string | null
  sectionName?: string
  stageId?: string
  stageName?: string
  loading?: Loading // Исходная загрузка для доступа к полным данным
}

/**
 * Интерфейс для отрисовки полоски
 */
export interface BarRender {
  period: BarPeriod
  startIdx: number
  endIdx: number
  left: number
  width: number
  layer: number // Слой для вертикального стакинга (0, 1, 2, ...)
  color: string
}

/**
 * Генерирует стабильный цвет на основе комбинации проекта и раздела
 */
export function getSectionColor(
  projectId: string | undefined,
  sectionId: string | null | undefined,
  stageId: string | undefined,
  isDark: boolean
): string {
  // Палитра цветов для загрузок (яркие, насыщенные цвета)
  const darkColors = [
    "rgb(59, 130, 246)",  // blue-500
    "rgb(34, 197, 94)",   // green-500
    "rgb(168, 85, 247)",  // purple-500
    "rgb(249, 115, 22)",  // orange-500
    "rgb(236, 72, 153)",  // pink-500
    "rgb(99, 102, 241)",  // indigo-500
    "rgb(20, 184, 166)",  // teal-500
    "rgb(234, 179, 8)",   // yellow-500
    "rgb(239, 68, 68)",   // red-500
    "rgb(14, 165, 233)",  // sky-500
  ]

  const lightColors = [
    "rgb(37, 99, 235)",   // blue-600
    "rgb(22, 163, 74)",   // green-600
    "rgb(147, 51, 234)",  // purple-600
    "rgb(234, 88, 12)",   // orange-600
    "rgb(219, 39, 119)",  // pink-600
    "rgb(79, 70, 229)",   // indigo-600
    "rgb(13, 148, 136)",  // teal-600
    "rgb(202, 138, 4)",   // yellow-600
    "rgb(220, 38, 38)",   // red-600
    "rgb(2, 132, 199)",   // sky-600
  ]

  const colors = isDark ? darkColors : lightColors

  // Определяем строку для хеширования по приоритету:
  // 1. projectId + sectionId (наивысший приоритет)
  // 2. sectionId
  // 3. projectId
  // 4. stageId (fallback для обратной совместимости)
  let hashString = ""

  if (projectId && sectionId) {
    // Комбинация проект + раздел (основной случай)
    hashString = `${projectId}-${sectionId}`
  } else if (sectionId) {
    // Только раздел
    hashString = sectionId
  } else if (projectId) {
    // Только проект
    hashString = projectId
  } else if (stageId) {
    // Fallback на этап
    hashString = stageId
  } else {
    // Если ничего нет, возвращаем первый цвет (синий)
    return colors[0]
  }

  // Простой хеш от строки
  let hash = 0
  for (let i = 0; i < hashString.length; i++) {
    hash = ((hash << 5) - hash) + hashString.charCodeAt(i)
    hash = hash & hash // Convert to 32bit integer
  }

  const index = Math.abs(hash) % colors.length
  return colors[index]
}

/**
 * @deprecated Используйте getSectionColor вместо этой функции
 * Оставлено для обратной совместимости
 */
export function getStageColor(stageId: string | undefined, isDark: boolean): string {
  return getSectionColor(undefined, undefined, stageId, isDark)
}

/**
 * Цвет для отпусков
 */
export function getVacationColor(isDark: boolean): string {
  return isDark ? "rgb(100, 116, 139)" : "rgb(148, 163, 184)" // slate-500 / slate-400
}

/**
 * Цвет для больничных
 */
export function getSickLeaveColor(isDark: boolean): string {
  return isDark ? "rgb(100, 116, 139)" : "rgb(148, 163, 184)" // slate-500 / slate-400 
}

/**
 * Цвет для отгулов
 */
export function getTimeOffColor(isDark: boolean): string {
  return isDark ? "rgb(100, 116, 139)" : "rgb(148, 163, 184)" // slate-500 / slate-400 
}

/**
 * Проверяет, пересекаются ли два периода
 */
function periodsOverlap(period1: BarPeriod, period2: BarPeriod): boolean {
  const start1 = new Date(period1.startDate).getTime()
  const end1 = new Date(period1.endDate).getTime()
  const start2 = new Date(period2.startDate).getTime()
  const end2 = new Date(period2.endDate).getTime()

  return start1 <= end2 && start2 <= end1
}

/**
 * Находит первый свободный слой для размещения периода с учетом перекрытий
 */
function findFreeLayer(period: BarPeriod, placedPeriods: Array<{ period: BarPeriod; layer: number }>): number {
  const occupiedLayers = new Set<number>()

  // Проверяем все уже размещенные периоды
  for (const placed of placedPeriods) {
    if (periodsOverlap(period, placed.period)) {
      occupiedLayers.add(placed.layer)
    }
  }

  // Находим первый свободный слой
  let layer = 0
  while (occupiedLayers.has(layer)) {
    layer++
  }

  return layer
}

/**
 * Вычисляет слои для всех периодов с учетом перекрытий
 */
export function calculateLayers(periods: BarPeriod[]): number[] {
  const layers: number[] = []
  const placedPeriods: Array<{ period: BarPeriod; layer: number }> = []

  // Сортируем периоды по дате начала
  const sortedIndices = periods
    .map((period, index) => ({ period, index }))
    .sort((a, b) => new Date(a.period.startDate).getTime() - new Date(b.period.startDate).getTime())

  // Для каждого периода находим свободный слой
  for (const { period, index } of sortedIndices) {
    const layer = findFreeLayer(period, placedPeriods)
    layers[index] = layer
    placedPeriods.push({ period, layer })
  }

  return layers
}

/**
 * Группирует последовательные даты отпусков в периоды
 */
export function groupVacationPeriods(vacationsDaily: Record<string, number> | undefined): BarPeriod[] {
  if (!vacationsDaily) return []

  // Сортируем даты
  const dates = Object.keys(vacationsDaily)
    .filter((dateKey) => vacationsDaily[dateKey] > 0)
    .sort()

  if (dates.length === 0) return []

  const periods: BarPeriod[] = []
  let currentStart = new Date(dates[0])
  let currentEnd = new Date(dates[0])

  for (let i = 1; i < dates.length; i++) {
    const currentDate = new Date(dates[i])
    const prevDate = new Date(dates[i - 1])

    // Проверяем, является ли текущая дата последовательной (следующий день)
    const dayDiff = Math.round((currentDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24))

    if (dayDiff === 1) {
      // Продолжаем текущий период
      currentEnd = currentDate
    } else {
      // Сохраняем текущий период и начинаем новый
      periods.push({
        id: `vacation-${currentStart.toISOString()}-${currentEnd.toISOString()}`,
        type: "vacation",
        startDate: currentStart,
        endDate: currentEnd,
        rate: 1,
      })
      currentStart = currentDate
      currentEnd = currentDate
    }
  }

  // Добавляем последний период
  periods.push({
    id: `vacation-${currentStart.toISOString()}-${currentEnd.toISOString()}`,
    type: "vacation",
    startDate: currentStart,
    endDate: currentEnd,
    rate: 1,
  })

  return periods
}

/**
 * Группирует последовательные даты больничных в периоды
 */
export function groupSickLeavePeriods(sickLeavesDaily: Record<string, number> | undefined): BarPeriod[] {
  if (!sickLeavesDaily) return []

  // Сортируем даты
  const dates = Object.keys(sickLeavesDaily)
    .filter((dateKey) => sickLeavesDaily[dateKey] > 0)
    .sort()

  if (dates.length === 0) return []

  const periods: BarPeriod[] = []
  let currentStart = new Date(dates[0])
  let currentEnd = new Date(dates[0])

  for (let i = 1; i < dates.length; i++) {
    const currentDate = new Date(dates[i])
    const prevDate = new Date(dates[i - 1])

    // Проверяем, является ли текущая дата последовательной (следующий день)
    const dayDiff = Math.round((currentDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24))

    if (dayDiff === 1) {
      // Продолжаем текущий период
      currentEnd = currentDate
    } else {
      // Сохраняем текущий период и начинаем новый
      periods.push({
        id: `sick-leave-${currentStart.toISOString()}-${currentEnd.toISOString()}`,
        type: "sick_leave",
        startDate: currentStart,
        endDate: currentEnd,
        rate: 1,
      })
      currentStart = currentDate
      currentEnd = currentDate
    }
  }

  // Добавляем последний период
  periods.push({
    id: `sick-leave-${currentStart.toISOString()}-${currentEnd.toISOString()}`,
    type: "sick_leave",
    startDate: currentStart,
    endDate: currentEnd,
    rate: 1,
  })

  return periods
}

/**
 * Группирует последовательные даты отгулов в периоды
 */
export function groupTimeOffPeriods(timeOffsDaily: Record<string, number> | undefined): BarPeriod[] {
  if (!timeOffsDaily) return []

  // Сортируем даты
  const dates = Object.keys(timeOffsDaily)
    .filter((dateKey) => timeOffsDaily[dateKey] > 0)
    .sort()

  if (dates.length === 0) return []

  const periods: BarPeriod[] = []
  let currentStart = new Date(dates[0])
  let currentEnd = new Date(dates[0])

  for (let i = 1; i < dates.length; i++) {
    const currentDate = new Date(dates[i])
    const prevDate = new Date(dates[i - 1])

    // Проверяем, является ли текущая дата последовательной (следующий день)
    const dayDiff = Math.round((currentDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24))

    if (dayDiff === 1) {
      // Продолжаем текущий период
      currentEnd = currentDate
    } else {
      // Сохраняем текущий период и начинаем новый
      periods.push({
        id: `time-off-${currentStart.toISOString()}-${currentEnd.toISOString()}`,
        type: "time_off",
        startDate: currentStart,
        endDate: currentEnd,
        rate: 1,
      })
      currentStart = currentDate
      currentEnd = currentDate
    }
  }

  // Добавляем последний период
  periods.push({
    id: `time-off-${currentStart.toISOString()}-${currentEnd.toISOString()}`,
    type: "time_off",
    startDate: currentStart,
    endDate: currentEnd,
    rate: 1,
  })

  return periods
}

/**
 * Нормализует дату (обнуляет время)
 */
function normalizeDate(date: Date): Date {
  const normalized = new Date(date)
  normalized.setHours(0, 0, 0, 0)
  return normalized
}

/**
 * Проверяет, совпадают ли две даты (игнорируя время)
 */
function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  )
}

/**
 * Преобразует загрузки сотрудника в периоды для отрисовки
 */
export function loadingsToPeriods(loadings: Loading[] | undefined): BarPeriod[] {
  if (!loadings || loadings.length === 0) return []

  return loadings.map((loading) => ({
    id: loading.id,
    type: "loading",
    startDate: new Date(loading.startDate),
    endDate: new Date(loading.endDate),
    rate: loading.rate || 1,
    projectId: loading.projectId,
    projectName: loading.projectName,
    sectionId: loading.sectionId,
    sectionName: loading.sectionName,
    stageId: loading.stageId,
    stageName: loading.stageName,
    loading,
  }))
}

/**
 * Разбивает период на сегменты рабочих дней, исключая нерабочие дни (выходные и праздники)
 * Возвращает массив сегментов [startIdx, endIdx]
 */
function splitPeriodByWorkingDays(
  startIdx: number,
  endIdx: number,
  timeUnits: TimelineUnit[]
): Array<{ startIdx: number; endIdx: number }> {
  const segments: Array<{ startIdx: number; endIdx: number }> = []
  let segmentStart: number | null = null

  for (let i = startIdx; i <= endIdx; i++) {
    const unit = timeUnits[i]
    const isWorking = unit.isWorkingDay ?? !unit.isWeekend // Используем isWorkingDay если есть, иначе проверяем isWeekend

    if (isWorking) {
      // Начинаем новый сегмент или продолжаем текущий
      if (segmentStart === null) {
        segmentStart = i
      }
    } else {
      // Нерабочий день - завершаем текущий сегмент если он был
      if (segmentStart !== null) {
        segments.push({ startIdx: segmentStart, endIdx: i - 1 })
        segmentStart = null
      }
    }
  }

  // Завершаем последний сегмент если он был
  if (segmentStart !== null) {
    segments.push({ startIdx: segmentStart, endIdx })
  }

  return segments
}

/**
 * Вычисляет параметры отрисовки для всех периодов
 * Разбивает загрузки на сегменты, исключая нерабочие дни (выходные и праздники)
 */
export function calculateBarRenders(
  periods: BarPeriod[],
  timeUnits: TimelineUnit[],
  cellWidth: number, // Deprecated: используется только для обратной совместимости
  isDark: boolean
): BarRender[] {
  if (periods.length === 0) return []

  // Горизонтальный отступ между соседними полосками (в пикселях)
  const HORIZONTAL_GAP = 3

  // Вычисляем слои для стакинга
  const layers = calculateLayers(periods)

  const renders: BarRender[] = []

  for (let i = 0; i < periods.length; i++) {
    const period = periods[i]
    const layer = layers[i]

    // Находим индексы начальной и конечной даты в timeUnits
    const startDate = normalizeDate(period.startDate)
    const endDate = normalizeDate(period.endDate)

    const startIdx = timeUnits.findIndex((unit) => isSameDay(normalizeDate(unit.date), startDate))
    const endIdx = timeUnits.findIndex((unit) => isSameDay(normalizeDate(unit.date), endDate))

    // Если период не попадает в видимый диапазон, пропускаем
    if (startIdx === -1 && endIdx === -1) continue

    // Если начало или конец выходят за границы, обрезаем
    const actualStartIdx = Math.max(0, startIdx === -1 ? 0 : startIdx)
    const actualEndIdx = Math.min(timeUnits.length - 1, endIdx === -1 ? timeUnits.length - 1 : endIdx)

    // Определяем цвет на основе типа периода
    let color: string
    if (period.type === "vacation") {
      color = getVacationColor(isDark)
    } else if (period.type === "sick_leave") {
      color = getSickLeaveColor(isDark)
    } else if (period.type === "time_off") {
      color = getTimeOffColor(isDark)
    } else {
      // loading
      color = getSectionColor(period.projectId, period.sectionId, period.stageId, isDark)
    }

    // Для загрузок (type="loading") разбиваем на сегменты по рабочим дням
    // Для отпусков, больничных и отгулов оставляем сплошным
    if (period.type === "loading") {
      const segments = splitPeriodByWorkingDays(actualStartIdx, actualEndIdx, timeUnits)

      // Создаем отдельный рендер для каждого сегмента
      for (const segment of segments) {
        // Используем позиции из timeUnits если доступны, иначе старый метод
        const left = (timeUnits[segment.startIdx]?.left ?? segment.startIdx * cellWidth) + HORIZONTAL_GAP / 2

        // Вычисляем ширину сегмента суммированием ширин всех ячеек
        let width = 0
        for (let idx = segment.startIdx; idx <= segment.endIdx; idx++) {
          width += timeUnits[idx]?.width ?? cellWidth
        }
        width -= HORIZONTAL_GAP

        renders.push({
          period,
          startIdx: segment.startIdx,
          endIdx: segment.endIdx,
          left,
          width,
          layer,
          color,
        })
      }
    } else {
      // Для отпусков, больничных и отгулов создаем один сплошной бар
      const left = (timeUnits[actualStartIdx]?.left ?? actualStartIdx * cellWidth) + HORIZONTAL_GAP / 2

      // Вычисляем ширину суммированием ширин всех ячеек
      let width = 0
      for (let idx = actualStartIdx; idx <= actualEndIdx; idx++) {
        width += timeUnits[idx]?.width ?? cellWidth
      }
      width -= HORIZONTAL_GAP

      renders.push({
        period,
        startIdx: actualStartIdx,
        endIdx: actualEndIdx,
        left,
        width,
        layer,
        color,
      })
    }
  }

  return renders
}

/**
 * Вычисляет максимальное количество слоев (для определения высоты строки)
 */
export function getMaxLayers(periods: BarPeriod[]): number {
  if (periods.length === 0) return 0
  const layers = calculateLayers(periods)
  return Math.max(...layers) + 1
}

/**
 * Форматирует текст для отображения на полоске
 */
export function formatBarLabel(period: BarPeriod): string {
  if (period.type === "vacation") {
    return "Отпуск"
  }
  if (period.type === "sick_leave") {
    return "Больничный"
  }
  if (period.type === "time_off") {
    return "Отгул"
  }

  const parts: string[] = []
  if (period.stageName) parts.push(period.stageName)
  if (period.sectionName) parts.push(period.sectionName)
  if (period.projectName) parts.push(period.projectName)

  return parts.join(" • ") || "Загрузка"
}

/**
 * Адаптивное форматирование текста в зависимости от ширины бара
 */
export interface BarLabelParts {
  project?: string
  section?: string
  stage?: string
  displayMode: 'full' | 'compact' | 'minimal' | 'icon-only'
}

export function getBarLabelParts(period: BarPeriod, barWidth: number): BarLabelParts {
  if (period.type !== "loading") {
    return { displayMode: 'full' }
  }

  // Определяем режим отображения на основе ширины
  // Примерные пороги в пикселях (понижены т.к. бары разбиваются на сегменты выходными)
  const THRESHOLD_FULL = 120      // Полное отображение всех частей (~3 дня при 40px/день)
  const THRESHOLD_COMPACT = 70    // Компактное: только важные части (~2 дня)
  const THRESHOLD_MINIMAL = 35    // Минимальное: только этап или раздел (~1 день)
  // < 35 - только иконка

  let displayMode: BarLabelParts['displayMode'] = 'icon-only'

  if (barWidth >= THRESHOLD_FULL) {
    displayMode = 'full'
  } else if (barWidth >= THRESHOLD_COMPACT) {
    displayMode = 'compact'
  } else if (barWidth >= THRESHOLD_MINIMAL) {
    displayMode = 'minimal'
  }

  return {
    project: period.projectName,
    section: period.sectionName,
    stage: period.stageName,
    displayMode
  }
}

/**
 * Форматирует дату в формате ДД.ММ.ГГГГ
 */
function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date)
}

/**
 * Форматирует tooltip для полоски
 */
export function formatBarTooltip(period: BarPeriod): string {
  if (period.type === "vacation") {
    return `Отпуск\nПериод: ${formatDate(period.startDate)} — ${formatDate(period.endDate)}`
  }
  if (period.type === "sick_leave") {
    return `Больничный\nПериод: ${formatDate(period.startDate)} — ${formatDate(period.endDate)}`
  }
  if (period.type === "time_off") {
    return `Отгул\nПериод: ${formatDate(period.startDate)} — ${formatDate(period.endDate)}`
  }

  const lines: string[] = []
  if (period.projectName) lines.push(`Проект: ${period.projectName}`)
  if (period.sectionName) lines.push(`Раздел: ${period.sectionName}`)
  if (period.stageName) lines.push(`Этап: ${period.stageName}`)
  lines.push(`Период: ${formatDate(period.startDate)} — ${formatDate(period.endDate)}`)
  lines.push(`Ставка: ${period.rate}`)

  return lines.join("\n")
}
