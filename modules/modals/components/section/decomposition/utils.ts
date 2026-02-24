/**
 * Decomposition Module - Utility Functions
 */

import type { Stage, Decomposition } from './types'
import { PROGRESS_THRESHOLDS } from './constants'

// ============================================================================
// Date Utilities
// ============================================================================

/**
 * Парсинг ISO строки даты в объект Date
 */
export function parseISODateString(iso: string | null): Date | null {
  if (!iso) return null
  const date = new Date(iso)
  return isNaN(date.getTime()) ? null : date
}

/**
 * Форматирование Date в ISO строку (YYYY-MM-DD)
 */
export function formatISODateString(date: Date | null): string | null {
  if (!date) return null
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Форматирование даты для отображения (DD.MM.YYYY)
 */
export function formatDisplayDate(iso: string | null): string {
  if (!iso) return '—'
  const date = parseISODateString(iso)
  if (!date) return '—'
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  return `${day}.${month}.${year}`
}

// ============================================================================
// Hour Distribution
// ============================================================================

/**
 * Распределение часов по сложности (К/ВС/ГС)
 * @returns [часы К, часы ВС, часы ГС]
 */
export function distributeHours(totalHours: number, difficulty: string): [number, number, number] {
  const hours = totalHours || 0
  if (difficulty === 'К') return [hours, 0, 0]
  if (difficulty === 'ВС') return [0, hours, 0]
  if (difficulty === 'ГС') return [0, 0, hours]
  return [hours, 0, 0] // по умолчанию К
}

// ============================================================================
// Color Utilities
// ============================================================================

/**
 * Получить цвет для уровня сложности
 */
export function getDifficultyColor(difficulty: string): string {
  const colors: Record<string, string> = {
    Низкая: 'bg-emerald-100 hover:bg-emerald-200 text-emerald-900',
    Средняя: 'bg-amber-100 hover:bg-amber-200 text-amber-900',
    Высокая: 'bg-rose-100 hover:bg-rose-200 text-rose-900',
    К: 'bg-emerald-100 hover:bg-emerald-200 text-emerald-900',
    ВС: 'bg-amber-100 hover:bg-amber-200 text-amber-900',
    ГС: 'bg-rose-100 hover:bg-rose-200 text-rose-900',
  }
  return colors[difficulty] || 'bg-muted/60 hover:bg-muted/80'
}

/**
 * Получить цвет для значения прогресса (для badge)
 */
export function getProgressColor(progress: number): string {
  if (progress === 0) {
    return 'bg-gray-100 hover:bg-gray-200 text-gray-900 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-100'
  }
  if (progress <= PROGRESS_THRESHOLDS.LOW) {
    return 'bg-red-100 hover:bg-red-200 text-red-900 dark:bg-red-900/30 dark:hover:bg-red-900/40 dark:text-red-200'
  }
  if (progress <= PROGRESS_THRESHOLDS.MEDIUM) {
    return 'bg-yellow-100 hover:bg-yellow-200 text-yellow-900 dark:bg-yellow-900/30 dark:hover:bg-yellow-900/40 dark:text-yellow-200'
  }
  return 'bg-green-100 hover:bg-green-200 text-green-900 dark:bg-green-900/30 dark:hover:bg-green-900/40 dark:text-green-200'
}

/**
 * Получить цвет для статуса этапа
 */
export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    'Не начато':
      'bg-slate-100 hover:bg-slate-200 text-slate-900 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200',
    План: 'bg-blue-100 hover:bg-blue-200 text-blue-900 dark:bg-blue-900/30 dark:hover:bg-blue-900/40 dark:text-blue-200',
    Планируется:
      'bg-blue-100 hover:bg-blue-200 text-blue-900 dark:bg-blue-900/30 dark:hover:bg-blue-900/40 dark:text-blue-200',
    Запланировано:
      'bg-blue-100 hover:bg-blue-200 text-blue-900 dark:bg-blue-900/30 dark:hover:bg-blue-900/40 dark:text-blue-200',
    'В работе':
      'bg-sky-100 hover:bg-sky-200 text-sky-900 dark:bg-sky-900/30 dark:hover:bg-sky-900/40 dark:text-sky-200',
    'На проверке':
      'bg-violet-100 hover:bg-violet-200 text-violet-900 dark:bg-violet-900/30 dark:hover:bg-violet-900/40 dark:text-violet-200',
    'В ожидании':
      'bg-amber-100 hover:bg-amber-200 text-amber-900 dark:bg-amber-900/30 dark:hover:bg-amber-900/40 dark:text-amber-200',
    Ожидание:
      'bg-amber-100 hover:bg-amber-200 text-amber-900 dark:bg-amber-900/30 dark:hover:bg-amber-900/40 dark:text-amber-200',
    Приостановлено:
      'bg-orange-100 hover:bg-orange-200 text-orange-900 dark:bg-orange-900/30 dark:hover:bg-orange-900/40 dark:text-orange-200',
    Пауза:
      'bg-orange-100 hover:bg-orange-200 text-orange-900 dark:bg-orange-900/30 dark:hover:bg-orange-900/40 dark:text-orange-200',
    Заблокировано:
      'bg-red-100 hover:bg-red-200 text-red-900 dark:bg-red-900/30 dark:hover:bg-red-900/40 dark:text-red-200',
    Отменено:
      'bg-rose-100 hover:bg-rose-200 text-rose-900 dark:bg-rose-900/30 dark:hover:bg-rose-900/40 dark:text-rose-200',
    Завершено:
      'bg-emerald-100 hover:bg-emerald-200 text-emerald-900 dark:bg-emerald-900/30 dark:hover:bg-emerald-900/40 dark:text-emerald-200',
    Готово:
      'bg-emerald-100 hover:bg-emerald-200 text-emerald-900 dark:bg-emerald-900/30 dark:hover:bg-emerald-900/40 dark:text-emerald-200',
    Сделано:
      'bg-emerald-100 hover:bg-emerald-200 text-emerald-900 dark:bg-emerald-900/30 dark:hover:bg-emerald-900/40 dark:text-emerald-200',
  }
  return colors[status] || 'bg-muted/60 hover:bg-muted/80 dark:bg-muted/30 dark:hover:bg-muted/40'
}

