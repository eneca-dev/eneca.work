/**
 * Budget Configuration Constants
 *
 * Централизованное хранение констант бюджетной системы.
 * В будущем эти значения должны загружаться из БД или настроек.
 */

// ============================================================================
// Budget Calculation Constants
// ============================================================================

/**
 * @deprecated since 2026-04-28
 * Захардкоженная средняя ставка (BYN/час). Заменена на ставку отдела
 * (`department_budget_settings.hourly_rate`), берётся через `useSectionCalcBudgets`.
 * См. docs/deprecated/budgets-planned-hours.md.
 *
 * Используется только в SectionRateEdit как fallback при отсутствии значения у раздела.
 */
export const MOCK_HOURLY_RATE = 15

/**
 * @deprecated since 2026-04-28
 * Коэффициент приведения часов в старой формуле расчётного бюджета.
 * В новой формуле через loadings × ставка_отдела фактор не применяется.
 * См. docs/deprecated/budgets-planned-hours.md.
 */
export const HOURS_ADJUSTMENT_FACTOR = 1.2

// ============================================================================
// Work Category Defaults
// ============================================================================

/**
 * ID категории работ по умолчанию (Проектирование)
 *
 * TODO: В будущем это значение должно:
 * 1. Загружаться из настроек пользователя (user_preferences.default_work_category_id)
 * 2. Или определяться на уровне проекта (projects.default_work_category_id)
 * 3. Или быть первой категорией из справочника work_categories
 *
 * ВАЖНО: Этот UUID привязан к конкретной БД. При миграции на другую БД
 * необходимо обновить это значение или реализовать динамическую загрузку.
 *
 * @see https://github.com/eneca-dev/eneca.work/issues/xxx
 */
export const DEFAULT_WORK_CATEGORY_ID = '89a560a5-e740-4cec-b2df-e4edd49f95b2'
