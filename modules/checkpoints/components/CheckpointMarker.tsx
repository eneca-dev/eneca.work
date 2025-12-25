'use client'

import { useMemo, useState, useRef, useLayoutEffect } from 'react'
import { format, parseISO, differenceInDays } from 'date-fns'
import type { Checkpoint } from '../actions/checkpoints'
import type { TimelineRange } from '@/modules/resource-graph/types'
import {
  DAY_CELL_WIDTH,
  SECTION_ROW_HEIGHT_WITH_CHECKPOINTS
} from '@/modules/resource-graph/constants'
import { cn } from '@/lib/utils'
import { useCheckpointLinks } from '../context/CheckpointLinksContext'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { getIcon } from '../constants/icon-map'

// ============================================================================
// Constants
// ============================================================================

const MARKER_RADIUS = 8    // Радиус маркера
const ICON_SIZE = 10       // Размер иконки внутри маркера

// Смещение для чекпоинтов на одну дату (вертикальное)
const OVERLAP_OFFSET_Y = 12   // Компактное смещение по Y для каждого следующего чекпоинта

// ============================================================================
// Types
// ============================================================================

interface CheckpointMarkersProps {
  /** Список чекпоинтов раздела */
  checkpoints: Checkpoint[]
  /** Диапазон временной шкалы */
  range: TimelineRange
  /** Общая ширина timeline в пикселях */
  timelineWidth: number
  /** Callback клика на маркер */
  onMarkerClick?: (checkpoint: Checkpoint) => void
  /** ID секции (для регистрации связанных чекпоинтов) */
  sectionId: string
  /** Высота строки (адаптивная) */
  rowHeight?: number
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

/**
 * Преобразует hex цвет в RGB компоненты
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null
}


// ============================================================================
// Markers Container
// ============================================================================

export function CheckpointMarkers({
  checkpoints,
  range,
  timelineWidth,
  onMarkerClick,
  sectionId,
  rowHeight = SECTION_ROW_HEIGHT_WITH_CHECKPOINTS,
}: CheckpointMarkersProps) {
  if (!checkpoints || checkpoints.length === 0) return null

  // Группируем чекпоинты по датам и вычисляем их позиции
  const { checkpointPositions, checkpointsByDate } = useMemo(() => {
    // Группируем по дате
    const byDate = new Map<string, Checkpoint[]>()
    checkpoints.forEach((cp) => {
      const date = cp.checkpoint_date
      if (!byDate.has(date)) {
        byDate.set(date, [])
      }
      byDate.get(date)!.push(cp)
    })

    // Вычисляем позиции для горизонтальной линии (используем базовую позицию без смещения)
    const positions = checkpoints
      .map((cp) => {
        const cpDate = parseISO(cp.checkpoint_date)
        const dayOffset = differenceInDays(cpDate, range.start)
        const x = dayOffset * DAY_CELL_WIDTH + DAY_CELL_WIDTH / 2
        return { checkpoint: cp, x }
      })
      .filter(({ x }) => x >= 0 && x <= timelineWidth)
      .sort((a, b) => a.x - b.x)

    return { checkpointPositions: positions, checkpointsByDate: byDate }
  }, [checkpoints, range, timelineWidth])

  // Y позиция для чекпоинтов — НАД графиком (в верхней части строки)
  // График занимает нижние 56px, чекпоинты — верхнюю часть
  // Компактно: 4px отступ сверху, маркер 16px, 4px отступ снизу = 24px
  const baseY = MARKER_RADIUS + 4  // 8 + 4 = 12px от верха

  return (
    <TooltipProvider>
      <style>{`
        @keyframes checkpoint-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        .animate-pulse-subtle {
          animation: checkpoint-pulse 2.5s ease-in-out infinite;
        }
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* SVG слой - только визуальные элементы */}
      <svg
        className="absolute top-0 left-0 right-0 pointer-events-none overflow-visible z-10"
        style={{ width: timelineWidth, height: rowHeight }}
      >
        {/* Горизонтальная линия, соединяющая чекпоинты */}
        {checkpointPositions.length >= 2 && (
          <line
            x1={checkpointPositions[0].x}
            y1={baseY}
            x2={checkpointPositions[checkpointPositions.length - 1].x}
            y2={baseY}
            stroke="currentColor"
            strokeWidth={1}
            className="text-muted-foreground/20"
          />
        )}

        {/* SVG маркеры - над графиком, вертикально друг под другом при совпадении дат */}
        {checkpoints.map((cp, index) => {
          const checkpointsOnDate = checkpointsByDate.get(cp.checkpoint_date) || [cp]
          const overlapIndex = checkpointsOnDate.findIndex(c => c.checkpoint_id === cp.checkpoint_id)

          return (
            <g
              key={cp.checkpoint_id}
              style={{ animation: `fade-in-up 400ms cubic-bezier(0.16, 1, 0.3, 1) ${index * 50}ms both` }}
            >
              <CheckpointMarkerSvg
                checkpoint={cp}
                range={range}
                timelineWidth={timelineWidth}
                sectionId={sectionId}
                overlapIndex={overlapIndex}
                baseY={baseY}
              />
            </g>
          )
        })}
      </svg>

      {/* HTML слой - тултипы и интерактивность (z-50 для приоритета над sidebar z-20) */}
      <div
        className="absolute top-0 left-0 right-0 pointer-events-none z-50"
        style={{ width: timelineWidth, height: rowHeight }}
      >
        {checkpoints.map((cp) => {
          const checkpointsOnDate = checkpointsByDate.get(cp.checkpoint_date) || [cp]
          const overlapIndex = checkpointsOnDate.findIndex(c => c.checkpoint_id === cp.checkpoint_id)

          return (
            <CheckpointTooltipWrapper
              key={cp.checkpoint_id}
              checkpoint={cp}
              range={range}
              timelineWidth={timelineWidth}
              onMarkerClick={onMarkerClick}
              overlapIndex={overlapIndex}
              baseY={baseY}
              sectionId={sectionId}
            />
          )
        })}
      </div>
    </TooltipProvider>
  )
}

