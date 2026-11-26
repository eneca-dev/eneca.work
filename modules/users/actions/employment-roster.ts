'use server'

import { z } from 'zod'
import * as Sentry from '@sentry/nextjs'
import type { ActionResult } from '@/modules/cache'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { formatMinskDate } from '@/lib/timezone-utils'
import { getEmploymentStatus } from '../lib/employment-client'
import { employmentDateSchema } from '../lib/employment-dated'

export interface FinishedEmployees {
  today: string
  enabled: boolean
  finishedEmployeeIds: string[]
  /** Inclusive last working day, derived from the exclusive valid_to boundary. */
  finishedOnByEmployeeId: Record<string, string>
}

const PAGE_SIZE = 1000
const ID_BATCH_SIZE = 100
const identitySchema = z.object({ user_id: z.string().uuid().nullable() })
const periodSchema = z.object({
  employee_id: z.string().uuid(),
  valid_from: employmentDateSchema,
  valid_to: employmentDateSchema.nullable(),
}).refine(row => row.valid_to === null || row.valid_to > row.valid_from)

/** Narrow the session-visible roster only; unknown employment states stay visible. */
export async function getFinishedEmployees(): Promise<ActionResult<FinishedEmployees>> {
  return Sentry.startSpan({ name: 'getFinishedEmployees', op: 'db.query' }, async () => {
    try {
      const supabase = await createClient()
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) return { success: false, error: 'Необходимо войти в систему' }

      const status = await getEmploymentStatus(supabase)
      const today = employmentDateSchema.parse(status?.today ?? formatMinskDate(new Date()))
      if (!status?.enabled) {
        return { success: true, data: { today, enabled: false, finishedEmployeeIds: [], finishedOnByEmployeeId: {} } }
      }

      const authorizedIds = new Set<string>()
      for (let from = 0; ; from += PAGE_SIZE) {
        const result = await supabase.from('view_users').select('user_id')
          .order('user_id').range(from, from + PAGE_SIZE - 1)
        if (result.error || !result.data) throw new Error('Visible roster read failed')
        const page = z.array(identitySchema).parse(result.data)
        for (const row of page) if (row.user_id) authorizedIds.add(row.user_id)
        if (page.length < PAGE_SIZE) break
      }

      const ids = [...authorizedIds]
      const latest = new Map<string, z.infer<typeof periodSchema>>()
      if (ids.length) {
        const admin = createAdminClient()
        for (let offset = 0; offset < ids.length; offset += ID_BATCH_SIZE) {
          const batch = ids.slice(offset, offset + ID_BATCH_SIZE)
          for (let from = 0; ; from += PAGE_SIZE) {
            const result = await admin.from('employee_employment_periods')
              .select('employee_id,valid_from,valid_to').in('employee_id', batch)
              .order('employee_id').order('valid_from').range(from, from + PAGE_SIZE - 1)
            if (result.error || !result.data) throw new Error('Employment roster read failed')
            const page = z.array(periodSchema).parse(result.data)
            for (const row of page) {
              if (!batch.includes(row.employee_id)) throw new Error('Employment roster scope mismatch')
              const previous = latest.get(row.employee_id)
              if (!previous || row.valid_from > previous.valid_from) latest.set(row.employee_id, row)
            }
            if (page.length < PAGE_SIZE) break
          }
        }
      }

      const finishedEmployeeIds: string[] = []
      const finishedOnByEmployeeId: Record<string, string> = {}
      for (const id of ids) {
        const period = latest.get(id)
        // valid_to is exclusive: an employee remains current on their last working day.
        if (period?.valid_to != null && period.valid_to <= today) {
          const lastDay = new Date(`${period.valid_to}T00:00:00Z`)
          lastDay.setUTCDate(lastDay.getUTCDate() - 1)
          finishedEmployeeIds.push(id)
          finishedOnByEmployeeId[id] = lastDay.toISOString().slice(0, 10)
        }
      }
      return { success: true, data: { today, enabled: true, finishedEmployeeIds, finishedOnByEmployeeId } }
    } catch (error) {
      Sentry.captureException(error, { tags: { module: 'users', action: 'getFinishedEmployees' } })
      return { success: false, error: 'Не удалось проверить завершение работы сотрудников. Обновите данные и повторите попытку.' }
    }
  })
}
