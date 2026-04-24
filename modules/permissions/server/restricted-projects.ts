'use server'

import { cache } from 'react'
import { createClient } from '@/utils/supabase/server'

/**
 * Возвращает project_id всех проектов с ограниченным доступом (is_restricted = true).
 * Результат дедуплицируется в рамках одного HTTP-запроса через React.cache —
 * повторные вызовы из разных server actions выполнят SELECT только один раз.
 */
export const getRestrictedProjectIds = cache(async (): Promise<string[]> => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('projects')
    .select('project_id')
    .eq('is_restricted', true)

  if (error || !data) return []
  return data.map((p) => p.project_id)
})
