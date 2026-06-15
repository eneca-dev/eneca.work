'use server'

/**
 * Server Action: контекст фильтрации для вкладок Разделы/Отделы на /tasks.
 *
 * Если у юзера есть `tasks.tabs.view.department`, расширяет scope с команды
 * до отдела (для user/team_lead). На этих вкладках они видят весь свой отдел,
 * хотя их базовый scope — команда.
 *
 * Логика расширения вынесена в pure-функцию expandScopeForTasksTabs,
 * чтобы клиент мог применить такое же расширение для UI (locked-badge,
 * filter-options) без отдельного запроса.
 */

import { getFilterContext } from './get-filter-context'
import { expandScopeForTasksTabs } from '../utils/expand-scope-for-tasks'
import type { UserFilterContext } from '../types'
import type { ActionResult } from '@/modules/cache'

export async function getFilterContextForTasksTabs(): Promise<
  ActionResult<UserFilterContext | null>
> {
  const result = await getFilterContext()

  if (!result.success || !result.data) return result

  return {
    success: true,
    data: expandScopeForTasksTabs(result.data),
  }
}
