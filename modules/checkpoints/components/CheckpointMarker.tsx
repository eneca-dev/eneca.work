'use client'

import { useMemo, useState, useRef, useLayoutEffect } from 'react'
import { parseISO, differenceInDays, format } from 'date-fns'
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
import { AlertTriangle, CheckCircle } from 'lucide-react'
import { ResolveProblemModal } from './ResolveProblemModal'

// ============================================================================
// Constants
// ============================================================================

const MARKER_RADIUS = 8    // Радиус маркера для обычных чекпоинтов
const PROBLEM_MARKER_RADIUS = 11  // Радиус маркера для проблемных чекпоинтов (диаметр 22px)
const ICON_SIZE = 10       // Размер иконки внутри маркера
const PROBLEM_ICON_SIZE = 14  // Размер иконки для проблемных чекпоинтов

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
  // MOCK DATA - prototype: state для модалки решения проблемы
  const [resolveProblemModal, setResolveProblemModal] = useState<{
    checkpoint: Checkpoint | null
    initialCloseProblem: boolean
  }>({
    checkpoint: null,
    initialCloseProblem: false,
  })

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
  // Используем больший радиус для проблемных чекпоинтов: 11 + 4 = 15px от верха
  const baseY = PROBLEM_MARKER_RADIUS + 4  // 11 + 4 = 15px от верха (учитываем максимальный размер)

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
              onOpenResolveProblem={(checkpoint, initialCloseProblem = false) =>
                setResolveProblemModal({ checkpoint, initialCloseProblem })
              }
            />
          )
        })}
      </div>

      {/* MOCK DATA - prototype: модалка решения проблемы */}
      <ResolveProblemModal
        open={resolveProblemModal.checkpoint !== null}
        onClose={() => setResolveProblemModal({ checkpoint: null, initialCloseProblem: false })}
        checkpoint={resolveProblemModal.checkpoint}
        initialCloseProblem={resolveProblemModal.initialCloseProblem}
      />
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
  const { registerCheckpoint, unregisterCheckpoint, layoutVersion } = useCheckpointLinks()
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
  // FIX RG-001: Добавлен layoutVersion в зависимости - при expand/collapse других строк
  // позиции пересчитываются через getBoundingClientRect()
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
    // Добавляем радиус маркера чтобы получить центр круга
    const markerRadius = checkpoint.is_problem ? PROBLEM_MARKER_RADIUS : MARKER_RADIUS
    const absoluteX = circleRect.left - wrapperRect.left + markerRadius
    const absoluteY = circleRect.top - wrapperRect.top + markerRadius

    registerCheckpoint({ checkpoint, sectionId, x: absoluteX, y: absoluteY })

    return () => unregisterCheckpoint(checkpointId, sectionId)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- используем checkpointId для стабильности, layoutVersion для пересчёта при expand/collapse
  }, [checkpointId, sectionId, x, y, hasLinkedSections, layoutVersion, registerCheckpoint, unregisterCheckpoint])

  const IconComponent = useMemo(() => getIcon(checkpoint.icon), [checkpoint.icon])

  if (x < 0 || x > timelineWidth) return null

  // Зависимый чекпоинт - тот, у которого owner секция !== текущая секция
  const isDependant = checkpoint.section_id !== sectionId
  const isCompleted = checkpoint.status === 'completed' || checkpoint.status === 'completed_late'

  // MOCK DATA - prototype: проблемный чекпоинт
  const isProblem = checkpoint.is_problem === true
  // MOCK DATA - prototype: решенная проблема (была проблемой, но теперь решена)
  const isResolvedProblem = !isProblem && checkpoint.problem_resolutions && checkpoint.problem_resolutions.length > 0

  // Радиус: больше для проблемных чекпоинтов
  const markerRadius = isProblem ? PROBLEM_MARKER_RADIUS : MARKER_RADIUS
  const iconSize = isProblem ? PROBLEM_ICON_SIZE : ICON_SIZE

  // Цвет: красный для активных проблем, янтарный для решенных, серый для зависимых и выполненных, иначе цвет типа
  let baseColor = checkpoint.color || '#6B7280'
  if (isProblem) {
    baseColor = '#ef4444' // red-500 для активных проблем
  } else if (isResolvedProblem) {
    baseColor = '#f59e0b' // amber-500 для решенных проблем
  } else if (isDependant) {
    baseColor = '#6B7280'
  } else if (isCompleted) {
    baseColor = '#9CA3AF'
  }

  const rgb = hexToRgb(baseColor)
  let bgColorRgba = rgb ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${isDependant ? 0.1 : isCompleted ? 0.12 : 0.15})` : 'rgba(107, 114, 128, 0.1)'

  // Для проблемных чекпоинтов: красный фон
  if (isProblem) {
    bgColorRgba = '#fecaca' // red-200 для активных проблем
  } else if (isResolvedProblem) {
    bgColorRgba = '#fde68a' // amber-200 для решенных проблем
  }

  return (
    <g transform={`translate(${x}, ${y})`}>
      <g className={cn(
        "checkpoint-marker",
        checkpoint.status === 'pending' && !isDependant && "animate-pulse-subtle",
        isProblem && "animate-pulse-subtle" // Проблемные чекпоинты всегда пульсируют
      )}>
        {/* Непрозрачный фоновый круг (скрывает линию под чекпоинтом) */}
        <circle
          ref={circleRef}
          cx={0}
          cy={0}
          r={markerRadius}
          className="fill-background"
        />
        {/* Цветной круг поверх фона - цвет из типа */}
        <circle
          cx={0}
          cy={0}
          r={markerRadius}
          fill={bgColorRgba}
          stroke={baseColor}
          strokeWidth={isProblem ? 2 : isDependant ? 1 : 1.5}
          strokeDasharray={isDependant ? "2,2" : undefined}
          opacity={isDependant ? 0.6 : 1}
        />
        <foreignObject
          x={-iconSize / 2}
          y={-iconSize / 2}
          width={iconSize}
          height={iconSize}
          className="pointer-events-none overflow-visible"
        >
          <div className="flex items-center justify-center w-full h-full">
            {isProblem ? (
              <AlertTriangle
                size={iconSize}
                style={{ color: baseColor }}
                strokeWidth={2.5}
              />
            ) : isResolvedProblem ? (
              <CheckCircle
                size={iconSize}
                style={{ color: baseColor }}
                strokeWidth={2.5}
              />
            ) : (
              <IconComponent
                size={iconSize}
                style={{ color: baseColor, opacity: isDependant ? 0.5 : 1 }}
                strokeWidth={2.5}
              />
            )}
          </div>
        </foreignObject>
        {/* Зелёная галочка для выполненных чекпоинтов */}
        {isCompleted && !isDependant && (
          <g transform={`translate(${MARKER_RADIUS - 3}, ${-MARKER_RADIUS + 1})`}>
            <circle cx={0} cy={0} r={4} fill="#22c55e" />
            <path
              d="M -2 0 L -0.5 1.5 L 2 -1.5"
              stroke="white"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </g>
        )}
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
  onOpenResolveProblem,
}: {
  checkpoint: Checkpoint
  range: TimelineRange
  timelineWidth: number
  onMarkerClick?: (checkpoint: Checkpoint) => void
  overlapIndex: number
  baseY: number
  sectionId: string
  onOpenResolveProblem?: (checkpoint: Checkpoint, initialCloseProblem?: boolean) => void
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
  const isCompleted = checkpoint.status === 'completed' || checkpoint.status === 'completed_late'

  // MOCK DATA - prototype: проблемный чекпоинт
  const isProblem = checkpoint.is_problem === true
  // MOCK DATA - prototype: решенная проблема (была проблемой, но теперь решена)
  const isResolvedProblem = !isProblem && checkpoint.problem_resolutions && checkpoint.problem_resolutions.length > 0

  // Радиус: больше для проблемных чекпоинтов
  const markerRadius = isProblem ? PROBLEM_MARKER_RADIUS : MARKER_RADIUS

  // Цвет: красный для активных проблем, янтарный для решенных, серый для зависимых и выполненных, иначе цвет типа
  let typeColor = checkpoint.color || '#6B7280'
  if (isProblem) {
    typeColor = '#ef4444' // red-500 для активных проблем
  } else if (isResolvedProblem) {
    typeColor = '#f59e0b' // amber-500 для решенных проблем
  } else if (isDependant) {
    typeColor = '#6B7280'
  } else if (isCompleted) {
    typeColor = '#9CA3AF'
  }

  const linkedSections = checkpoint.linked_sections || []

  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>
        <div
          className="absolute pointer-events-auto cursor-pointer"
          style={{
            left: x - markerRadius - 4,
            top: y - markerRadius - 4,
            width: (markerRadius + 4) * 2,
            height: (markerRadius + 4) * 2,
          }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onClick={() => onMarkerClick?.(checkpoint)}
        >
          {/* Glow effect - отдельный элемент точно по размеру маркера */}
          <div
            className="absolute rounded-full transition-all duration-200 pointer-events-none"
            style={{
              left: 4,
              top: 4,
              width: markerRadius * 2,
              height: markerRadius * 2,
              boxShadow: isHovered ? `0 0 ${isProblem ? 12 : 8}px 0 ${typeColor}` : 'none',
              transform: isHovered ? 'scale(1.15)' : 'scale(1)',
            }}
          />
        </div>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        align="center"
        sideOffset={12}
        className="bg-slate-900/95 backdrop-blur-md border border-slate-700/50 shadow-2xl shadow-black/50 rounded-lg p-0 max-w-[280px] z-[100]"
        avoidCollisions={true}
        collisionPadding={16}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-700/50">
          <div
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: isCompleted ? '#22c55e' : typeColor }}
          />
          <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">
            Чекпоинт
          </span>
          {/* MOCK DATA - prototype: бейдж проблемы */}
          {isProblem && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 flex-shrink-0 flex items-center gap-1">
              <AlertTriangle size={10} />
              ПРОБЛЕМА
            </span>
          )}
          {/* MOCK DATA - prototype: бейдж решенной проблемы */}
          {isResolvedProblem && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 flex-shrink-0 flex items-center gap-1">
              <CheckCircle size={10} />
              РЕШЕНО
            </span>
          )}
          {isCompleted && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 flex-shrink-0">
              выполнен
            </span>
          )}
          {isDependant && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-500 flex-shrink-0">
              связь
            </span>
          )}
        </div>

        {/* Body */}
        <div className="px-3 py-2 space-y-2">
          {/* Title */}
          <div className="text-xs font-medium text-slate-200 leading-tight">
            {checkpoint.title}
          </div>

          {/* Description (Комментарий) */}
          {checkpoint.description && (
            <div>
              <div className="text-[9px] text-slate-500 uppercase tracking-wide mb-0.5">
                Комментарий
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-2">
                {checkpoint.description}
              </p>
            </div>
          )}

          {/* Linked sections as chips */}
          {linkedSections.length > 0 && (
            <div className="pt-1.5 border-t border-slate-700/50">
              <div className="text-[9px] text-slate-500 uppercase tracking-wide mb-1.5">
                Связанные разделы
              </div>
              <div className="flex flex-wrap gap-1">
                {linkedSections.slice(0, 4).map((section) => (
                  <span
                    key={section.section_id}
                    className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] bg-amber-500/15 text-amber-400/90 border border-amber-500/20 truncate max-w-[120px]"
                    title={section.section_name}
                  >
                    {section.section_name}
                  </span>
                ))}
                {linkedSections.length > 4 && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] bg-slate-700/50 text-slate-400">
                    +{linkedSections.length - 4}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* MOCK DATA - prototype: история решений */}
          {checkpoint.problem_resolutions && checkpoint.problem_resolutions.length > 0 && (
            <div className="pt-1.5 border-t border-slate-700/50">
              <div className="text-[9px] text-slate-500 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                <CheckCircle className="h-3 w-3 text-amber-400" />
                История решений ({checkpoint.problem_resolutions.length})
              </div>
              <div className="space-y-1.5 max-h-[140px] overflow-y-auto">
                {checkpoint.problem_resolutions.map((resolution) => {
                  const isClosed = resolution.action_type === 'closed'
                  return (
                    <div
                      key={resolution.resolution_id}
                      className={`p-2 rounded border space-y-1 ${
                        isClosed
                          ? 'bg-green-500/10 border-green-500/30'
                          : 'bg-slate-800/50 border-slate-700/30'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1">
                          {isClosed ? (
                            <CheckCircle className="h-3 w-3 text-green-400" />
                          ) : (
                            <AlertTriangle className="h-3 w-3 text-blue-400" />
                          )}
                          <span className="text-[9px] font-medium text-slate-300">
                            {resolution.resolved_by_name}
                          </span>
                        </div>
                        <span className="text-[8px] text-slate-500 tabular-nums">
                          {format(parseISO(resolution.resolved_at), 'dd.MM.yyyy HH:mm')}
                        </span>
                      </div>
                      {isClosed ? (
                        <p className="text-[9px] text-green-400 font-medium">
                          Проблема закрыта
                        </p>
                      ) : (
                        <p className="text-[10px] text-slate-400 leading-relaxed line-clamp-2">
                          {resolution.comment}
                        </p>
                      )}
                      {resolution.deadline_shift_days !== 0 && (
                        <p className="text-[9px] text-amber-400">
                          Сдвиг: {resolution.deadline_shift_days > 0 ? '+' : ''}{resolution.deadline_shift_days} дн.
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* MOCK DATA - prototype: кнопки для работы с проблемой */}
          {isProblem && (
            <div className="pt-2 border-t border-slate-700/50 space-y-1.5">
              <button
                className="w-full px-2 py-1.5 rounded text-[11px] font-medium bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors flex items-center justify-center gap-1.5"
                onClick={(e) => {
                  e.stopPropagation()
                  onOpenResolveProblem?.(checkpoint, false)
                }}
              >
                <AlertTriangle size={12} />
                Добавить комментарий
              </button>
              <button
                className="w-full px-2 py-1.5 rounded text-[11px] font-medium bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors flex items-center justify-center gap-1.5"
                onClick={(e) => {
                  e.stopPropagation()
                  onOpenResolveProblem?.(checkpoint, true)
                }}
              >
                <CheckCircle size={12} />
                Закрыть проблему
              </button>
            </div>
          )}

          {/* Date at bottom */}
          <div className="pt-1.5 border-t border-slate-700/50 text-[10px] text-slate-500 tabular-nums">
            {format(parseISO(checkpoint.checkpoint_date), 'dd.MM.yyyy')}
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  )
}

export default CheckpointMarkers