/**
 * SVG часть маркера (без интерактивности)
 */
function CheckpointMarkerSvg({
  checkpoint,
  range,
  timelineWidth,
  sectionId,
  overlapIndex = 0,
  baseY,
}: {
  checkpoint: Checkpoint
  range: TimelineRange
  timelineWidth: number
  sectionId: string
  overlapIndex?: number
  baseY: number
}) {
  const { registerCheckpoint, unregisterCheckpoint } = useCheckpointLinks()
  const circleRef = useRef<SVGCircleElement>(null)

  // Базовая X позиция (центр дня)
  const x = useMemo(() => {
    const cpDate = parseISO(checkpoint.checkpoint_date)
    const dayOffset = differenceInDays(cpDate, range.start)
    return dayOffset * DAY_CELL_WIDTH + DAY_CELL_WIDTH / 2
  }, [checkpoint.checkpoint_date, range.start])

  // Y позиция: базовая + вертикальное смещение для нескольких чекпоинтов на одну дату
  const y = baseY + overlapIndex * OVERLAP_OFFSET_Y

  // Регистрируем чекпоинт для отрисовки линий связей
  // Используем стабильные зависимости: checkpoint_id вместо всего объекта
  const hasLinkedSections = checkpoint.linked_sections && checkpoint.linked_sections.length > 0
  const checkpointId = checkpoint.checkpoint_id

  // Вычисляем реальную позицию через DOM измерения
  useLayoutEffect(() => {
    if (!hasLinkedSections || !circleRef.current) return

    // Находим content wrapper (родитель CheckpointVerticalLinks SVG)
    const circle = circleRef.current
    const contentWrapper = circle.closest('[data-timeline-content]') as HTMLElement | null

    if (!contentWrapper) {
      // Fallback: регистрируем с локальными координатами
      registerCheckpoint({ checkpoint, sectionId, x, y })
      return () => unregisterCheckpoint(checkpointId, sectionId)
    }

    // Вычисляем позицию относительно content wrapper
    // Это даёт координаты в той же системе, что и CheckpointVerticalLinks SVG
    const circleRect = circle.getBoundingClientRect()
    const wrapperRect = contentWrapper.getBoundingClientRect()

    // getBoundingClientRect для circle даёт bounding box (левый верхний угол)
    // Добавляем MARKER_RADIUS чтобы получить центр круга
    const absoluteX = circleRect.left - wrapperRect.left + MARKER_RADIUS
    const absoluteY = circleRect.top - wrapperRect.top + MARKER_RADIUS

    registerCheckpoint({ checkpoint, sectionId, x: absoluteX, y: absoluteY })

    return () => unregisterCheckpoint(checkpointId, sectionId)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- используем checkpointId для стабильности
  }, [checkpointId, sectionId, x, y, hasLinkedSections, registerCheckpoint, unregisterCheckpoint])

  const IconComponent = useMemo(() => getIcon(checkpoint.icon), [checkpoint.icon])

  if (x < 0 || x > timelineWidth) return null

  // Зависимый чекпоинт - тот, у которого owner секция !== текущая секция
  const isDependant = checkpoint.section_id !== sectionId

  // Цвет берётся из типа чекпоинта (или серый для зависимых)
  const baseColor = isDependant ? '#6B7280' : (checkpoint.color || '#6B7280')
  const rgb = hexToRgb(baseColor)
  const bgColorRgba = rgb ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${isDependant ? 0.1 : 0.15})` : 'rgba(107, 114, 128, 0.1)'

  return (
    <g transform={`translate(${x}, ${y})`}>
      <g className={cn("checkpoint-marker", checkpoint.status === 'pending' && !isDependant && "animate-pulse-subtle")}>
        {/* Непрозрачный фоновый круг (скрывает линию под чекпоинтом) */}
        <circle
          ref={circleRef}
          cx={0}
          cy={0}
          r={MARKER_RADIUS}
          className="fill-background"
        />
        {/* Цветной круг поверх фона - цвет из типа */}
        <circle
          cx={0}
          cy={0}
          r={MARKER_RADIUS}
          fill={bgColorRgba}
          stroke={baseColor}
          strokeWidth={isDependant ? 1 : 1.5}
          strokeDasharray={isDependant ? "2,2" : undefined}
          opacity={isDependant ? 0.6 : 1}
        />
        <foreignObject
          x={-ICON_SIZE / 2}
          y={-ICON_SIZE / 2}
          width={ICON_SIZE}
          height={ICON_SIZE}
          className="pointer-events-none overflow-visible"
        >
          <div className="flex items-center justify-center w-full h-full">
            <IconComponent
              size={ICON_SIZE}
              style={{ color: baseColor, opacity: isDependant ? 0.5 : 1 }}
              strokeWidth={2.5}
            />
          </div>
        </foreignObject>
      </g>
    </g>
  )
}

/**
 * HTML обёртка для тултипа с hover эффектом
 */
function CheckpointTooltipWrapper({
  checkpoint,
  range,
  timelineWidth,
  onMarkerClick,
  overlapIndex,
  baseY,
  sectionId,
}: {
  checkpoint: Checkpoint
  range: TimelineRange
  timelineWidth: number
  onMarkerClick?: (checkpoint: Checkpoint) => void
  overlapIndex: number
  baseY: number
  sectionId: string
}) {
  const [isHovered, setIsHovered] = useState(false)

  // Вычисляем X позицию (центр дня)
  const x = useMemo(() => {
    const cpDate = parseISO(checkpoint.checkpoint_date)
    const dayOffset = differenceInDays(cpDate, range.start)
    return dayOffset * DAY_CELL_WIDTH + DAY_CELL_WIDTH / 2
  }, [checkpoint.checkpoint_date, range.start])

  // Y позиция: базовая + вертикальное смещение для нескольких чекпоинтов на одну дату
  const y = baseY + overlapIndex * OVERLAP_OFFSET_Y

  if (x < 0 || x > timelineWidth) return null

  // Зависимый чекпоинт - тот, у которого owner секция !== текущая секция
  const isDependant = checkpoint.section_id !== sectionId

  // Цвет берётся из типа чекпоинта
  const typeColor = isDependant ? '#6B7280' : (checkpoint.color || '#6B7280')
  const linkedSections = checkpoint.linked_sections || []

  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>
        <div
          className={cn(
            "absolute pointer-events-auto cursor-pointer rounded-full transition-transform duration-200",
            isHovered && "scale-110"
          )}
          style={{
            left: x - MARKER_RADIUS - 4,
            top: y - MARKER_RADIUS - 4,
            width: (MARKER_RADIUS + 4) * 2,
            height: (MARKER_RADIUS + 4) * 2,
          }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onClick={() => onMarkerClick?.(checkpoint)}
        />
      </TooltipTrigger>
      <TooltipContent
        side="bottom"
        align="center"
        sideOffset={8}
        className="bg-zinc-900/95 backdrop-blur-xl border border-white/10 shadow-xl shadow-black/40 rounded-lg px-3 py-2.5 max-w-[280px] z-[100]"
        avoidCollisions={true}
        collisionPadding={16}
      >
        <div className="space-y-1.5">
          <div>
            <div className="text-sm font-medium text-white">{checkpoint.title}</div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-white/50">{checkpoint.type_name}</span>
              {isDependant && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/10 text-white/60">
                  зависимый
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 text-[11px]">
            <span className="text-white/60 tabular-nums">
              {format(parseISO(checkpoint.checkpoint_date), 'dd.MM.yyyy')}
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ backgroundColor: typeColor }} />
              <span className="text-[10px] text-white/60">{STATUS_LABELS[checkpoint.status]}</span>
            </span>
          </div>
          {checkpoint.description && (
            <div className="pt-1 border-t border-white/10">
              <p className="text-[11px] text-white/60 leading-relaxed line-clamp-2">{checkpoint.description}</p>
            </div>
          )}
          {checkpoint.completed_at && (
            <div className="text-[10px] text-white/40">
              Выполнен: {format(parseISO(checkpoint.completed_at), 'dd.MM.yyyy')}
            </div>
          )}
          {/* Связанные разделы */}
          {linkedSections.length > 0 && (
            <div className="pt-1.5 border-t border-white/10">
              <div className="text-[10px] text-amber-400/80 font-medium mb-1">
                Связанные разделы ({linkedSections.length}):
              </div>
              <div className="space-y-0.5">
                {linkedSections.slice(0, 3).map((section) => (
                  <div key={section.section_id} className="text-[10px] text-white/50 truncate">
                    • {section.section_name}
                  </div>
                ))}
                {linkedSections.length > 3 && (
                  <div className="text-[10px] text-white/40">
                    и ещё {linkedSections.length - 3}...
                  </div>
                )}
              </div>
            </div>
          )}
          <div className="pt-1 border-t border-white/10 text-[10px] text-white/40">
            Нажмите для редактирования
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  )
}

export default CheckpointMarkers
