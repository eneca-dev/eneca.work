/**
 * WS Task Report - Выгрузка в Excel
 *
 * Отдельный файл специально ради изоляции exceljs (~23 МБ, 395 файлов) —
 * см. комментарий в actions/index.ts. Экшен вызывается только по клику
 * на кнопку «Excel», поэтому библиотека грузится только тогда, а не на
 * каждое обычное открытие страницы.
 *
 * @module ws-task-report/actions/export
 */

'use server'

import type { ActionResult } from '@/modules/cache'
import type { WsTaskReportFilters, WsTaskReportSortField, SortDirection } from '../types'
import { fetchReportRows } from './fetch-rows'
import { sortReportRows } from '../utils/sort'
import { buildReportWorkbook } from '../utils/build-workbook'

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
