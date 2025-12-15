'use client'

import { useMemo } from 'react'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { format, parseISO } from 'date-fns'
import type { Loading, TimelineRange } from '../../types'
import { calculateBarPosition } from './TimelineBar'
import { getEmployeeColor, getInitials } from '../../utils'

// Константы для расчёта высоты
const CHIP_HEIGHT = 18
const CHIP_GAP = 3
const VERTICAL_OFFSET = 3
const MIN_ROW_PADDING = 6

// Отступ от краёв столбцов
const EDGE_PADDING = 4

/**
 * Рассчитать высоту строки на основе количества загрузок
 */
export function calculateLoadingsRowHeight(loadingsCount: number, baseHeight: number): number {
  if (loadingsCount <= 0) return baseHeight

  const loadingsHeight = loadingsCount * (CHIP_HEIGHT + CHIP_GAP) + VERTICAL_OFFSET + MIN_ROW_PADDING
  return Math.max(baseHeight, loadingsHeight)
}

interface LoadingBarsProps {
  /** Загрузки для отображения */
  loadings: Loading[]
  /** Диапазон таймлайна */
  range: TimelineRange
  /** Ширина таймлайна в пикселях */
  timelineWidth: number
}

/**
 * Чипы загрузок на таймлайне
 * Минималистичные пилюли с аватаром и ставкой
 */
export function LoadingBars({ loadings, range, timelineWidth }: LoadingBarsProps) {
  // Фильтруем только активные загрузки
  const activeLoadings = useMemo(() => {
    return loadings.filter(l => l.status === 'active' && !l.isShortage)
  }, [loadings])

  if (activeLoadings.length === 0) return null

  return (
    <TooltipProvider delayDuration={0}>
      <div
        className="absolute inset-x-0 pointer-events-none"
        style={{
          top: VERTICAL_OFFSET,
          height: activeLoadings.length * (CHIP_HEIGHT + CHIP_GAP),
        }}
      >
        {activeLoadings.map((loading, index) => (
          <LoadingChip
            key={loading.id}
            loading={loading}
            range={range}
            chipHeight={CHIP_HEIGHT}
            verticalPosition={index * (CHIP_HEIGHT + CHIP_GAP)}
          />
        ))}
      </div>
    </TooltipProvider>
  )
}

interface LoadingChipProps {
  loading: Loading
  range: TimelineRange
  chipHeight: number
  verticalPosition: number
}

/**
 * Отдельный чип загрузки - минималистичный стиль как status chip
 */
function LoadingChip({ loading, range, chipHeight, verticalPosition }: LoadingChipProps) {
  const position = calculateBarPosition(loading.startDate, loading.finishDate, range)

  if (!position) return null

  // Применяем отступы от краёв столбцов
  const paddedLeft = position.left + EDGE_PADDING
  const paddedWidth = Math.max(position.width - EDGE_PADDING * 2, CHIP_HEIGHT)

  const initials = getInitials(loading.employee.firstName, loading.employee.lastName)
  const hasAvatar = !!loading.employee.avatarUrl
  const isWide = paddedWidth >= 60
  const isMedium = paddedWidth >= 30

  // Цвет на основе ID сотрудника (одинаковый цвет для одного человека)
  const chipColor = getEmployeeColor(loading.employee.id)

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className="
            absolute pointer-events-auto cursor-default
            flex items-center gap-1 px-1
            rounded
            transition-colors duration-150
            hover:brightness-110
          "
          style={{
            left: paddedLeft,
            width: paddedWidth,
            top: verticalPosition,
            height: chipHeight,
            backgroundColor: `${chipColor}1A`, // 10% opacity
            borderWidth: 1,
            borderStyle: 'solid',
            borderColor: `${chipColor}40`, // 25% opacity
          }}
        >
          {/* Avatar */}
          <div
            className="shrink-0 rounded overflow-hidden"
            style={{
              width: chipHeight - 6,
              height: chipHeight - 6,
              backgroundColor: `${chipColor}30`,
            }}
          >
            {hasAvatar ? (
              <img
                src={loading.employee.avatarUrl!}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center text-[7px] font-medium"
                style={{ color: chipColor }}
              >
                {initials}
              </div>
            )}
          </div>

          {/* Name (only if wide enough) */}
          {isWide && (
            <span
              className="text-[10px] truncate min-w-0 flex-1 font-medium"
              style={{ color: chipColor }}
            >
              {loading.employee.lastName || loading.employee.firstName || '—'}
            </span>
          )}

          {/* Rate as number */}
          {isMedium && (
            <span
              className="shrink-0 text-[9px] font-medium tabular-nums opacity-70"
              style={{ color: chipColor }}
            >
              {loading.rate}
            </span>
          )}
        </div>
      </TooltipTrigger>

      <TooltipContent
        side="top"
        align="center"
        sideOffset={8}
        className="
          bg-zinc-900/95 backdrop-blur-xl
          border border-white/10
          shadow-xl shadow-black/40
          rounded-lg px-3 py-2.5
          max-w-[220px]
        "
      >
        <div className="space-y-2">
          {/* Employee info */}
          <div className="flex items-center gap-2">
            <Avatar className="w-6 h-6">
              {hasAvatar && (
                <AvatarImage
                  src={loading.employee.avatarUrl!}
                  alt={loading.employee.name || ''}
                />
              )}
              <AvatarFallback className="text-[9px] bg-zinc-700 text-white/80">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="text-sm font-medium text-white">
                {loading.employee.name || 'Не назначен'}
              </div>
              <div className="text-[10px] text-white/50">
                Ставка: {formatRate(loading.rate)}
              </div>
            </div>
          </div>

          {/* Period */}
          <div className="flex items-center gap-2 text-[11px] text-white/60">
            <span className="text-white/40">Период:</span>
            <span className="tabular-nums">
              {formatDate(loading.startDate)} — {formatDate(loading.finishDate)}
            </span>
          </div>

          {/* Comment */}
          {loading.comment && (
            <div className="pt-1 border-t border-white/10">
              <p className="text-[11px] text-white/60 leading-relaxed">
                {loading.comment}
              </p>
            </div>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  )
}


/**
 * Форматирует ставку
 */
function formatRate(rate: number): string {
  if (rate === 1) return '100%'
  if (rate === 0.5) return '50%'
  if (rate === 0.25) return '25%'
  if (rate === 0.75) return '75%'
  return `${Math.round(rate * 100)}%`
}


/**
 * Форматирует дату
 */
function formatDate(dateStr: string): string {
  try {
    return format(parseISO(dateStr), 'dd.MM')
  } catch {
    return '—'
  }
}
