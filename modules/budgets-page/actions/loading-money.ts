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
 * Получить расчётные бюджеты по списку разделов
 */
export async function getSectionCalcBudgets(
  sectionIds: string[]
): Promise<ActionResult<SectionCalcBudget[]>> {
  if (sectionIds.length === 0) {
    return { success: true, data: [] }
  }

  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { success: false, error: 'Не авторизован' }
  }

  const { data, error } = await supabase
    .from('v_cache_section_calc_budget')
    .select('section_id, calc_budget, total_hours, loading_count, valid_loading_count, errors_count')
    .in('section_id', sectionIds)

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, data: data ?? [] }
}