/**
 * Получить цвет прогресс-бара
 */
export function getProgressBarColor(progress: number): string {
  if (progress === 0) return 'bg-gray-400 dark:bg-gray-600'
  if (progress <= PROGRESS_THRESHOLDS.LOW) return 'bg-red-500 dark:bg-red-600'
  if (progress <= PROGRESS_THRESHOLDS.MEDIUM) return 'bg-yellow-500 dark:bg-yellow-600'
  return 'bg-green-500 dark:bg-green-600'
}

// ============================================================================
// Stage Calculations
// ============================================================================

/**
 * Вычислить плановые часы этапа
 */
export function calculateStagePlannedHours(stage: Stage): number {
  return stage.decompositions.reduce((sum, dec) => sum + dec.plannedHours, 0)
}

/**
 * Вычислить фактические часы этапа
 */
export function calculateStageActualHours(
  stage: Stage,
  actualByItemId: Record<string, number>
): number {
  return stage.decompositions.reduce((sum, dec) => {
    return sum + (actualByItemId[dec.id] || 0)
  }, 0)
}

/**
 * Вычислить процент готовности этапа по формуле
 * Взвешенный прогресс по плановым часам
 */
export function calculateStageProgress(stage: Stage): number {
  const totalPlanned = calculateStagePlannedHours(stage)
  if (totalPlanned === 0) return 0

  const weightedProgress = stage.decompositions.reduce((sum, dec) => {
    return sum + (dec.plannedHours / totalPlanned) * (dec.progress / 100)
  }, 0)

  return Math.round(weightedProgress * 100) // Возвращаем в процентах
}

// ============================================================================
// Summary Calculations
// ============================================================================

/**
 * Подсчитать общую статистику по всем этапам
 */
export function calculateTotalStats(
  stages: Stage[],
  actualByItemId: Record<string, number>
): {
  totalPlannedHours: number
  totalActualHours: number
  totalProgress: number
  totalTasks: number
  totalStages: number
} {
  let totalPlannedHours = 0
  let totalActualHours = 0
  let totalTasks = 0

  stages.forEach((stage) => {
    totalPlannedHours += calculateStagePlannedHours(stage)
    totalActualHours += calculateStageActualHours(stage, actualByItemId)
    totalTasks += stage.decompositions.length
  })

  const totalProgress =
    totalPlannedHours > 0
      ? Math.round(
          (stages.reduce((sum, stage) => {
            const stagePlanned = calculateStagePlannedHours(stage)
            if (stagePlanned === 0) return sum
            return sum + (stagePlanned / totalPlannedHours) * calculateStageProgress(stage)
          }, 0) /
            100) *
            100
        )
      : 0

  return {
    totalPlannedHours,
    totalActualHours,
    totalProgress,
    totalTasks,
    totalStages: stages.length,
  }
}

// ============================================================================
// ID Generation
// ============================================================================

/**
 * Генерация временного ID для оптимистичных обновлений
 */
export function generateTempId(): string {
  return `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Проверка является ли ID временным
 */
export function isTempId(id: string): boolean {
  return id.startsWith('temp_')
}

// ============================================================================
// Sorting
// ============================================================================

/**
 * Сортировка этапов по порядку
 */
export function sortStagesByOrder(stages: Stage[]): Stage[] {
  // Этапы уже отсортированы в bootstrap, но можно добавить сортировку по имени как fallback
  return [...stages]
}

/**
 * Сортировка задач по порядку
 */
export function sortDecompositionsByOrder(decompositions: Decomposition[]): Decomposition[] {
  // Задачи уже отсортированы в bootstrap
  return [...decompositions]
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Валидация данных этапа
 */
export function validateStage(stage: Partial<Stage>): string | null {
  if (!stage.name || stage.name.trim() === '') {
    return 'Название этапа не может быть пустым'
  }
  if (stage.startDate && stage.endDate) {
    const start = parseISODateString(stage.startDate)
    const end = parseISODateString(stage.endDate)
    if (start && end && start > end) {
      return 'Дата начала не может быть позже даты окончания'
    }
  }
  return null
}

/**
 * Валидация данных декомпозиции
 */
export function validateDecomposition(decomposition: Partial<Decomposition>): string | null {
  if (!decomposition.description || decomposition.description.trim() === '') {
    return 'Описание задачи не может быть пустым'
  }
  if (decomposition.plannedHours !== undefined && decomposition.plannedHours < 0) {
    return 'Плановые часы не могут быть отрицательными'
  }
  if (
    decomposition.progress !== undefined &&
    (decomposition.progress < 0 || decomposition.progress > 100)
  ) {
    return 'Прогресс должен быть от 0 до 100'
  }
  return null
}
