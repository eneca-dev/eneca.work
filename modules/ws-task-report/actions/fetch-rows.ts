/**
 * WS Task Report - Общая выборка строк
 *
 * НЕ 'use server' — это обычный серверный модуль, а не отдельный экшен.
 * Импортируется только из actions/index.ts и actions/export.ts (оба 'use server'),
 * никогда напрямую с клиента.
 *
 * Вынесен из actions/index.ts намеренно: держать здесь только чтение, без
 * exceljs. Если бы buildReportWorkbook (и вслед за ним ~23 МБ exceljs) лежал
 * в том же файле, что getWsTaskReport, каждый обычный запрос строк тянул бы
 * за собой весь Excel-модуль — просто потому, что импорт верхнего уровня
 * исполняется целиком при загрузке файла, независимо от того, какая функция
 * вызвана. Именно так и было раньше: страница отчёта грузилась дольше других
 * и заметно раздувала dev-кэш webpack.
 *
 * @module ws-task-report/actions/fetch-rows
 */

import { createClient } from '@/utils/supabase/server'
import type { ActionResult } from '@/modules/cache'
import type { WsTaskReportRow, WsTaskReportFilters, WsTaskReportData } from '../types'

/** Потолок выборки: отдел «КР гражд» даёт ~1900 строк, запас трёхкратный */
const MAX_ROWS = 5000

/**
 * Экранирует спецсимволы LIKE, чтобы «100%» искалось как текст,
 * а не как шаблон.
 */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`)
}

/**
 * Проверка доступа по уже известному пользователю.
 *
 * Принимает клиент и userId, чтобы вызывающий не платил вторым
 * `auth.getUser()` — это сетевой вызов к Supabase, а не локальная проверка.
 *
 * Читает ws_task_report_access — политика там разрешает видеть только
 * свою строку, поэтому непустой результат и означает наличие доступа.
 */
export async function checkAccess(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<ActionResult<boolean>> {
  const { data, error } = await supabase
    .from('ws_task_report_access')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    console.error('[checkAccess] Supabase error:', error)
    return { success: false, error: error.message }
  }

  return { success: true, data: !!data }
}

/**
 * Общая выборка для таблицы и выгрузки — чтобы фильтры между ними
 * не разъехались при будущих правках.
 *
 * Возвращает строки и момент последней синхронизации по всей таблице.
 * Проверку доступа делает сама.
 */
export async function fetchReportRows(
  filters?: WsTaskReportFilters
): Promise<ActionResult<WsTaskReportData>> {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { success: false, error: 'Не авторизован' }
  }

  // 🔒 Явная проверка доступа: RLS вернул бы пустой список, а это
  // неотличимо от «данных пока нет». Пользователь уже получен выше —
  // передаём его, чтобы не делать второй auth.getUser().
  const access = await checkAccess(supabase, user.id)
  if (!access.success) return { success: false, error: access.error }
  if (!access.data) {
    return { success: false, error: 'Нет доступа к отчёту' }
  }

  let query = supabase
    .from('ws_task_report')
    .select('*')
    .order('date_added', { ascending: false, nullsFirst: false })
    .limit(MAX_ROWS)

  const search = filters?.search?.trim()
  if (search) {
    query = query.ilike('ws_task_name', `%${escapeLike(search)}%`)
  }

  if (filters?.status && filters.status !== 'all') {
    query = query.eq('ws_status', filters.status)
  }

  // Диапазон дат открытия. Границы задаём явно в минском поясе (+03:00,
  // без перехода на летнее время), чтобы выбранный день попадал целиком.
  if (filters?.dateFrom) {
    query = query.gte('date_added', `${filters.dateFrom}T00:00:00+03:00`)
  }
  if (filters?.dateTo) {
    query = query.lte('date_added', `${filters.dateTo}T23:59:59.999+03:00`)
  }

  const { data, error } = await query

  if (error) {
    console.error('[fetchReportRows] Supabase error:', error)
    return { success: false, error: error.message }
  }

  const rows = (data ?? []) as WsTaskReportRow[]

  // Свежесть данных считаем по всей таблице, а не по отфильтрованной выборке:
  // иначе при пустом результате поиска дата обновления пропадала бы.
  const { data: lastRow, error: lastError } = await supabase
    .from('ws_task_report')
    .select('synced_at')
    .order('synced_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (lastError) {
    console.error('[fetchReportRows] Last sync lookup error:', lastError)
  }

  return {
    success: true,
    data: {
      rows,
      lastSyncedAt: lastRow?.synced_at ?? null,
      total: rows.length,
    },
  }
}
