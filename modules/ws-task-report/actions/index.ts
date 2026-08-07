/**
 * WS Task Report - Server Actions
 *
 * Чтение снимка задач Worksection из ws_task_report.
 * Таблицу наполняет отдельная синхронизация (ws-to-work/task-report),
 * приложение только читает.
 *
 * Доступ: RLS на ws_task_report пускает только тех, кто есть в
 * ws_task_report_access. Проверка ниже — второй барьер, чтобы отдать
 * понятную ошибку вместо пустого списка.
 *
 * @module ws-task-report/actions
 */

'use server'

import { createClient } from '@/utils/supabase/server'
import type { ActionResult } from '@/modules/cache'
import type {
  WsTaskReportRow,
  WsTaskReportFilters,
  WsTaskReportData,
  WsTaskReportSortField,
  SortDirection,
} from '../types'
import { sortReportRows } from '../utils/sort'
import { buildReportWorkbook } from '../utils/build-workbook'

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
async function checkAccess(
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
 * Общая выборка для таблицы и выгрузки — чтобы фильтры между ними
 * не разъехались при будущих правках.
 *
 * Возвращает строки и момент последней синхронизации по всей таблице.
 * Проверку доступа делает сама.
 */
async function fetchReportRows(
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

/** Человекочитаемая подпись применённых фильтров — уходит в шапку файла */
function describeFilters(filters?: WsTaskReportFilters): string {
  const parts: string[] = []

  const search = filters?.search?.trim()
  if (search) parts.push(`поиск: «${search}»`)

  if (filters?.status === 'active') parts.push('только открытые')
  if (filters?.status === 'done') parts.push('только закрытые')

  if (filters?.dateFrom && filters?.dateTo) {
    parts.push(`открыты ${filters.dateFrom} — ${filters.dateTo}`)
  } else if (filters?.dateFrom) {
    parts.push(`открыты с ${filters.dateFrom}`)
  } else if (filters?.dateTo) {
    parts.push(`открыты по ${filters.dateTo}`)
  }

  return parts.length > 0 ? parts.join(', ') : 'без фильтров'
}

/**
 * Выгрузка отчёта в Excel.
 *
 * Данные берутся тем же запросом, что и таблица, и сортируются тем же
 * компаратором — файл повторяет экран строка в строку.
 *
 * Книга собирается на сервере: exceljs весит около мегабайта и на клиенте
 * раздул бы бандл страницы. Наружу отдаём base64 — клиент соберёт Blob.
 */
export async function exportWsTaskReport(
  filters: WsTaskReportFilters | undefined,
  sort: { field: WsTaskReportSortField; direction: SortDirection }
): Promise<ActionResult<{ fileName: string; base64: string; rows: number }>> {
  try {
    const result = await fetchReportRows(filters)
    if (!result.success) return { success: false, error: result.error }

    const sorted = sortReportRows(result.data.rows, sort.field, sort.direction)

    const buffer = await buildReportWorkbook(sorted, {
      lastSyncedAt: result.data.lastSyncedAt,
      filtersLabel: describeFilters(filters),
    })

    // Дата в имени — минский день, чтобы файлы за разные дни не сливались
    const today = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10)

    return {
      success: true,
      data: {
        fileName: `otchet-po-zadacham_${today}.xlsx`,
        base64: buffer.toString('base64'),
        rows: sorted.length,
      },
    }
  } catch (error) {
    console.error('[exportWsTaskReport] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ошибка формирования файла',
    }
  }
}
