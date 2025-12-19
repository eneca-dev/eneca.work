'use client'

import { useMemo } from 'react'
import { format, parseISO, differenceInDays } from 'date-fns'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip'
import type { Checkpoint } from '../actions/checkpoints'
import type { TimelineRange } from '@/modules/resource-graph/types'
import { DAY_CELL_WIDTH, SECTION_ROW_HEIGHT } from '@/modules/resource-graph/constants'

// ============================================================================
// Types
// ============================================================================

interface CheckpointMarkerProps {
  /** Чекпоинт для отображения */
  checkpoint: Checkpoint
  /** Диапазон временной шкалы */
  range: TimelineRange
  /** Общая ширина timeline в пикселях */
  timelineWidth: number
}

interface CheckpointMarkersProps {
  /** Список чекпоинтов раздела */
  checkpoints: Checkpoint[]
  /** Диапазон временной шкалы */
  range: TimelineRange
  /** Общая ширина timeline в пикселях */
  timelineWidth: number
  /** Callback клика на маркер */
  onMarkerClick?: (checkpoint: Checkpoint) => void
}

// ============================================================================
// Status Colors
// ============================================================================

const STATUS_COLORS: Record<Checkpoint['status'], string> = {
  pending: '#eab308',        // yellow-500
  overdue: '#ef4444',        // red-500
  completed_late: '#f97316', // orange-500
  completed: '#22c55e',      // green-500
}

const STATUS_LABELS: Record<Checkpoint['status'], string> = {
  pending: 'Ожидает',
  overdue: 'Просрочен',
  completed_late: 'Выполнен с опозданием',
  completed: 'Выполнен',
}

// ============================================================================
// Single Marker Component
// ============================================================================

function CheckpointMarker({ checkpoint, range, timelineWidth }: CheckpointMarkerProps) {
  // Рассчитываем позицию X
  const x = useMemo(() => {
    const cpDate = parseISO(checkpoint.checkpoint_date)
    const dayOffset = differenceInDays(cpDate, range.start)
    // Центр ячейки дня
    return dayOffset * DAY_CELL_WIDTH + DAY_CELL_WIDTH / 2
  }, [checkpoint.checkpoint_date, range.start])

  // Проверяем видимость
  if (x < 0 || x > timelineWidth) return null

  // Y позиция — верхняя часть строки (~15% от высоты)
  const y = SECTION_ROW_HEIGHT * 0.15

  // Цвета
  const strokeColor = STATUS_COLORS[checkpoint.status]
  const fillColor = checkpoint.color || '#ffffff'

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <g
          className="cursor-pointer pointer-events-auto"
          style={{ transform: `translate(${x}px, ${y}px)` }}
        >
          <circle
            cx={0}
            cy={0}
            r={5}
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth={2.5}
            className="transition-all duration-150 hover:r-6"
          />
        </g>
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
          max-w-[240px]
        "
      >
        <div className="space-y-1.5">
          {/* Header: Icon + Title */}
          <div className="flex items-center gap-2">
            <span className="text-base">{checkpoint.icon}</span>
            <span className="text-xs font-medium text-white truncate">
              {checkpoint.title}
            </span>
          </div>

          {/* Type */}
          <div className="text-[10px] text-white/50">
            {checkpoint.type_name}
          </div>

          {/* Date + Status */}
          <div className="flex items-center justify-between gap-3 pt-1 border-t border-white/10">
            <span className="text-[11px] text-white/60">
              {format(parseISO(checkpoint.checkpoint_date), 'dd.MM.yyyy')}
            </span>
            <span
              className="text-[10px] font-medium px-1.5 py-0.5 rounded"
              style={{
                backgroundColor: `${strokeColor}20`,
                color: strokeColor,
              }}
            >
              {STATUS_LABELS[checkpoint.status]}
            </span>
          </div>

          {/* Description (if any) */}
          {checkpoint.description && (
            <p className="text-[10px] text-white/50 leading-relaxed pt-1 border-t border-white/10">
              {checkpoint.description}
            </p>
          )}

          {/* Completed info (if completed) */}
          {checkpoint.completed_at && (
            <div className="text-[10px] text-white/40 pt-1">
              Выполнен: {format(parseISO(checkpoint.completed_at), 'dd.MM.yyyy')}
            </div>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  )
}

// ============================================================================
// Markers Container
// ============================================================================

export function CheckpointMarkers({
  checkpoints,
  range,
  timelineWidth,
  onMarkerClick,
}: CheckpointMarkersProps) {
  if (!checkpoints || checkpoints.length === 0) return null

  return (
    <TooltipProvider delayDuration={200}>
      <svg
        className="absolute inset-0 pointer-events-none overflow-visible"
        style={{ width: timelineWidth, height: SECTION_ROW_HEIGHT }}
      >
        {checkpoints.map((cp) => (
          <CheckpointMarker
            key={cp.checkpoint_id}
            checkpoint={cp}
            range={range}
            timelineWidth={timelineWidth}
          />
        ))}
      </svg>
    </TooltipProvider>
  )
}

export default CheckpointMarkers
