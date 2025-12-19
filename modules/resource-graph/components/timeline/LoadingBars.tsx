'use client'

import { useMemo, useState, useCallback } from 'react'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { MessageSquare } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import type { Loading, TimelineRange } from '../../types'
import { calculateBarPosition } from './TimelineBar'
import { getEmployeeColor, getInitials } from '../../utils'
import { useTimelineResize } from '../../hooks'
import { LoadingModal } from '@/modules/modals'

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
            sectionId={sectionId}
            onResize={onLoadingResize}
          />
        ))}
      </div>
    </TooltipProvider>
  )
}

/** Данные для drag & drop загрузки между этапами */
export interface LoadingDragData {
  loadingId: string
  sectionId: string
  currentStageId: string
  employeeName: string
}

/** MIME тип для drag & drop загрузок */
export const LOADING_DRAG_TYPE = 'application/x-loading-drag'

interface LoadingChipProps {
  loading: Loading
  range: TimelineRange
  chipHeight: number
  verticalPosition: number
  sectionId?: string
  onResize?: (loadingId: string, startDate: string, finishDate: string) => void
}

/**
 * Отдельный чип загрузки - минималистичный стиль с поддержкой resize
 * Клик открывает модалку для редактирования (L2, L3, L4, L6)
 */
function LoadingChip({
  loading,
  range,
  chipHeight,
  verticalPosition,
  sectionId,
  onResize,
}: LoadingChipProps) {
  // State for modal
  const [isModalOpen, setIsModalOpen] = useState(false)
  // State for dragging
  const [isDragging, setIsDragging] = useState(false)

  // Drag handlers for moving between stages
  const handleDragStart = useCallback((e: React.DragEvent) => {
    if (!sectionId) {
      e.preventDefault()
      return
    }

    const dragData: LoadingDragData = {
      loadingId: loading.id,
      sectionId,
      currentStageId: loading.stageId,
      employeeName: loading.employee.name || `${loading.employee.firstName} ${loading.employee.lastName}`,
    }

    e.dataTransfer.setData(LOADING_DRAG_TYPE, JSON.stringify(dragData))
    e.dataTransfer.effectAllowed = 'move'
    setIsDragging(true)

    // Hide tooltip during drag
    const tooltip = document.querySelector('[data-radix-popper-content-wrapper]')
    if (tooltip) {
      ;(tooltip as HTMLElement).style.display = 'none'
    }
  }, [loading, sectionId])

  const handleDragEnd = useCallback(() => {
    setIsDragging(false)
  }, [])

  // Resize hook
  const {
    leftHandleProps,
    rightHandleProps,
    isResizing,
    previewPosition,
    previewDates,
    wasRecentlyDragging,
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

  // Handle click - open modal only if not recently dragging
  const handleChipClick = useCallback((e: React.MouseEvent) => {
    // Prevent if not editable
    if (!sectionId) return

    // Check if this was a drag operation
    if (wasRecentlyDragging()) {
      e.stopPropagation()
      return
    }

    setIsModalOpen(true)
  }, [sectionId, wasRecentlyDragging])

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

  // Контент чипа для отображения
  const chipElement = (
    <div
      onClick={handleChipClick}
      draggable={!!sectionId && !isResizing}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      className={`
        absolute
        flex items-center gap-1 px-1
        rounded
        transition-colors duration-150
        ${isResizing ? 'ring-2 ring-white/30 z-50' : 'hover:brightness-110'}
        ${isDragging ? 'opacity-50 z-50' : ''}
        ${sectionId ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'}
      `}
      style={{
        left: paddedLeft,
        width: paddedWidth,
        top: verticalPosition,
        height: chipHeight,
        backgroundColor: `${chipColor}1A`, // 10% opacity
        borderWidth: 1,
        borderStyle: 'solid',
        borderColor: isResizing || isDragging ? chipColor : `${chipColor}40`, // 25% opacity or full during drag/resize
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

      {/* Comment indicator */}
      {loading.comment && (
        <MessageSquare
          className="shrink-0 w-2.5 h-2.5 opacity-60"
          style={{ color: chipColor }}
        />
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
  )

  // Tooltip с информацией о загрузке
  const tooltipContent = (
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

        {/* Edit hint */}
        {sectionId && !isResizing && (
          <div className="pt-1 border-t border-white/10 text-[10px] text-white/40">
            Нажмите для редактирования
          </div>
        )}
      </div>
    </TooltipContent>
  )

  // Рендерим tooltip с чипом + модалку отдельно
  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>{chipElement}</TooltipTrigger>
        {tooltipContent}
      </Tooltip>

      {/* Модалка редактирования (только если sectionId) */}
      {sectionId && (
        <LoadingModal
          mode="edit"
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          loading={loading}
          sectionId={sectionId}
        />
      )}
    </>
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
