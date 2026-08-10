/**
 * WS Task Report - Server Actions (чтение)
 *
 * Чтение снимка задач Worksection из ws_task_report.
 * Таблицу наполняет отдельная синхронизация (ws-to-work/task-report),
 * приложение только читает.
 *
 * Выгрузка в Excel — в actions/export.ts, отдельным файлом. exceljs весит
 * ~23 МБ, и держать его в одном модуле с обычным чтением означало бы тянуть
 * его на каждый запрос строк — импорт верхнего уровня исполняется целиком
 * при загрузке файла, независимо от того, какая функция вызвана.
 *
 * @module ws-task-report/actions
 */

'use server'

import { createClient } from '@/utils/supabase/server'
import type { ActionResult } from '@/modules/cache'
import type { WsTaskReportData, WsTaskReportFilters } from '../types'
import { checkAccess, fetchReportRows } from './fetch-rows'

/** Есть ли у текущего пользователя доступ к отчёту */
export async function hasWsReportAccess(): Promise<ActionResult<boolean>> {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return { success: false, error: 'Не авторизован' }
    }

    return await checkAccess(supabase, user.id)
  } catch (error) {
    console.error('[hasWsReportAccess] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ошибка проверки доступа',
    }
  }
}

/**
 * Строки отчёта с фильтрами.
 *
 * Поиск идёт по названию задачи подстрокой без учёта регистра —
 * например «корректировк» найдёт «{Корректировка оформления}».
 */
export async function getWsTaskReport(
  filters?: WsTaskReportFilters
): Promise<ActionResult<WsTaskReportData>> {
  try {
    return await fetchReportRows(filters)
  } catch (error) {
    console.error('[getWsTaskReport] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ошибка загрузки отчёта',
    }
  }
}
