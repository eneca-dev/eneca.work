'use client'

import { useMemo } from 'react'
import { format, parseISO, differenceInDays } from 'date-fns'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip'
import type { WorkLog, TimelineRange } from '../../types'
import { DAY_CELL_WIDTH, ROW_HEIGHT } from '../../constants'
import { getEmployeeColor } from '../../utils'

interface WorkLogMarkersProps {
  /** Отчёты о работе для этого item */
  workLogs: WorkLog[]
  /** Диапазон временной шкалы */
  range: TimelineRange
  /** Общая ширина timeline в пикселях */
  timelineWidth: number
  /** Высота строки (для позиционирования) */
  rowHeight?: number
}

interface DayAggregate {
  x: number
  date: Date
  totalHours: number
  totalAmount: number
  logs: WorkLog[]
  /** Основной автор (для цвета) */
  primaryAuthorId: string | null
}

/**
 * Компонент маркеров отчётов о работе
 * Solid chip стиль с цветами сотрудников
 */
export function WorkLogMarkers({
  workLogs,
  range,
  timelineWidth,
  rowHeight = ROW_HEIGHT,
}: WorkLogMarkersProps) {
  // Агрегируем work logs по дням
  const dayAggregates = useMemo(() => {
    if (!workLogs || workLogs.length === 0) return []

    const aggregateMap = new Map<number, DayAggregate>()

    for (const log of workLogs) {
      const logDate = parseISO(log.date)
      const dayIndex = differenceInDays(logDate, range.start)

      // Пропускаем если за пределами диапазона
      if (dayIndex < 0 || dayIndex * DAY_CELL_WIDTH >= timelineWidth) continue

      const x = dayIndex * DAY_CELL_WIDTH

      const existing = aggregateMap.get(dayIndex)
      if (existing) {
        existing.totalHours += log.hours
        existing.totalAmount += log.amount
        existing.logs.push(log)
      } else {
        aggregateMap.set(dayIndex, {
          x,
          date: logDate,
          totalHours: log.hours,
          totalAmount: log.amount,
          logs: [log],
          primaryAuthorId: log.createdBy.id,
        })
      }
    }

    return Array.from(aggregateMap.values())
  }, [workLogs, range.start, timelineWidth])

  if (dayAggregates.length === 0) return null

  return (
    <TooltipProvider delayDuration={0}>
      <div
        className="absolute inset-0 pointer-events-none flex items-center"
        style={{ width: timelineWidth, height: rowHeight }}
      >
        {dayAggregates.map((day) => (
          <WorkLogPill key={day.x} day={day} />
        ))}
      </div>
    </TooltipProvider>
  )
}

interface WorkLogPillProps {
  day: DayAggregate
}

/**
 * Solid chip для отчёта о работе
 * Стиль как у LoadingBars - цветная заливка + рамка
 */
function WorkLogPill({ day }: WorkLogPillProps) {
  const hasMultiple = day.logs.length > 1

  // Цвет на основе ID автора (одинаковый цвет для одного человека)
  const chipColor = getEmployeeColor(day.primaryAuthorId)

  // Проверяем есть ли разные авторы
  const hasMultipleAuthors = hasMultiple && new Set(day.logs.map(l => l.createdBy.id)).size > 1

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className="absolute pointer-events-auto cursor-default group"
          style={{
            left: day.x + 2,
            top: '50%',
            transform: 'translateY(-50%)',
            width: DAY_CELL_WIDTH - 4,
          }}
        >
          {/* Solid chip */}
          <div
            className="
              relative flex items-center justify-center gap-0.5
              h-[20px] rounded
              transition-all duration-150
              hover:brightness-110
            "
            style={{
              backgroundColor: `${chipColor}1A`, // 10% opacity
              borderWidth: 1,
              borderStyle: 'solid',
              borderColor: `${chipColor}40`, // 25% opacity
            }}
          >
            {/* Hours with indicator */}
            <span
              className="text-[10px] font-medium tabular-nums"
              style={{ color: chipColor }}
            >
              {formatHours(day.totalHours)}
              <span className="text-[8px] opacity-70 ml-0.5">ч</span>
            </span>

            {/* Multiple authors indicator */}
            {hasMultipleAuthors && (
              <span
                className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full border"
                style={{
                  backgroundColor: `${chipColor}50`,
                  borderColor: `${chipColor}80`,
                }}
              />
            )}
          </div>
        </div>
      </TooltipTrigger>

      <TooltipContent
        side="top"
        align="center"
        sideOffset={4}
        className="
          bg-zinc-900/95 backdrop-blur-xl
          border border-white/10
          shadow-xl shadow-black/40
          rounded-lg px-3 py-2.5
          max-w-[220px]
        "
      >
        <div className="space-y-2">
          {/* Header with date */}
          <div className="flex items-center justify-between gap-3 pb-1.5 border-b border-white/10">
            <span className="text-[11px] text-white/50">
              {format(day.date, 'dd.MM.yyyy')}
            </span>
            {hasMultiple && (
              <span className="text-[10px] text-white/40 bg-white/5 px-1.5 py-0.5 rounded">
                {day.logs.length} отчёта
              </span>
            )}
          </div>

          {/* Total summary */}
          <div className="flex items-baseline justify-between gap-4">
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-semibold text-white tabular-nums">
                {formatHours(day.totalHours)}
              </span>
              <span className="text-[11px] text-white/40">часов</span>
            </div>
            <div className="text-right">
              <span className="text-sm font-medium text-emerald-400/90 tabular-nums">
                {formatAmount(day.totalAmount)}
              </span>
            </div>
          </div>

          {/* Individual logs (if multiple) */}
          {hasMultiple && (
            <div className="pt-1.5 border-t border-white/10 space-y-2">
              {day.logs.map((log) => {
                const logColor = getEmployeeColor(log.createdBy.id)
                return (
                  <div key={log.id} className="space-y-0.5">
                    <div className="flex items-start justify-between gap-2 text-[11px]">
                      <span className="text-white/60 truncate flex-1 min-w-0">
                        {log.description || 'Без описания'}
                      </span>
                      <span className="tabular-nums shrink-0" style={{ color: logColor }}>
                        {log.hours}ч
                      </span>
                    </div>
                    {log.createdBy.name && (
                      <div className="text-[10px]" style={{ color: `${logColor}99` }}>
                        {log.createdBy.name}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Single log description */}
          {!hasMultiple && day.logs[0]?.description && (
            <p className="text-[11px] text-white/60 leading-relaxed">
              {day.logs[0].description}
            </p>
          )}

          {/* Author (for single log) */}
          {!hasMultiple && day.logs[0]?.createdBy.name && (
            <div className="text-[10px]" style={{ color: `${chipColor}99` }}>
              {day.logs[0].createdBy.name}
            </div>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  )
}

/**
 * Форматирует часы (убираем .0 если целое число)
 */
function formatHours(hours: number): string {
  return hours % 1 === 0 ? `${hours}` : hours.toFixed(1)
}

/**
 * Форматирует сумму (белорусские рубли)
 */
function formatAmount(amount: number): string {
  if (amount >= 1000) {
    return `${(amount / 1000).toFixed(1)}k BYN`
  }
  return `${Math.round(amount)} BYN`
}

/**
 * Заглушка для обратной совместимости
 * Высота строки больше не меняется динамически
 */
export function calculateWorkLogsRowHeight(
  _workLogs: WorkLog[],
  _range: TimelineRange,
  _timelineWidth: number,
  baseRowHeight: number
): number {
  return baseRowHeight
}
