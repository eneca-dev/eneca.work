/**
 * Decomposition Module - Constants
 */

// ============================================================================
// Excel Label Mappings
// ============================================================================

/**
 * Маппинг меток из Excel на категории работ в системе
 */
export const LABEL_TO_CATEGORY_MAP: Record<string, string> = {
  MNG: 'Управление',
  CLC: 'Расчёт',
  MDL200: 'Моделирование 200',
  MDL300: 'Моделирование 300',
  MDL400: 'Моделирование 400',
  DRW: 'Оформление',
  GTS: 'ОТР',
}

/**
 * Обратный маппинг: категории работ → метки (для копирования)
 */
export const CATEGORY_TO_LABEL_MAP: Record<string, string> = {
  Управление: 'MNG',
  Расчёт: 'CLC',
  'Моделирование 200': 'MDL200',
  'Моделирование 300': 'MDL300',
  'Моделирование 400': 'MDL400',
  Оформление: 'DRW',
  ОТР: 'GTS',
}

// ============================================================================
// Difficulty Mappings
// ============================================================================

/**
 * Маппинг аббревиатур сложности для распределения часов
 * К - Конструктив, ВС - Высокая сложность, ГС - Грунтовые сваи
 */
export const DIFFICULTY_ABBR_MAP: Record<string, number> = {
  К: 0,
  ВС: 1,
  ГС: 2,
}

// ============================================================================
// UI Constants
// ============================================================================

/**
 * Минимальная ширина панели для отображения декомпозиции
 */
export const MIN_PANEL_WIDTH = 1100

/**
 * Колонки таблицы декомпозиции
 */
export const DECOMPOSITION_TABLE_COLUMNS = [
  { id: 'select', width: 40, label: '' },
  { id: 'drag', width: 32, label: '' },
  { id: 'description', width: 'auto', label: 'Описание' },
  { id: 'typeOfWork', width: 140, label: 'Тип работы' },
  { id: 'difficulty', width: 80, label: 'Слож.' },
  { id: 'plannedHours', width: 80, label: 'План, ч' },
  { id: 'actualHours', width: 80, label: 'Факт, ч' },
  { id: 'progress', width: 100, label: 'Готовность' },
  { id: 'actions', width: 48, label: '' },
] as const

/**
 * Дефолтные значения для новой декомпозиции
 */
export const DEFAULT_DECOMPOSITION = {
  description: '',
  typeOfWork: '',
  difficulty: '',
  plannedHours: 0,
  progress: 0,
}

/**
 * Дефолтные значения для нового этапа
 */
export const DEFAULT_STAGE = {
  name: 'Новый этап',
  startDate: null,
  endDate: null,
  description: null,
  statusId: null,
  responsibles: [],
  decompositions: [],
}

// ============================================================================
// Progress Constants
// ============================================================================

/**
 * Пороговые значения прогресса для цветовой индикации
 */
export const PROGRESS_THRESHOLDS = {
  LOW: 30,
  MEDIUM: 70,
  HIGH: 100,
} as const
