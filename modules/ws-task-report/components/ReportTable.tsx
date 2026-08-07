/**
 * Report Table
 *
 * Таблица отчёта: 8 колонок, сортировка по клику на заголовок, итоговая строка.
 * Данные плоские — иерархии и ленивой загрузки здесь нет.
 */

'use client'

import { useMemo, useCallback } from 'react'
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatMinsk } from '@/lib/timezone-utils'
import { sortReportRows, hasPlannedBudget } from '../utils/sort'
import type {
  WsTaskReportRow,
  WsTaskReportSortField,
  SortDirection,
  ReportSort,
} from '../types'

// ============================================================================
// Форматирование
// ============================================================================

/** Дата из timestamptz → ДД.ММ.ГГГГ в минском поясе, пусто → прочерк */
function formatDate(value: string | null): string {
  if (!value) return '—'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '—'
  return formatMinsk(parsed, 'dd.MM.yyyy')
}

/** Число с разделителями тысяч; 0 показываем как прочерк */
function formatNumber(value: number | null, digits = 0): string {
  if (value === null || value === undefined) return '—'
  const num = Number(value)
  if (!Number.isFinite(num) || num === 0) return '—'
  return num.toLocaleString('ru-RU', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

// ============================================================================
// Колонки
// ============================================================================

interface ColumnDef {
  field: WsTaskReportSortField
  label: string
  align: 'left' | 'center' | 'right'
  width: string
}

const ALIGN_CLASS: Record<ColumnDef['align'], string> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
}

// Ширины фиксированные (table-fixed): длинные названия переносятся по словам,
// а не растягивают колонку. «Задача» без ширины — забирает остаток.
//
// «Объект» — проект Worksection (в нём же шифр), «Подэтап» — задача 1-го уровня.
// В OS-проектах промежуточного уровня нет, и синхронизация подставляет туда имя
// проекта — как это делает основная синхронизация с объектом-заглушкой. Поэтому
// у таких строк обе колонки совпадают, это ожидаемо.
const COLUMNS: ColumnDef[] = [
  { field: 'ws_project_name', label: 'Объект', align: 'left', width: 'w-[220px]' },
  { field: 'ws_object_name', label: 'Подэтап', align: 'left', width: 'w-[200px]' },
  { field: 'ws_task_name', label: 'Задача', align: 'left', width: 'w-auto' },
  { field: 'date_added', label: 'Открыта', align: 'left', width: 'w-[100px]' },
  { field: 'ws_status', label: 'Статус', align: 'left', width: 'w-[100px]' },
  { field: 'date_closed', label: 'Закрыта', align: 'left', width: 'w-[100px]' },
  { field: 'total_hours', label: 'Часы', align: 'right', width: 'w-[80px]' },
  { field: 'planned_budget', label: 'План. бюджет', align: 'center', width: 'w-[130px]' },
  { field: 'total_money', label: 'Сумма, BYN', align: 'right', width: 'w-[120px]' },
]

// ============================================================================
// Компонент
// ============================================================================

interface ReportTableProps {
  rows: WsTaskReportRow[]
  isLoading?: boolean
  /** Состояние сортировки живёт в WsTaskReportView — им же пользуется выгрузка */
  sort: ReportSort
  onSortChange: (sort: ReportSort) => void
}

export function ReportTable({ rows, isLoading = false, sort, onSortChange }: ReportTableProps) {
  const { field: sortField, direction: sortDirection } = sort

  const handleSort = useCallback(
    (field: WsTaskReportSortField) => {
      const direction: SortDirection =
        sort.field === field
          ? sort.direction === 'asc'
            ? 'desc'
            : 'asc'
          : // Новая колонка: текст логичнее с начала алфавита, даты и числа — с больших
            field === 'ws_project_name' || field === 'ws_object_name' || field === 'ws_task_name'
            ? 'asc'
            : 'desc'

      onSortChange({ field, direction })
    },
    [sort, onSortChange]
  )

  const sortedRows = useMemo(
    () => sortReportRows(rows, sortField, sortDirection),
    [rows, sortField, sortDirection]
  )

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, row) => ({
          hours: acc.hours + Number(row.total_hours ?? 0),
          money: acc.money + Number(row.total_money ?? 0),
          // По плановому бюджету суммировать нечего — считаем, у скольких он есть
          withBudget: acc.withBudget + (hasPlannedBudget(row.planned_budget) ? 1 : 0),
        }),
        { hours: 0, money: 0, withBudget: 0 }
      ),
    [rows]
  )

  if (isLoading) {
    return (
      <div className="p-4 space-y-2">
        {Array.from({ length: 12 }, (_, i) => (
          <div key={i} className="h-8 bg-muted/40 rounded animate-pulse" />
        ))}
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="flex items-center justify-center h-40">
        <p className="text-sm text-muted-foreground">Задач не найдено</p>
      </div>
    )
  }

  return (
    <div className="overflow-auto h-full">
      <table className="w-full text-[12px] border-collapse table-fixed">
        <thead className="sticky top-0 z-10 bg-card">
          <tr className="border-b">
            {COLUMNS.map((column) => {
              const isActive = sortField === column.field
              const Icon = !isActive ? ChevronsUpDown : sortDirection === 'asc' ? ArrowUp : ArrowDown

              return (
                <th
                  key={column.field}
                  className={cn(
                    'px-2 py-2 font-medium text-muted-foreground select-none',
                    column.width,
                    ALIGN_CLASS[column.align]
                  )}
                >
                  <button
                    onClick={() => handleSort(column.field)}
                    className={cn(
                      'inline-flex items-center gap-1 whitespace-nowrap hover:text-foreground transition-colors',
                      isActive && 'text-foreground'
                    )}
                  >
                    {column.align === 'right' && <Icon className="h-3 w-3 shrink-0" />}
                    <span>{column.label}</span>
                    {column.align === 'left' && <Icon className="h-3 w-3 shrink-0" />}
                  </button>
                </th>
              )
            })}
          </tr>
        </thead>

        <tbody>
          {sortedRows.map((row) => {
            const isClosed = row.ws_status === 'done'

            return (
              <tr key={row.ws_task_id} className="border-b border-border/40 hover:bg-muted/30 align-top">
                {/* break-words — длинные шифры без пробелов тоже переносятся,
                    а не распирают колонку */}
                <td className="px-2 py-1.5 break-words">
                  {row.ws_project_name || '—'}
                </td>
                <td className="px-2 py-1.5 break-words text-muted-foreground">
                  {row.ws_object_name || '—'}
                </td>
                <td className="px-2 py-1.5 break-words">
                  {row.ws_task_name}
                </td>
                <td className="px-2 py-1.5 tabular-nums whitespace-nowrap">
                  {formatDate(row.date_added)}
                </td>
                <td className="px-2 py-1.5">
                  <span
                    className={cn(
                      'inline-block px-1.5 py-0.5 rounded text-[11px] whitespace-nowrap',
                      isClosed
                        ? 'bg-muted text-muted-foreground'
                        : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                    )}
                  >
                    {isClosed ? 'Закрыта' : 'Открыта'}
                  </span>
                </td>
                <td className="px-2 py-1.5 tabular-nums whitespace-nowrap">
                  {formatDate(row.date_closed)}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums">
                  {formatNumber(row.total_hours, 1)}
                </td>
                <td className="px-2 py-1.5 text-center">
                  {hasPlannedBudget(row.planned_budget) ? (
                    <span className="text-foreground">есть</span>
                  ) : (
                    <span className="text-muted-foreground/60">нет</span>
                  )}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums font-medium">
                  {formatNumber(row.total_money, 2)}
                </td>
              </tr>
            )
          })}
        </tbody>

        <tfoot className="sticky bottom-0 bg-card">
          <tr className="border-t-2 font-medium">
            {/* colSpan покрывает всё до «Часы»: объект, подэтап, задача,
                открыта, статус, закрыта */}
            <td className="px-2 py-2" colSpan={6}>
              Итого: {rows.length.toLocaleString('ru-RU')}&nbsp;задач
            </td>
            <td className="px-2 py-2 text-right tabular-nums">{formatNumber(totals.hours, 1)}</td>
            <td className="px-2 py-2 text-center text-muted-foreground font-normal whitespace-nowrap">
              есть у {totals.withBudget.toLocaleString('ru-RU')}
            </td>
            <td className="px-2 py-2 text-right tabular-nums">{formatNumber(totals.money, 2)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
