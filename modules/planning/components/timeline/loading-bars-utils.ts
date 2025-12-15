/**
 * Утилиты для работы с полосками загрузок сотрудников
 */

import type { Loading, TimelineUnit } from "../../types"

/**
 * Константы для расчёта высоты и позиционирования полосок загрузки
 */
export const BASE_BAR_HEIGHT = 140 // Базовая высота полоски для ставки 1.0
export const BAR_GAP = 3 // Минимальное расстояние между полосками при стакинге

/**
 * Интерфейс для периода загрузки
 */
export interface BarPeriod {
  id: string
  type: "loading"
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
 * Интерфейс для периода загрузки в контексте раздела (чипы с командой и сотрудником)
 */
export interface SectionLoadingPeriod {
  id: string
  type: "section_loading"
  startDate: Date
  endDate: Date
  rate: number
  // Данные сотрудника
  responsibleId: string
  responsibleName: string
  responsibleTeamId?: string
  responsibleTeamName: string
  responsibleAvatarUrl?: string
  // Данные этапа
  stageId: string
  stageName?: string
  // Исходные загрузки (может быть несколько при объединении)
  loadings: Loading[]
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
 * Вычисляет вертикальную позицию (top) бара с учётом пересекающихся баров в нижних слоях.
 * Используется для корректного вертикального размещения баров при их наложении по времени.
 *
 * @param bar - текущий бар, для которого вычисляется позиция
 * @param allBars - все бары для проверки пересечений
 * @param baseBarHeight - базовая высота бара (для ставки 1)
 * @param barGap - отступ между барами
 * @param initialOffset - начальный отступ сверху (по умолчанию 4)
 * @returns вертикальная позиция top в пикселях
 */
export function calculateBarTop(
  bar: BarRender,
  allBars: BarRender[],
  baseBarHeight: number,
  barGap: number,
  initialOffset: number = 4
): number {
  // Находим все бары, которые пересекаются с текущим и имеют меньший layer
  const overlappingBars = allBars.filter(other =>
    other.period.startDate <= bar.period.endDate &&
    other.period.endDate >= bar.period.startDate &&
    other.layer < bar.layer
  )

  let top = initialOffset

  if (overlappingBars.length > 0) {
    // Создаём карту слой -> максимальная высота бара в этом слое
    const layersMap = new Map<number, number>()
    overlappingBars.forEach(other => {
      const otherHeight = baseBarHeight * (other.period.rate || 1)
      layersMap.set(other.layer, Math.max(layersMap.get(other.layer) || 0, otherHeight))
    })

    // Суммируем высоты всех слоёв ниже текущего
    for (let i = 0; i < bar.layer; i++) {
      if (layersMap.has(i)) {
        top += layersMap.get(i)! + barGap
      }
    }
  }

  return top
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
 * Разбивает период на сегменты нерабочих дней (выходные и праздники)
 * Возвращает массив сегментов [startIdx, endIdx]
 * Инверсия функции splitPeriodByWorkingDays()
 */
export function splitPeriodByNonWorkingDays(
  startIdx: number,
  endIdx: number,
  timeUnits: TimelineUnit[]
): Array<{ startIdx: number; endIdx: number }> {
  const segments: Array<{ startIdx: number; endIdx: number }> = []
  let segmentStart: number | null = null

  for (let i = startIdx; i <= endIdx; i++) {
    const unit = timeUnits[i]
    const isWorking = unit.isWorkingDay ?? !unit.isWeekend

    if (!isWorking) {
      // Нерабочий день - начинаем новый сегмент или продолжаем текущий
      if (segmentStart === null) {
        segmentStart = i
      }
    } else {
      // Рабочий день - завершаем текущий сегмент если он был
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

    // Получаем границы видимого диапазона
    const timelineStart = normalizeDate(timeUnits[0].date)
    const timelineEnd = normalizeDate(timeUnits[timeUnits.length - 1].date)

    // Проверяем, пересекается ли период с видимым диапазоном
    // Период виден, если: startDate <= timelineEnd AND endDate >= timelineStart
    const isVisible = startDate <= timelineEnd && endDate >= timelineStart
    if (!isVisible) continue

    const startIdx = timeUnits.findIndex((unit) => isSameDay(normalizeDate(unit.date), startDate))
    const endIdx = timeUnits.findIndex((unit) => isSameDay(normalizeDate(unit.date), endDate))

    // Если дата за пределами видимого диапазона - используем границы
    const actualStartIdx = startIdx === -1
      ? (startDate < timelineStart ? 0 : timeUnits.length - 1)
      : startIdx
    const actualEndIdx = endIdx === -1
      ? (endDate > timelineEnd ? timeUnits.length - 1 : 0)
      : endIdx

    // Определяем цвет на основе типа периода
    const color = getSectionColor(period.projectId, period.sectionId, period.stageId, isDark)

    // Создаем один непрерывный бар от начала до конца (включая нерабочие дни)
    const left = (timeUnits[actualStartIdx]?.left ?? actualStartIdx * cellWidth) + HORIZONTAL_GAP / 2

    // Вычисляем ширину всего периода суммированием ширин всех ячеек
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

// Кэшированные форматтеры дат для оптимизации
const dateFormatterFull = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
})

const dateFormatterShort = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
})

/**
 * Форматирует дату в формате ДД.ММ.ГГГГ
 */
function formatDate(date: Date): string {
  return dateFormatterFull.format(date)
}

/**
 * Форматирует tooltip для полоски
 */
export function formatBarTooltip(period: BarPeriod): string {
  const lines: string[] = []
  if (period.projectName) lines.push(`Проект: ${period.projectName}`)
  if (period.sectionName) lines.push(`Раздел: ${period.sectionName}`)
  if (period.stageName) lines.push(`Этап: ${period.stageName}`)
  lines.push(`Период: ${formatDate(period.startDate)} — ${formatDate(period.endDate)}`)
  lines.push(`Ставка: ${period.rate}`)

  return lines.join("\n")
}

// =====================================================
// Функции для чипов загрузок в строке раздела
// =====================================================

/**
 * Генерирует стабильный цвет на основе команды
 */
export function getTeamColor(teamName: string | undefined, isDark: boolean): string {
  // Палитра цветов для команд
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

  if (!teamName) {
    return colors[0]
  }

  // Простой хеш от названия команды
  let hash = 0
  for (let i = 0; i < teamName.length; i++) {
    hash = ((hash << 5) - hash) + teamName.charCodeAt(i)
    hash = hash & hash
  }

  const index = Math.abs(hash) % colors.length
  return colors[index]
}

/**
 * Проверяет, являются ли две даты смежными (разница 1 день)
 */
function areDatesAdjacent(date1: Date, date2: Date): boolean {
  const d1 = new Date(date1)
  const d2 = new Date(date2)
  d1.setHours(0, 0, 0, 0)
  d2.setHours(0, 0, 0, 0)
  const diffMs = Math.abs(d2.getTime() - d1.getTime())
  const diffDays = diffMs / (1000 * 60 * 60 * 24)
  return diffDays === 1
}

/**
 * Преобразует загрузки раздела в периоды для отрисовки чипов.
 * Объединяет смежные периоды одного сотрудника.
 */
export function sectionLoadingsToPeriods(loadings: Loading[]): SectionLoadingPeriod[] {
  if (!loadings || loadings.length === 0) return []

  // Группируем загрузки по сотруднику
  const byEmployee = new Map<string, Loading[]>()

  for (const loading of loadings) {
    const key = loading.responsibleId || loading.employeeId || 'unknown'
    if (!byEmployee.has(key)) {
      byEmployee.set(key, [])
    }
    byEmployee.get(key)!.push(loading)
  }

  const periods: SectionLoadingPeriod[] = []

  // Для каждого сотрудника объединяем смежные периоды
  for (const [employeeId, employeeLoadings] of byEmployee) {
    // Сортируем по дате начала
    const sorted = [...employeeLoadings].sort(
      (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
    )

    let currentPeriod: SectionLoadingPeriod | null = null

    for (const loading of sorted) {
      const loadingStart = new Date(loading.startDate)
      const loadingEnd = new Date(loading.endDate)

      if (currentPeriod === null) {
        // Начинаем новый период
        currentPeriod = {
          id: loading.id,
          type: "section_loading",
          startDate: loadingStart,
          endDate: loadingEnd,
          rate: loading.rate || 1,
          responsibleId: loading.responsibleId || loading.employeeId || 'unknown',
          responsibleName: loading.responsibleName || 'Не указан',
          responsibleTeamName: loading.responsibleTeamName || 'Без команды',
          responsibleAvatarUrl: loading.responsibleAvatarUrl,
          stageId: loading.stageId,
          stageName: loading.stageName,
          loadings: [loading],
        }
      } else {
        // Проверяем, можно ли объединить с текущим периодом
        // Условие: даты смежные или перекрываются, и ставка совпадает
        const canMerge =
          (areDatesAdjacent(currentPeriod.endDate, loadingStart) ||
           loadingStart <= currentPeriod.endDate) &&
          loading.rate === currentPeriod.rate

        if (canMerge) {
          // Объединяем: расширяем период
          currentPeriod.endDate = new Date(Math.max(
            currentPeriod.endDate.getTime(),
            loadingEnd.getTime()
          ))
          currentPeriod.loadings.push(loading)
          // Обновляем id для уникальности
          currentPeriod.id = `merged-${currentPeriod.loadings.map(l => l.id).join('-')}`
        } else {
          // Не можем объединить — сохраняем текущий и начинаем новый
          periods.push(currentPeriod)
          currentPeriod = {
            id: loading.id,
            type: "section_loading",
            startDate: loadingStart,
            endDate: loadingEnd,
            rate: loading.rate || 1,
            responsibleId: loading.responsibleId || loading.employeeId || 'unknown',
            responsibleName: loading.responsibleName || 'Не указан',
            responsibleTeamName: loading.responsibleTeamName || 'Без команды',
            responsibleAvatarUrl: loading.responsibleAvatarUrl,
            stageId: loading.stageId,
            stageName: loading.stageName,
            loadings: [loading],
          }
        }
      }
    }

    // Добавляем последний период
    if (currentPeriod) {
      periods.push(currentPeriod)
    }
  }

  return periods
}

/**
 * Интерфейс для адаптивного отображения чипа сотрудника
 */
export interface SectionLoadingLabelParts {
  teamName?: string
  employeeName?: string
  displayMode: 'full' | 'compact' | 'minimal' | 'icon-only'
}

/**
 * Адаптивное форматирование текста чипа сотрудника в зависимости от ширины бара
 */
export function getSectionLoadingLabelParts(
  period: SectionLoadingPeriod,
  barWidth: number
): SectionLoadingLabelParts {
  // Пороги ширины
  const THRESHOLD_FULL = 140      // Полное: команда + имя
  const THRESHOLD_COMPACT = 80    // Компактное: команда или имя
  const THRESHOLD_MINIMAL = 40    // Минимальное: только инициалы или короткое имя
  // < 40 - только иконка

  let displayMode: SectionLoadingLabelParts['displayMode'] = 'icon-only'

  if (barWidth >= THRESHOLD_FULL) {
    displayMode = 'full'
  } else if (barWidth >= THRESHOLD_COMPACT) {
    displayMode = 'compact'
  } else if (barWidth >= THRESHOLD_MINIMAL) {
    displayMode = 'minimal'
  }

  return {
    teamName: period.responsibleTeamName,
    employeeName: period.responsibleName,
    displayMode,
  }
}

/**
 * Форматирует tooltip для чипа сотрудника в разделе
 */
export function formatSectionLoadingTooltip(period: SectionLoadingPeriod): string {
  const lines: string[] = []
  lines.push(`Сотрудник: ${period.responsibleName}`)
  lines.push(`Команда: ${period.responsibleTeamName}`)
  if (period.stageName) lines.push(`Этап: ${period.stageName}`)
  lines.push(`Период: ${formatDate(period.startDate)} — ${formatDate(period.endDate)}`)
  lines.push(`Ставка: ${period.rate}`)
  if (period.loadings.length > 1) {
    lines.push(`(объединено ${period.loadings.length} загрузок)`)
  }
  return lines.join("\n")
}

/**
 * Вычисляет параметры отрисовки для периодов загрузок раздела (чипы сотрудников)
 */
export function calculateSectionBarRenders(
  periods: SectionLoadingPeriod[],
  timeUnits: TimelineUnit[],
  cellWidth: number,
  isDark: boolean
): BarRender[] {
  if (periods.length === 0) return []

  const HORIZONTAL_GAP = 3

  // Преобразуем SectionLoadingPeriod в BarPeriod для использования общих функций
  const barPeriods: BarPeriod[] = periods.map(p => ({
    id: p.id,
    type: "loading" as const,
    startDate: p.startDate,
    endDate: p.endDate,
    rate: p.rate,
    stageId: p.stageId,
    stageName: p.stageName,
  }))

  // Вычисляем слои
  const layers = calculateLayers(barPeriods)

  const renders: BarRender[] = []

  for (let i = 0; i < periods.length; i++) {
    const period = periods[i]
    const layer = layers[i]

    const startDate = normalizeDate(period.startDate)
    const endDate = normalizeDate(period.endDate)

    const timelineStart = normalizeDate(timeUnits[0].date)
    const timelineEnd = normalizeDate(timeUnits[timeUnits.length - 1].date)

    const isVisible = startDate <= timelineEnd && endDate >= timelineStart
    if (!isVisible) continue

    const startIdx = timeUnits.findIndex((unit) => isSameDay(normalizeDate(unit.date), startDate))
    const endIdx = timeUnits.findIndex((unit) => isSameDay(normalizeDate(unit.date), endDate))

    const actualStartIdx = startIdx === -1
      ? (startDate < timelineStart ? 0 : timeUnits.length - 1)
      : startIdx
    const actualEndIdx = endIdx === -1
      ? (endDate > timelineEnd ? timeUnits.length - 1 : 0)
      : endIdx

    // Цвет по команде
    const color = getTeamColor(period.responsibleTeamName, isDark)

    // НЕ разбиваем на сегменты по рабочим дням - показываем сплошную полосу
    const left = (timeUnits[actualStartIdx]?.left ?? actualStartIdx * cellWidth) + HORIZONTAL_GAP / 2

    let width = 0
    for (let idx = actualStartIdx; idx <= actualEndIdx; idx++) {
      width += timeUnits[idx]?.width ?? cellWidth
    }
    width -= HORIZONTAL_GAP

    // Создаём BarRender с дополнительными данными в period
    renders.push({
      period: {
        ...barPeriods[i],
        // Добавляем данные сотрудника для отображения
        loading: period.loadings[0],
      },
      startIdx: actualStartIdx,
      endIdx: actualEndIdx,
      left,
      width,
      layer,
      color,
    })
  }

  return renders
}

// =====================================================
// Функции для линий команд на уровне объекта
// =====================================================

/**
 * Интерфейс для периода работы команды на объекте
 */
export interface ObjectTeamPeriod {
  id: string
  teamId: string
  teamName: string
  startDate: Date
  endDate: Date
  totalRate: number // Суммарная ставка команды за период
  employeeCount: number // Количество сотрудников команды
  loadings: Loading[]
}

/**
 * Агрегирует загрузки по командам для объекта.
 * Объединяет пересекающиеся и смежные периоды одной команды.
 * @param sections - массив разделов объекта
 * @param loadingsMap - карта загрузок по ID раздела (опционально, если loadings уже в sections)
 */
export function aggregateLoadingsByTeam(
  sections: Array<{ id?: string; loadings?: Loading[] }>,
  loadingsMap?: Record<string, Loading[]>
): ObjectTeamPeriod[] {
  // Собираем все загрузки из всех разделов объекта
  const allLoadings: Loading[] = []
  for (const section of sections) {
    // Сначала пробуем взять из loadingsMap, потом из section.loadings
    const sectionLoadings = (loadingsMap && section.id ? loadingsMap[section.id] : null) || section.loadings || []
    if (sectionLoadings.length > 0) {
      allLoadings.push(...sectionLoadings)
    }
  }

  if (allLoadings.length === 0) return []

  // Группируем по команде
  const byTeam = new Map<string, Loading[]>()
  for (const loading of allLoadings) {
    const teamKey = loading.responsibleTeamName || 'Без команды'
    if (!byTeam.has(teamKey)) {
      byTeam.set(teamKey, [])
    }
    byTeam.get(teamKey)!.push(loading)
  }

  const periods: ObjectTeamPeriod[] = []

  // Для каждой команды объединяем пересекающиеся периоды
  for (const [teamName, teamLoadings] of byTeam) {
    // Сортируем по дате начала
    const sorted = [...teamLoadings].sort(
      (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
    )

    // Объединяем пересекающиеся/смежные периоды
    let currentPeriod: ObjectTeamPeriod | null = null

    for (const loading of sorted) {
      // Гарантируем корректную конвертацию дат (могут быть строками)
      const loadingStart = loading.startDate instanceof Date
        ? new Date(loading.startDate)
        : new Date(String(loading.startDate))
      const loadingEnd = loading.endDate instanceof Date
        ? new Date(loading.endDate)
        : new Date(String(loading.endDate))

      loadingStart.setHours(0, 0, 0, 0)
      loadingEnd.setHours(23, 59, 59, 999)

      if (currentPeriod === null) {
        currentPeriod = {
          id: `team-${teamName}-${loading.id}`,
          teamId: teamName, // Используем teamName как ID, т.к. responsibleTeamId не всегда доступен
          teamName,
          startDate: loadingStart,
          endDate: loadingEnd,
          totalRate: loading.rate || 1,
          employeeCount: 1,
          loadings: [loading],
        }
      } else {
        // Проверяем пересечение или смежность (с запасом в 1 день)
        const currentEndPlusOne = new Date(currentPeriod.endDate)
        currentEndPlusOne.setDate(currentEndPlusOne.getDate() + 1)

        if (loadingStart <= currentEndPlusOne) {
          // Объединяем: расширяем период
          currentPeriod.endDate = new Date(Math.max(
            currentPeriod.endDate.getTime(),
            loadingEnd.getTime()
          ))
          currentPeriod.totalRate += loading.rate || 1
          // Считаем уникальных сотрудников
          const existingEmployees = new Set(currentPeriod.loadings.map(l => l.responsibleId || l.employeeId))
          if (!existingEmployees.has(loading.responsibleId || loading.employeeId)) {
            currentPeriod.employeeCount++
          }
          currentPeriod.loadings.push(loading)
          currentPeriod.id = `team-${teamName}-merged-${currentPeriod.loadings.length}`
        } else {
          // Не пересекаются — сохраняем текущий и начинаем новый
          periods.push(currentPeriod)
          currentPeriod = {
            id: `team-${teamName}-${loading.id}`,
            teamId: teamName, // Используем teamName как ID
            teamName,
            startDate: loadingStart,
            endDate: loadingEnd,
            totalRate: loading.rate || 1,
            employeeCount: 1,
            loadings: [loading],
          }
        }
      }
    }

    // Добавляем последний период
    if (currentPeriod) {
      periods.push(currentPeriod)
    }
  }

  // Сортируем периоды по дате начала для консистентного отображения
  periods.sort((a, b) => a.startDate.getTime() - b.startDate.getTime())

  return periods
}

/**
 * Форматирует tooltip для линии команды
 */
export function formatObjectTeamTooltip(period: ObjectTeamPeriod): string {
  const lines: string[] = []
  lines.push(`Команда: ${period.teamName}`)
  lines.push(`Сотрудников: ${period.employeeCount}`)
  lines.push(`Суммарная ставка: ${period.totalRate}`)
  lines.push(`Период: ${formatDateShort(period.startDate)} — ${formatDateShort(period.endDate)}`)
  return lines.join("\n")
}

/**
 * Форматирует дату в коротком формате ДД.ММ
 */
function formatDateShort(date: Date): string {
  return dateFormatterShort.format(date)
}

/**
 * Вычисляет параметры отрисовки для линий команд (без разбиения по выходным)
 */
export function calculateObjectTeamBarRenders(
  periods: ObjectTeamPeriod[],
  timeUnits: TimelineUnit[],
  cellWidth: number,
  isDark: boolean
): Array<{
  period: ObjectTeamPeriod
  left: number
  width: number
  layer: number
  color: string
}> {
  if (periods.length === 0 || timeUnits.length === 0) return []

  const HORIZONTAL_GAP = 2

  // Группируем периоды по команде для назначения слоёв
  const teamLayers = new Map<string, number>()
  let nextLayer = 0
  for (const period of periods) {
    if (!teamLayers.has(period.teamName)) {
      teamLayers.set(period.teamName, nextLayer++)
    }
  }

  const renders: Array<{
    period: ObjectTeamPeriod
    left: number
    width: number
    layer: number
    color: string
  }> = []

  const timelineStart = new Date(timeUnits[0].date)
  timelineStart.setHours(0, 0, 0, 0)
  const timelineEnd = new Date(timeUnits[timeUnits.length - 1].date)
  timelineEnd.setHours(23, 59, 59, 999)

  for (const period of periods) {
    // Гарантируем корректную конвертацию дат
    const startDate = period.startDate instanceof Date
      ? new Date(period.startDate)
      : new Date(String(period.startDate))
    startDate.setHours(0, 0, 0, 0)

    const endDate = period.endDate instanceof Date
      ? new Date(period.endDate)
      : new Date(String(period.endDate))
    endDate.setHours(0, 0, 0, 0)

    // Проверяем видимость
    if (startDate > timelineEnd || endDate < timelineStart) continue

    // Находим индексы - ищем ближайший день если точного совпадения нет
    let startIdx = -1
    let endIdx = -1

    for (let i = 0; i < timeUnits.length; i++) {
      const unitDate = new Date(timeUnits[i].date)
      unitDate.setHours(0, 0, 0, 0)

      if (startIdx === -1 && unitDate.getTime() >= startDate.getTime()) {
        startIdx = i
      }
      if (unitDate.getTime() <= endDate.getTime()) {
        endIdx = i
      }
    }

    // Если за пределами — используем границы
    if (startIdx === -1) startIdx = 0
    if (endIdx === -1) endIdx = timeUnits.length - 1

    // Убеждаемся что endIdx >= startIdx
    if (endIdx < startIdx) endIdx = startIdx

    // Пропускаем если период вне видимой области
    if (startIdx >= timeUnits.length || endIdx < 0) continue

    // Вычисляем позицию и ширину
    const left = (timeUnits[startIdx]?.left ?? startIdx * cellWidth) + HORIZONTAL_GAP / 2
    let width = 0
    for (let idx = startIdx; idx <= endIdx; idx++) {
      width += timeUnits[idx]?.width ?? cellWidth
    }
    width -= HORIZONTAL_GAP

    const layer = teamLayers.get(period.teamName) || 0
    const color = getTeamColor(period.teamName, isDark)

    renders.push({
      period,
      left,
      width,
      layer,
      color,
    })
  }

  return renders
}

// =====================================================
// Функции для heatmap интенсивности на уровне проекта
// =====================================================

/**
 * Интерфейс для данных интенсивности по дням
 */
export interface DailyIntensity {
  date: Date
  totalRate: number
  teamsCount: number
  employeesCount: number
}

/**
 * Вычисляет интенсивность загрузки по дням для набора секций
 */
export function calculateDailyIntensity(
  sections: Array<{ id?: string; loadings?: Loading[] }>,
  timeUnits: TimelineUnit[],
  loadingsMap?: Record<string, Loading[]>
): DailyIntensity[] {
  // Собираем все загрузки
  const allLoadings: Loading[] = []
  for (const section of sections) {
    const sectionLoadings = (loadingsMap && section.id ? loadingsMap[section.id] : null) || section.loadings || []
    allLoadings.push(...sectionLoadings)
  }

  if (allLoadings.length === 0) {
    return timeUnits.map(unit => ({
      date: new Date(unit.date),
      totalRate: 0,
      teamsCount: 0,
      employeesCount: 0,
    }))
  }

  // Для каждого дня в timeline считаем суммарную нагрузку
  return timeUnits.map(unit => {
    const unitDate = new Date(unit.date)
    unitDate.setHours(0, 0, 0, 0)

    let totalRate = 0
    const activeTeams = new Set<string>()
    const activeEmployees = new Set<string>()

    for (const loading of allLoadings) {
      const loadingStart = new Date(loading.startDate)
      loadingStart.setHours(0, 0, 0, 0)
      const loadingEnd = new Date(loading.endDate)
      loadingEnd.setHours(23, 59, 59, 999)

      // Проверяем, активна ли загрузка в этот день
      if (unitDate >= loadingStart && unitDate <= loadingEnd) {
        totalRate += loading.rate || 1
        if (loading.responsibleTeamName) {
          activeTeams.add(loading.responsibleTeamName)
        }
        const empId = loading.responsibleId || loading.employeeId
        if (empId) {
          activeEmployees.add(empId)
        }
      }
    }

    return {
      date: unitDate,
      totalRate,
      teamsCount: activeTeams.size,
      employeesCount: activeEmployees.size,
    }
  })
}

/**
 * Возвращает цвет для heatmap на основе интенсивности
 */
export function getIntensityColor(intensity: number, maxIntensity: number, isDark: boolean): string {
  if (intensity === 0 || maxIntensity === 0) {
    return 'transparent'
  }

  // Нормализуем интенсивность от 0 до 1
  const normalized = Math.min(intensity / maxIntensity, 1)

  // Используем teal/emerald цвета для консистентности с темой
  if (isDark) {
    // Для тёмной темы: от прозрачного до насыщенного teal
    const alpha = 0.2 + normalized * 0.6 // от 0.2 до 0.8
    return `rgba(20, 184, 166, ${alpha})` // teal-500
  } else {
    // Для светлой темы: от светлого до насыщенного
    const alpha = 0.15 + normalized * 0.5 // от 0.15 до 0.65
    return `rgba(13, 148, 136, ${alpha})` // teal-600
  }
}

