/**
 * Loading Money Server Actions
 *
 * Server Action для получения расчётного бюджета по разделам из v_cache_section_calc_budget.
 * Источник: суммы по всем loadings раздела (loading_rate × work_hours_per_day × work_days × hourly_rate).
 *
 * @module budgets-page/actions/loading-money
 * См. docs/production/budgets-calc-from-loadings.md
 */

'use server'

import { createClient } from '@/utils/supabase/server'
import type { ActionResult, ViewRow } from '@/modules/cache'

// ============================================================================
// Types
// ============================================================================

/**
 * Строка из v_cache_section_calc_budget.
 * Поля могут быть null — раздел без loadings вернёт SUM=null.
 */
export type SectionCalcBudget = ViewRow<'v_cache_section_calc_budget'>

// ============================================================================
// Actions
// ============================================================================

/**
 * Получить расчётные бюджеты по всем разделам.
 *
 * Загружаем весь view целиком (≤~1200 строк — только разделы с загрузками).
 * Фильтрация по конкретным разделам происходит на клиенте в use-budgets-hierarchy через calcMap.
 *
 * Почему не используем .in(section_id, sectionIds):
 * При загрузке всех проектов в URL попадает 3000+ UUID (~140KB) → PostgREST возвращает 400 Bad Request.
 */
export async function getSectionCalcBudgets(): Promise<ActionResult<SectionCalcBudget[]>> {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { success: false, error: 'Не авторизован' }
  }

  const { data, error } = await supabase
    .from('v_cache_section_calc_budget')
    .select('section_id, calc_budget, total_hours, loading_count, valid_loading_count, errors_count')

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, data: data ?? [] }
}
