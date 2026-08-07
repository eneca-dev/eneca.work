/**
 * WS Task Report - Формирование книги Excel
 *
 * Только сервер: exceljs весит около мегабайта, на клиенте раздул бы бандл
 * страницы. Вызывается из Server Action, наружу отдаётся base64.
 *
 * @module ws-task-report/utils/build-workbook
 */

import ExcelJS from 'exceljs'
import type { WsTaskReportRow } from '../types'
import { hasPlannedBudget } from './sort'

/** Смещение минского пояса: Беларусь круглый год UTC+3, без перехода на летнее */
const MINSK_OFFSET_MS = 3 * 60 * 60 * 1000

/**
 * timestamptz → дата, которую Excel покажет как минский день.
 *
 * Excel хранит даты без пояса и трактует их как локальные. Поэтому сдвигаем
 * момент на +3 часа и отдаём как UTC — иначе задача, открытая в 01:00 по Минску,
 * уехала бы во вчерашний день.
 */
function toExcelDate(value: string | null): Date | null {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return new Date(parsed.getTime() + MINSK_OFFSET_MS)
}

function toNumber(value: number | string | null): number {
  if (value === null || value === undefined) return 0
  const num = Number(value)
  return Number.isFinite(num) ? num : 0
}

interface ColumnSpec {
  header: string
  width: number
  /** Формат Excel; для дат и чисел, чтобы значения оставались значениями */
  numFmt?: string
  align?: 'left' | 'center' | 'right'
}

const COLUMNS: ColumnSpec[] = [
  { header: 'Объект', width: 34 },
  { header: 'Подэтап', width: 30 },
  { header: 'Задача', width: 70 },
  { header: 'Открыта', width: 12, numFmt: 'dd.mm.yyyy', align: 'center' },
  { header: 'Статус', width: 11, align: 'center' },
  { header: 'Закрыта', width: 12, numFmt: 'dd.mm.yyyy', align: 'center' },
  { header: 'Часы', width: 9, numFmt: '# ##0.0', align: 'right' },
  { header: 'План. бюджет', width: 14, align: 'center' },
  { header: 'Сумма, BYN', width: 14, numFmt: '# ##0.00', align: 'right' },
]

/**
 * Собрать книгу Excel из строк отчёта.
 *
 * @param rows - строки уже отфильтрованные и отсортированные так же, как на экране
 * @param meta - подпись о свежести данных и применённых фильтрах
 * @returns буфер xlsx
 */
export async function buildReportWorkbook(
  rows: WsTaskReportRow[],
  meta: { lastSyncedAt: string | null; filtersLabel: string }
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'eneca.work'
  workbook.created = new Date()

  const sheet = workbook.addWorksheet('Отчёт по задачам', {
    views: [{ state: 'frozen', ySplit: 3 }], // шапка и подпись всегда на виду
  })

  // ── Подпись над таблицей: что именно выгружено ────────────────────────────
  const synced = meta.lastSyncedAt
    ? new Date(new Date(meta.lastSyncedAt).getTime() + MINSK_OFFSET_MS)
        .toISOString()
        .replace('T', ' ')
        .slice(0, 16)
    : 'нет данных'

  sheet.mergeCells(1, 1, 1, COLUMNS.length)
  const titleCell = sheet.getCell(1, 1)
  titleCell.value = `Отчёт по задачам Worksection · данные на ${synced} · ${meta.filtersLabel}`
  titleCell.font = { bold: true, size: 11 }
  titleCell.alignment = { vertical: 'middle' }
  sheet.getRow(1).height = 20

  sheet.getRow(2).height = 6 // отбивка

  // ── Шапка ─────────────────────────────────────────────────────────────────
  const headerRow = sheet.getRow(3)
  COLUMNS.forEach((column, index) => {
    const cell = headerRow.getCell(index + 1)
    cell.value = column.header
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E7260' } }
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    cell.border = { bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } } }
  })
  headerRow.height = 22

  COLUMNS.forEach((column, index) => {
    sheet.getColumn(index + 1).width = column.width
  })

  // ── Данные ────────────────────────────────────────────────────────────────
  let totalHours = 0
  let totalMoney = 0
  let withBudget = 0

  for (const row of rows) {
    const hours = toNumber(row.total_hours)
    const money = toNumber(row.total_money)
    const budget = hasPlannedBudget(row.planned_budget)

    totalHours += hours
    totalMoney += money
    if (budget) withBudget++

    const excelRow = sheet.addRow([
      row.ws_project_name ?? '',
      row.ws_object_name ?? '',
      row.ws_task_name,
      toExcelDate(row.date_added),
      row.ws_status === 'done' ? 'Закрыта' : 'Открыта',
      toExcelDate(row.date_closed),
      hours,
      budget ? 'есть' : 'нет',
      money,
    ])

    COLUMNS.forEach((column, index) => {
      const cell = excelRow.getCell(index + 1)
      if (column.numFmt) cell.numFmt = column.numFmt
      cell.alignment = {
        horizontal: column.align ?? 'left',
        vertical: 'top',
        wrapText: index <= 2, // переносим только длинные текстовые колонки
      }
    })
  }

  // ── Итоги ─────────────────────────────────────────────────────────────────
  const totalsRow = sheet.addRow([
    `Итого: ${rows.length} задач`,
    '', '', '', '', '',
    totalHours,
    `есть у ${withBudget}`,
    totalMoney,
  ])

  totalsRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    cell.font = { bold: true }
    cell.border = { top: { style: 'medium', color: { argb: 'FF1E7260' } } }
    const column = COLUMNS[colNumber - 1]
    if (column?.numFmt && colNumber !== 4 && colNumber !== 6) cell.numFmt = column.numFmt
    cell.alignment = { horizontal: column?.align ?? 'left' }
  })

  // Автофильтр по шапке — заказчику удобнее доразобрать данные на месте
  sheet.autoFilter = {
    from: { row: 3, column: 1 },
    to: { row: 3 + rows.length, column: COLUMNS.length },
  }

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}
