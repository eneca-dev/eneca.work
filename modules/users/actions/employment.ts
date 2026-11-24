'use server'

import { z } from 'zod'
import * as Sentry from '@sentry/nextjs'
import { createClient } from '@/utils/supabase/server'
import type { ActionResult } from '@/modules/cache'
import { finishEmployment } from '../lib/employment-client'

export async function finishEmployeeEmployment(employeeId: string): Promise<ActionResult<{ employeeId: string }>> {
  return Sentry.startSpan({ name: 'finishEmployeeEmployment', op: 'db.mutation' }, async () => {
    if (!z.string().uuid().safeParse(employeeId).success) {
      return { success: false, error: 'Некорректный сотрудник' }
    }
    try {
      const supabase = await createClient()
      const { data: { user }, error } = await supabase.auth.getUser()
      if (error || !user) return { success: false, error: 'Необходимо войти в систему' }
      if (user.id === employeeId) return { success: false, error: 'Нельзя завершить собственную работу' }
      // The RPC checks users.delete/admin again and closes the period atomically.
      await finishEmployment(supabase, employeeId)
      return { success: true, data: { employeeId } }
    } catch (error) {
      Sentry.captureException(error, { tags: { module: 'users', action: 'finishEmployment' } })
      return { success: false, error: 'Не удалось завершить работу сотрудника. Проверьте права и повторите попытку.' }
    }
  })
}
