'use server'

/**
 * Server Actions для cross-department loading access grants.
 *
 * Грант разрешает НО/ТЛ отдела-получателя управлять загрузками конкретного
 * сотрудника, основной отдел которого — другой. Сотрудник не меняет
 * department_id/team_id, но появляется в селекторах загрузок другого отдела
 * с пометкой "гостевой".
 *
 * См. спеку: docs/superpowers/specs/2026-05-19-cross-department-loading-grants-design.md
 */

import { revalidatePath } from 'next/cache'
import * as Sentry from '@sentry/nextjs'
import { createClient } from '@/utils/supabase/server'
import type { ActionResult } from '@/modules/cache'
import { assertCanGrantLoadingAccess } from '@/modules/permissions/server/assert-can-grant-loading-access'
import type {
  LoadingAccessGrantRow,
  CreateLoadingAccessGrantInput,
} from './loading-access-grants.types'

// ============================================================================
// Actions
// ============================================================================

/**
 * Все гранты в системе одним запросом — для построения index'а
 * employee_id → granted_to_department_ids[] на клиенте.
 *
 * Таблица грантов небольшая (десятки строк в обозримом будущем),
 * поэтому полный select без фильтра дешевле, чем N+1 в селекторах.
 */
export async function listAllLoadingAccessGrants(): Promise<
  ActionResult<Array<{ employee_id: string; granted_to_department_id: string }>>
> {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return { success: false, error: 'Пользователь не авторизован' }
    }

    const { data, error } = await supabase
      .from('employee_loading_access_grants')
      .select('employee_id, granted_to_department_id')

    if (error) {
      Sentry.captureException(error, {
        extra: { context: 'listAllLoadingAccessGrants' },
      })
      return { success: false, error: error.message }
    }

    return { success: true, data: data ?? [] }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ошибка загрузки грантов',
    }
  }
}

/**
 * Список грантов для конкретного сотрудника (для UI карточки).
 * Доступен:
 *  - admin / НО владеющего отдела / ТЛ команды сотрудника — полный список
 *  - НО/ТЛ отдела-получателя — также видит (для понимания, что им открыт доступ)
 *  - остальным — пустой список (мы не ошибаемся, просто скрываем)
 *
 * Просмотр грантов не считается операцией с правами: чтения не блокируем,
 * UI сам решит что показывать.
 */
export async function listLoadingAccessGrantsForEmployee(
  employeeId: string
): Promise<ActionResult<LoadingAccessGrantRow[]>> {
  return Sentry.startSpan(
    { name: 'listLoadingAccessGrantsForEmployee', op: 'server.action' },
    async () => {
      try {
        const supabase = await createClient()

        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
          return { success: false, error: 'Пользователь не авторизован' }
        }

        const { data, error } = await supabase
          .from('v_employee_loading_access_grants')
          .select(
            'grant_id, employee_id, granted_to_department_id, granted_to_department_name, granted_by, granted_by_name, created_at'
          )
          .eq('employee_id', employeeId)
          .order('created_at', { ascending: false })

        if (error) {
          Sentry.captureException(error, {
            extra: { context: 'listLoadingAccessGrantsForEmployee', employeeId },
          })
          return { success: false, error: error.message }
        }

        return { success: true, data: (data ?? []) as LoadingAccessGrantRow[] }
      } catch (error) {
        Sentry.captureException(error, {
          extra: { context: 'listLoadingAccessGrantsForEmployee' },
        })
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Ошибка загрузки грантов',
        }
      }
    }
  )
}

/**
 * Создать грант: разрешить указанному отделу управлять загрузками сотрудника.
 * Идемпотентно: если грант уже есть — возвращаем существующий grant_id.
 */
export async function createLoadingAccessGrant(
  input: CreateLoadingAccessGrantInput
): Promise<ActionResult<{ grant_id: string }>> {
  return Sentry.startSpan(
    { name: 'createLoadingAccessGrant', op: 'server.action' },
    async () => {
      try {
        const supabase = await createClient()

        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
          return { success: false, error: 'Пользователь не авторизован' }
        }

        // Проверка: вызывающий должен быть admin / НО владеющего отдела / ТЛ команды сотрудника
        const guard = await assertCanGrantLoadingAccess(input.employee_id)
        if (!guard.success) return guard

        // Идемпотентный INSERT через upsert по UNIQUE-индексу
        const { data, error } = await supabase
          .from('employee_loading_access_grants')
          .upsert(
            {
              employee_id: input.employee_id,
              granted_to_department_id: input.granted_to_department_id,
              granted_by: user.id,
            },
            {
              onConflict: 'employee_id,granted_to_department_id',
              ignoreDuplicates: false,
            }
          )
          .select('grant_id')
          .single()

        if (error || !data) {
          Sentry.captureException(error, {
            extra: { context: 'createLoadingAccessGrant', input },
          })
          return {
            success: false,
            error: error?.message ?? 'Не удалось создать грант',
          }
        }

        revalidatePath('/dashboard/users')
        return { success: true, data: { grant_id: data.grant_id } }
      } catch (error) {
        Sentry.captureException(error, {
          extra: { context: 'createLoadingAccessGrant' },
        })
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Ошибка создания гранта',
        }
      }
    }
  )
}

/**
 * Отозвать грант.
 */
export async function revokeLoadingAccessGrant(input: {
  grant_id: string
}): Promise<ActionResult<{ employee_id: string }>> {
  return Sentry.startSpan(
    { name: 'revokeLoadingAccessGrant', op: 'server.action' },
    async () => {
      try {
        const supabase = await createClient()

        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
          return { success: false, error: 'Пользователь не авторизован' }
        }

        // Получаем employee_id гранта для guard и cache-инвалидации
        const { data: grantRow, error: grantErr } = await supabase
          .from('employee_loading_access_grants')
          .select('employee_id')
          .eq('grant_id', input.grant_id)
          .single()

        if (grantErr || !grantRow) {
          return { success: false, error: 'Грант не найден' }
        }

        // Проверка прав
        const guard = await assertCanGrantLoadingAccess(grantRow.employee_id)
        if (!guard.success) return guard

        const { error: delErr } = await supabase
          .from('employee_loading_access_grants')
          .delete()
          .eq('grant_id', input.grant_id)

        if (delErr) {
          Sentry.captureException(delErr, {
            extra: { context: 'revokeLoadingAccessGrant', input },
          })
          return { success: false, error: delErr.message }
        }

        revalidatePath('/dashboard/users')
        return { success: true, data: { employee_id: grantRow.employee_id } }
      } catch (error) {
        Sentry.captureException(error, {
          extra: { context: 'revokeLoadingAccessGrant' },
        })
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Ошибка отзыва гранта',
        }
      }
    }
  )
}
