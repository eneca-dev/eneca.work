/**
 * WS Task Report - Сортировка
 *
 * Общий модуль для таблицы и выгрузки в Excel: без 'use client' и 'use server',
 * чтобы порядок строк на экране и в файле совпадал буква в букву.
 *
 * @module ws-task-report/utils/sort
 */

import type { WsTaskReportRow, WsTaskReportSortField, SortDirection } from '../types'

/** Плановый бюджет показывается как признак «есть / нет», а не суммой */
export function hasPlannedBudget(value: number | null): boolean {
  if (value === null || value === undefined) return false
  const num = Number(value)
  return Number.isFinite(num) && num !== 0
}

/** Сравнение по одному полю: пустые значения всегда внизу */
function compareField(
  a: WsTaskReportRow,
  b: WsTaskReportRow,
  field: WsTaskReportSortField,
  sign: 1 | -1
): number {
  const left = a[field]
  const right = b[field]

  if (left === null || left === undefined) return right === null || right === undefined ? 0 : 1
  if (right === null || right === undefined) return -1

  if (typeof left === 'number' && typeof right === 'number') {
    return (left - right) * sign
  }

  return String(left).localeCompare(String(right), 'ru') * sign
}

export function compareRows(
  a: WsTaskReportRow,
  b: WsTaskReportRow,
  field: WsTaskReportSortField,
  direction: SortDirection
): number {
  const sign: 1 | -1 = direction === 'asc' ? 1 : -1

  // Плановый бюджет показывается как «есть / нет» — сортируем по признаку,
  // а не по сумме, иначе порядок выглядел бы произвольным
  if (field === 'planned_budget') {
    const leftHas = hasPlannedBudget(a.planned_budget)
    const rightHas = hasPlannedBudget(b.planned_budget)
    if (leftHas === rightHas) return 0
    return (leftHas ? 1 : -1) * sign
  }

  const primary = compareField(a, b, field, sign)
  if (primary !== 0) return primary

  // Внутри объекта группируем по подэтапу, иначе его строки перемешаются
  if (field === 'ws_project_name') {
    return compareField(a, b, 'ws_object_name', sign)
  }

  return 0
}

/** Отсортированная копия — исходный массив не трогаем */
export function sortReportRows(
  rows: WsTaskReportRow[],
  field: WsTaskReportSortField,
  direction: SortDirection
): WsTaskReportRow[] {
  return [...rows].sort((a, b) => compareRows(a, b, field, direction))
}
