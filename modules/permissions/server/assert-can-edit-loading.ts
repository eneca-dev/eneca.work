'use server'

/**
 * Server Action: проверка прав на редактирование загрузки.
 *
 * 1) Авторизация
 * 2) Загрузка существует
 * 3) У юзера есть права на её редактирование (через canEditLoading)
 *
 * При успехе возвращает loading metadata + ctx — вызывающий action может
 * использовать их без повторных запросов.
 *
 * Тип возвращаемого значения внутри AssertCanEditLoadingResult — выводится
 * автоматически через TypeScript, без отдельного экспорта (Next.js 'use server'
 * запрещает экспорт всего кроме async функций).
 */

import { createClient } from '@/utils/supabase/server'
import * as Sentry from '@sentry/nextjs'
import {
  canEditLoading,
  type LoadingPermissionContext,
} from '../utils/can-edit-loading'
import { getFilterContext } from './get-filter-context'
import type { ActionResult } from '@/modules/cache'
import type { UserFilterContext } from '../types'

interface AssertCanEditLoadingResult {
  loading: LoadingPermissionContext
  ctx: UserFilterContext
}

export async function assertCanEditLoading(
  loadingId: string
): Promise<ActionResult<AssertCanEditLoadingResult>> {
  const supabase = await createClient()

  // Параллельно: контекст пользователя + базовые поля загрузки
  const [ctxResult, loadingRow] = await Promise.all([
    getFilterContext(),
    supabase
      .from('view_employee_workloads')
      .select('user_id, final_team_id, final_department_id, project_id')
      .eq('loading_id', loadingId)
      .limit(1)
      .maybeSingle(),
  ])

  if (!ctxResult.success || !ctxResult.data) {
    return { success: false, error: 'Не удалось получить контекст пользователя' }
  }

  if (loadingRow.error || !loadingRow.data || !loadingRow.data.user_id) {
    return { success: false, error: 'Загрузка не найдена' }
  }

  // Подразделение исполнителя через teams → departments
  let subdivisionId: string | null = null
  if (loadingRow.data.final_department_id) {
    const { data: deptRow } = await supabase
      .from('departments')
      .select('subdivision_id')
      .eq('department_id', loadingRow.data.final_department_id)
      .single()
    subdivisionId = deptRow?.subdivision_id ?? null
  }

  const loading: LoadingPermissionContext = {
    responsibleId: loadingRow.data.user_id,
    teamId: loadingRow.data.final_team_id,
    departmentId: loadingRow.data.final_department_id,
    subdivisionId,
    projectId: loadingRow.data.project_id,
  }

  if (!canEditLoading(loading, ctxResult.data)) {
    Sentry.addBreadcrumb({
      category: 'permissions',
      message: 'canEditLoading: denied',
      level: 'info',
      data: {
        userId: ctxResult.data.userId,
        loadingId,
        loadingDeptId: loading.departmentId,
        loadingTeamId: loading.teamId,
        userDeptId: ctxResult.data.ownDepartmentId,
        userTeamId: ctxResult.data.ownTeamId,
        userPerms: ctxResult.data.permissions.filter((p) =>
          p.startsWith('loadings.')
        ),
      },
    })
    return { success: false, error: 'Нет прав на редактирование загрузки' }
  }

  return { success: true, data: { loading, ctx: ctxResult.data } }
}
