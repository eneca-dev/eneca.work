/**
 * MOCK DATA — плановые данные для Демопроект1.
 *
 * Используется только для разработки и демонстрации визуализации подосновы
 * во вкладке «Разделы». Удалить после реализации настоящего API.
 *
 * Три независимых концепта:
 *  1. MockSectionDates     — плановые даты раздела (section_start_date / section_end_date)
 *  2. MockCapacityPlan     — плановая ёмкость раздела в ставках (новая сущность)
 *  3. MockProjectDates     — даты проекта: мануальные + вычисленные из разделов
 */

// ============================================================================
// Types
// ============================================================================

/** Плановые даты раздела */
export interface MockSectionDates {
  sectionId: string
  startDate: string  // YYYY-MM-DD
  endDate: string    // YYYY-MM-DD
}

/**
 * Плановая ёмкость раздела.
 * РП вводит: «на этом разделе в этот период нужно X ставок».
 * Специализация не учитывается (пока).
 */
export interface MockCapacityPlan {
  sectionId: string
  startDate: string  // YYYY-MM-DD
  endDate: string    // YYYY-MM-DD
  /** Количество ставок (0.25 / 0.5 / 0.75 / 1.0 / 1.5 / 2.0 ...) */
  plannedRates: number
}

/** Даты проекта — два независимых значения */
export interface MockProjectDates {
  projectId: string
  /** Мануальные даты: РП вводит вручную независимо от разделов */
  manual: {
    startDate: string  // YYYY-MM-DD
    endDate: string    // YYYY-MM-DD
  }
  /**
   * Вычисленные даты: min(section_start_date) → max(section_end_date)
   * по всем разделам проекта. Обновляются автоматически.
   */
  calculated: {
    startDate: string  // YYYY-MM-DD
    endDate: string    // YYYY-MM-DD
  }
}

// ============================================================================
// Mock Data — Демопроект1
// ============================================================================

/** ID проекта «Демопроект1» */
export const MOCK_PROJECT_ID = '2fd45a1b-6855-413e-b3ef-6138402519df'

/**
 * Плановые даты разделов (подоснова).
 * Выровнены под реальные периоды загрузок в БД (фев–июн 2026).
 */
export const MOCK_SECTION_DATES: MockSectionDates[] = [
  // Объект «Обхект»
  { sectionId: 'fbae0b80-6cad-4163-b90d-9b4893ee99ce', startDate: '2026-06-01', endDate: '2026-06-30' }, // АР
  { sectionId: '87136f72-6bdf-41b6-84c5-303f8547e6db', startDate: '2026-06-01', endDate: '2026-06-27' }, // КР
  { sectionId: '315203de-21c0-4bfe-a27b-c961e268a6d8', startDate: '2026-06-01', endDate: '2026-06-30' }, // ОВ
  { sectionId: '0aa60ef7-74c8-4570-939e-1e49f548f856', startDate: '2026-06-01', endDate: '2026-06-20' }, // ОВ

  // Объект «Тестовый объект» — в БД null, здесь мок
  { sectionId: 'ad9cd0a7-3d54-4c87-b83d-f8ce01b41f68', startDate: '2026-06-01', endDate: '2026-06-30' }, // АР (Архитектура)
  { sectionId: '1efc861b-8a81-459e-add0-3a9482a5ddb4', startDate: '2026-06-10', endDate: '2026-06-25' }, // КР (Конструкции)
]

/**
 * Плановая ёмкость разделов в ставках (запрос РП).
 * Один раздел может иметь несколько периодов с разной ёмкостью.
 */
export const MOCK_CAPACITY_PLANS: MockCapacityPlan[] = [
  // АР — пик в начале, снижение к концу
  { sectionId: 'fbae0b80-6cad-4163-b90d-9b4893ee99ce', startDate: '2026-06-01', endDate: '2026-06-15', plannedRates: 3.0 },
  { sectionId: 'fbae0b80-6cad-4163-b90d-9b4893ee99ce', startDate: '2026-06-16', endDate: '2026-06-30', plannedRates: 1.5 },

  // КР — равномерно
  { sectionId: '87136f72-6bdf-41b6-84c5-303f8547e6db', startDate: '2026-06-01', endDate: '2026-06-27', plannedRates: 2.0 },

  // ОВ (первый)
  { sectionId: '315203de-21c0-4bfe-a27b-c961e268a6d8', startDate: '2026-06-01', endDate: '2026-06-30', plannedRates: 1.5 },

  // ОВ (второй) — небольшой объём
  { sectionId: '0aa60ef7-74c8-4570-939e-1e49f548f856', startDate: '2026-06-01', endDate: '2026-06-20', plannedRates: 0.5 },

  // Тестовый объект
  { sectionId: 'ad9cd0a7-3d54-4c87-b83d-f8ce01b41f68', startDate: '2026-06-01', endDate: '2026-06-30', plannedRates: 2.0 },
  { sectionId: '1efc861b-8a81-459e-add0-3a9482a5ddb4', startDate: '2026-06-10', endDate: '2026-06-25', plannedRates: 1.0 },
]

/**
 * Даты проекта — два независимых показателя.
 * manual     — РП вводит вручную (с запасом)
 * calculated — min/max по датам разделов
 */
export const MOCK_PROJECT_DATES: MockProjectDates = {
  projectId: MOCK_PROJECT_ID,
  manual: {
    startDate: '2026-05-15', // РП поставил старт чуть раньше разделов
    endDate: '2026-07-31',   // и финиш с запасом
  },
  calculated: {
    startDate: '2026-06-01', // min по разделам
    endDate: '2026-06-30',   // max по разделам
  },
}
