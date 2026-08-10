/**
 * WS Task Report View
 *
 * Главный компонент вкладки: поиск по названию, фильтр статуса, дата
 * последней синхронизации, таблица.
 *
 * Кнопки «Обновить» здесь намеренно нет: таблицу наполняет отдельная
 * синхронизация по своему расписанию, приложение о ней не знает.
 */

'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Lock, Search, RefreshCw, X, CalendarDays, Download, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatMinsk, formatMinskDate } from '@/lib/timezone-utils'
import { DateRangePicker, type DateRange } from '@/components/ui/date-picker'
import { ReportTable } from './ReportTable'
import { useWsTaskReport, useWsReportAccess } from '../hooks'
import { exportWsTaskReport } from '../actions/export'
import type { WsTaskStatusFilter, ReportSort } from '../types'

const STATUS_TABS: Array<{ value: WsTaskStatusFilter; label: string }> = [
  { value: 'all', label: 'Все' },
  { value: 'active', label: 'Открытые' },
  { value: 'done', label: 'Закрытые' },
]

export function WsTaskReportView() {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<WsTaskStatusFilter>('all')
  const [dateRange, setDateRange] = useState<DateRange | null>(null)
  const [debouncedSearch, setDebouncedSearch] = useState('')

  // Сортировка живёт здесь, а не в таблице: выгрузка должна повторять экран,
  // а кнопка выгрузки — в шапке
  const [sort, setSort] = useState<ReportSort>({ field: 'date_added', direction: 'desc' })

  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  // Debounce поиска — тот же приём, что в feedback-analytics/AddUserModal
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(timer)
  }, [search])

  const { data: hasAccess, isLoading: accessLoading } = useWsReportAccess()

  const handleClearDates = useCallback(() => setDateRange(null), [])

  const hasDateFilter = !!(dateRange?.from || dateRange?.to)

  const filters = useMemo(
    () => ({
      search: debouncedSearch,
      status,
      // Date → YYYY-MM-DD минского дня; границы суток проставляет Server Action
      dateFrom: dateRange?.from ? formatMinskDate(dateRange.from) : undefined,
      dateTo: dateRange?.to ? formatMinskDate(dateRange.to) : undefined,
    }),
    [debouncedSearch, status, dateRange]
  )

  const { data, isLoading, error } = useWsTaskReport(filters, {
    enabled: hasAccess === true,
  })

  const rowsCount = data?.rows.length ?? 0

  /**
   * Выгрузка в Excel. Книга собирается на сервере — exceljs весит около
   * мегабайта и на клиенте раздул бы бандл страницы. Оттуда приходит base64,
   * здесь превращаем в файл и отдаём браузеру.
   */
  const handleExport = useCallback(async () => {
    setIsExporting(true)
    setExportError(null)

    try {
      const result = await exportWsTaskReport(filters, sort)

      if (!result.success) {
        setExportError(result.error)
        return
      }

      const binary = atob(result.data.base64)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)

      const blob = new Blob([bytes], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })

      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = result.data.fileName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Не удалось выгрузить файл')
    } finally {
      setIsExporting(false)
    }
  }, [filters, sort])

  if (accessLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-background">
        <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground/40" />
      </div>
    )
  }

  if (!hasAccess) {
    return (
      <div className="flex items-center justify-center h-full bg-background">
        <div className="text-center">
          <Lock className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
          <p className="text-sm font-medium text-muted-foreground">Нет доступа к отчёту</p>
        </div>
      </div>
    )
  }

  const lastSynced = data?.lastSyncedAt
    ? formatMinsk(new Date(data.lastSyncedAt), 'dd.MM.yyyy HH:mm')
    : null

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Панель фильтров */}
      <div className="shrink-0 px-4 py-2 border-b flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по названию задачи"
            className="h-8 w-[280px] pl-7 pr-2 text-[12px] rounded-md border bg-background
                       focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div className="flex items-center rounded-md border overflow-hidden">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatus(tab.value)}
              className={cn(
                'h-8 px-3 text-[12px] transition-colors',
                status === tab.value
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted text-muted-foreground'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Диапазон даты открытия.
            ⚠️ inputClassName в DateRangePicker ЗАМЕНЯЕТ дефолтные классы, а не
            дополняет их — поэтому оформление инпута задаём здесь целиком,
            под стать полю поиска слева. */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-muted-foreground whitespace-nowrap">Открыта:</span>

          <div className="relative">
            <CalendarDays
              className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5
                         text-muted-foreground/60 pointer-events-none z-10"
            />
            <DateRangePicker
              value={dateRange}
              onChange={setDateRange}
              placeholder="Любая дата"
              inputWidth="200px"
              inputClassName={cn(
                'h-8 pl-7 text-[12px] rounded-md border border-border bg-background text-foreground',
                'cursor-pointer transition-colors placeholder:text-muted-foreground/60',
                'hover:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary',
                hasDateFilter ? 'pr-7' : 'pr-2'
              )}
            />
            {hasDateFilter && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleClearDates()
                }}
                title="Сбросить период"
                className="absolute right-1 top-1/2 -translate-y-1/2 z-10 h-5 w-5 flex items-center
                           justify-center rounded text-muted-foreground hover:text-foreground
                           hover:bg-muted transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>

        <div className="ml-auto flex items-center gap-3">
          <div className="text-[11px] text-muted-foreground text-right">
            {lastSynced ? (
              <>
                Обновлено: {lastSynced}
                {data ? ` · ${data.total.toLocaleString('ru-RU')} задач` : null}
              </>
            ) : (
              'Данных ещё нет — дождитесь синхронизации'
            )}
            {exportError && (
              <div className="text-destructive">Выгрузка не удалась: {exportError}</div>
            )}
          </div>

          <button
            onClick={handleExport}
            disabled={isExporting || rowsCount === 0}
            title={
              rowsCount === 0
                ? 'Нечего выгружать'
                : `Выгрузить ${rowsCount.toLocaleString('ru-RU')} задач с текущими фильтрами`
            }
            className={cn(
              'h-8 px-3 inline-flex items-center gap-1.5 text-[12px] rounded-md border transition-colors',
              'hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent'
            )}
          >
            {isExporting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            <span>{isExporting ? 'Готовим файл…' : 'Excel'}</span>
          </button>
        </div>
      </div>

      {/* Содержимое */}
      {error ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-2">
            <p className="text-destructive font-medium">Ошибка загрузки отчёта</p>
            <p className="text-sm text-muted-foreground">{error.message}</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0">
          <ReportTable
            rows={data?.rows ?? []}
            isLoading={isLoading && !data}
            sort={sort}
            onSortChange={setSort}
          />
        </div>
      )}
    </div>
  )
}
