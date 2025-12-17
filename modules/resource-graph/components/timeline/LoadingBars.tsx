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
import { useTimelineResize } from '../../hooks'

// Константы для расчёта высоты
const CHIP_HEIGHT = 18
const CHIP_GAP = 3
const VERTICAL_OFFSET = 3
const MIN_ROW_PADDING = 6

// Отступ от краёв столбцов
const EDGE_PADDING = 4

// Ширина resize handle
const RESIZE_HANDLE_WIDTH = 6

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
  /** ID раздела (для мутации) */
  sectionId?: string
  /** Callback при изменении дат загрузки */
  onLoadingResize?: (loadingId: string, startDate: string, finishDate: string) => void
}

/**
 * Чипы загрузок на таймлайне
 * Минималистичные пилюли с аватаром и ставкой
 * Поддерживают drag-to-resize для изменения дат
 */
export function LoadingBars({
  loadings,
  range,
  timelineWidth,
  sectionId,
  onLoadingResize,
}: LoadingBarsProps) {
  // Фильтруем только активные загрузки
  const activeLoadings = useMemo(() => {
    return loadings.filter(l => l.status === 'active' && !l.isShortage)
  }, [loadings])

  if (activeLoadings.length === 0) return null

  return (
    <TooltipProvider delayDuration={0}>
      <div
        className="absolute inset-x-0"
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
            onResize={onLoadingResize}
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
  onResize?: (loadingId: string, startDate: string, finishDate: string) => void
}

/**
 * Отдельный чип загрузки - минималистичный стиль с поддержкой resize
 */
function LoadingChip({
  loading,
  range,
  chipHeight,
  verticalPosition,
  onResize,
}: LoadingChipProps) {
  // Resize hook
  const {
    leftHandleProps,
    rightHandleProps,
    isResizing,
    previewPosition,
    previewDates,
  } = useTimelineResize({
    startDate: loading.startDate,
    endDate: loading.finishDate,
    range,
    onResize: (newStartDate, newEndDate) => {
      onResize?.(loading.id, newStartDate, newEndDate)
    },
    minDays: 1,
    disabled: !onResize,
  })

  const position = calculateBarPosition(loading.startDate, loading.finishDate, range)

  if (!position) return null

  // Используем preview позицию пока она есть (даже после окончания drag, пока ждём обновления props)
  const displayPosition = previewPosition ?? position

  // Применяем отступы от краёв столбцов
  const paddedLeft = displayPosition.left + EDGE_PADDING
  const paddedWidth = Math.max(displayPosition.width - EDGE_PADDING * 2, CHIP_HEIGHT)

  const initials = getInitials(loading.employee.firstName, loading.employee.lastName)
  const hasAvatar = !!loading.employee.avatarUrl
  const isWide = paddedWidth >= 60
  const isMedium = paddedWidth >= 30

  // Цвет на основе ID сотрудника (одинаковый цвет для одного человека)
  const chipColor = getEmployeeColor(loading.employee.id)

  // Показываем preview даты в tooltip во время resize
  const displayStartDate = isResizing && previewDates ? previewDates.startDate : loading.startDate
  const displayFinishDate = isResizing && previewDates ? previewDates.endDate : loading.finishDate

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={`
            absolute
            flex items-center gap-1 px-1
            rounded
            transition-colors duration-150
            ${isResizing ? 'ring-2 ring-white/30 z-50' : 'hover:brightness-110'}
            ${onResize ? 'cursor-default' : 'cursor-default pointer-events-auto'}
          `}
          style={{
            left: paddedLeft,
            width: paddedWidth,
            top: verticalPosition,
            height: chipHeight,
            backgroundColor: `${chipColor}1A`, // 10% opacity
            borderWidth: 1,
            borderStyle: 'solid',
            borderColor: isResizing ? chipColor : `${chipColor}40`, // 25% opacity or full during resize
          }}
        >
          {/* Left resize handle */}
          {onResize && (
            <div
              {...leftHandleProps}
              className="absolute top-0 bottom-0 hover:bg-white/20 transition-colors group"
              style={{
                ...leftHandleProps.style,
                left: -RESIZE_HANDLE_WIDTH / 2,
                width: RESIZE_HANDLE_WIDTH,
              }}
            >
              <div
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-0.5 h-2/3 rounded-full bg-white/0 group-hover:bg-white/40 transition-colors"
              />
            </div>
          )}

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

          {/* Right resize handle */}
          {onResize && (
            <div
              {...rightHandleProps}
              className="absolute top-0 bottom-0 hover:bg-white/20 transition-colors group"
              style={{
                ...rightHandleProps.style,
                right: -RESIZE_HANDLE_WIDTH / 2,
                width: RESIZE_HANDLE_WIDTH,
              }}
            >
              <div
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-0.5 h-2/3 rounded-full bg-white/0 group-hover:bg-white/40 transition-colors"
              />
            </div>
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

          {/* Period - показываем preview даты во время resize */}
          <div className="flex items-center gap-2 text-[11px] text-white/60">
            <span className="text-white/40">Период:</span>
            <span className={`tabular-nums ${isResizing ? 'text-white font-medium' : ''}`}>
              {formatDate(displayStartDate)} — {formatDate(displayFinishDate)}
            </span>
          </div>

          {/* Resize hint */}
          {isResizing && (
            <div className="pt-1 border-t border-white/10 text-[10px] text-white/40">
              Отпустите для сохранения
            </div>
          )}

          {/* Comment */}
          {loading.comment && !isResizing && (
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
