'use client'

import { useMemo, useState, useEffect } from 'react'
import { format, parseISO, differenceInDays } from 'date-fns'
import {
  ArrowRightFromLine,
  Flag,
  Bookmark,
  HelpCircle,
  Star,
  AlertCircle,
  CheckCircle,
  Calendar,
  Clock,
  Target,
  Trophy,
  Award,
  FileCheck,
  FileText,
  Send,
  Milestone,
  Rocket,
  Zap,
  Bell,
  Eye,
  Lock,
  Unlock,
  Shield,
  Heart,
  ThumbsUp,
  MessageSquare,
  CircleCheck,
  CircleDot,
  Hourglass,
  Timer,
  AlarmCheck,
  Sparkles,
  Flame,
  Bolt,
  TrendingUp,
  Activity,
  BarChart3,
  PieChart,
  LineChart,
  GitCommit,
  GitBranch,
  Users,
  User,
  UserCheck,
  Crown,
  Gem,
  Diamond,
  Box,
  Package,
  Inbox,
  Archive,
  FolderCheck,
  FolderOpen,
  Files,
  ClipboardCheck,
  Layers,
  CircleAlert,
  TriangleAlert,
  Info,
  Ban,
  XCircle,
  MinusCircle,
  PlusCircle,
  Play,
  Pause,
  type LucideIcon,
} from 'lucide-react'
import type { Checkpoint } from '../actions/checkpoints'
import type { TimelineRange } from '@/modules/resource-graph/types'
import {
  DAY_CELL_WIDTH,
  SECTION_ROW_HEIGHT,
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

// ============================================================================
// Constants
// ============================================================================

const MARKER_RADIUS = 10   // Увеличили для лучшей видимости
const ICON_SIZE = 12       // Размер иконки внутри маркера

// Смещение для чекпоинтов на одну дату (вертикальное)
const OVERLAP_OFFSET_Y = 18   // Смещение по Y для каждого следующего чекпоинта

// ============================================================================
// Icon Helper
// ============================================================================

// Маппинг названий иконок на компоненты
// Все иконки, доступные для выбора в CheckpointCreateModal
const ICON_MAP: Record<string, LucideIcon> = {
  // Основные иконки чекпоинтов
  Flag,
  Bookmark,
  Star,
  AlertCircle,
  CheckCircle,
  Calendar,
  Clock,
  Target,
  Trophy,
  Award,

  // Документы и файлы
  FileCheck,
  FileText,
  Files,
  FolderCheck,
  FolderOpen,
  ClipboardCheck,

  // Действия и события
  Send,
  ArrowRightFromLine,
  Milestone,
  Rocket,
  Zap,
  Bell,

  // Состояния и индикаторы
  Eye,
  Lock,
  Unlock,
  Shield,
  Heart,
  ThumbsUp,
  MessageSquare,
  CircleCheck,
  CircleDot,

  // Время
  Hourglass,
  Timer,
  AlarmCheck,

  // Специальные эффекты
  Sparkles,
  Flame,
  Bolt,

  // Графики и аналитика
  TrendingUp,
  Activity,
  BarChart3,
  PieChart,
  LineChart,

  // Git и версионирование
  GitCommit,
  GitBranch,

  // Пользователи
  Users,
  User,
  UserCheck,

  // Награды
  Crown,
  Gem,
  Diamond,

  // Организация
  Box,
  Package,
  Inbox,
  Archive,
  Layers,

  // Предупреждения
  CircleAlert,
  TriangleAlert,
  Info,
  Ban,
  XCircle,
  MinusCircle,
  PlusCircle,

  // Управление
  Play,
  Pause,

  // Fallback иконка для неизвестных типов
  HelpCircle,
}

/**
 * Получить компонент иконки Lucide по названию
 */
function getLucideIcon(iconName: string): LucideIcon {
  return ICON_MAP[iconName] || HelpCircle
}

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
  /** ID секции (для регистрации связанных чекпоинтов) */
  sectionId: string
  /** Абсолютная Y позиция строки секции от верха timeline (в пикселях) */
  absoluteRowY: number
  /** Callback клика на маркер */
  onMarkerClick?: (checkpoint: Checkpoint) => void
  /** Индекс наложения (для смещения при одной дате) */
  overlapIndex?: number
  /** Общее количество чекпоинтов на эту дату */
  overlapTotal?: number
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
  /** ID секции (для регистрации связанных чекпоинтов) */
  sectionId: string
  /** Абсолютная Y позиция строки секции от верха timeline (в пикселях) */
  absoluteRowY: number
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
  absoluteRowY,
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

  // Y позиция для чекпоинтов — ПОД графиком (с отступом от графика)
  // SECTION_ROW_HEIGHT = 56 (высота графика)
  // Добавляем отступ + радиус маркера чтобы не пересекаться с графиком
  const baseY = SECTION_ROW_HEIGHT + MARKER_RADIUS + 6  // 56 + 10 + 6 = 72px

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
        style={{ width: timelineWidth, height: SECTION_ROW_HEIGHT_WITH_CHECKPOINTS }}
      >
        {/* SVG маркеры - расположены под графиком, вертикально друг под другом при совпадении дат */}
        {checkpoints.map((cp, index) => {
          const checkpointsOnDate = checkpointsByDate.get(cp.checkpoint_date) || [cp]
          const overlapIndex = checkpointsOnDate.findIndex(c => c.checkpoint_id === cp.checkpoint_id)
          const overlapTotal = checkpointsOnDate.length

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
                absoluteRowY={absoluteRowY}
                overlapIndex={overlapIndex}
                overlapTotal={overlapTotal}
                baseY={baseY}
              />
            </g>
          )
        })}
      </svg>

      {/* HTML слой - тултипы и интерактивность */}
      <div
        className="absolute top-0 left-0 right-0 pointer-events-none z-20"
        style={{ width: timelineWidth, height: SECTION_ROW_HEIGHT_WITH_CHECKPOINTS }}
      >
        {checkpoints.map((cp) => {
          const checkpointsOnDate = checkpointsByDate.get(cp.checkpoint_date) || [cp]
          const overlapIndex = checkpointsOnDate.findIndex(c => c.checkpoint_id === cp.checkpoint_id)
          const overlapTotal = checkpointsOnDate.length

          return (
            <CheckpointTooltipWrapper
              key={cp.checkpoint_id}
              checkpoint={cp}
              range={range}
              timelineWidth={timelineWidth}
              onMarkerClick={onMarkerClick}
              overlapIndex={overlapIndex}
              overlapTotal={overlapTotal}
              baseY={baseY}
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
  absoluteRowY,
  overlapIndex,
  overlapTotal,
  baseY,
}: Omit<CheckpointMarkerProps, 'onMarkerClick'> & { baseY: number }) {
  const { registerCheckpoint, unregisterCheckpoint } = useCheckpointLinks()

  // Базовая X позиция (центр дня)
  const x = useMemo(() => {
    const cpDate = parseISO(checkpoint.checkpoint_date)
    const dayOffset = differenceInDays(cpDate, range.start)
    return dayOffset * DAY_CELL_WIDTH + DAY_CELL_WIDTH / 2
  }, [checkpoint.checkpoint_date, range.start])

  // Y позиция: базовая + вертикальное смещение для нескольких чекпоинтов на одну дату
  const y = baseY + overlapIndex * OVERLAP_OFFSET_Y
  const absoluteY = absoluteRowY + y

  useEffect(() => {
    if (checkpoint.linked_sections && checkpoint.linked_sections.length > 0) {
      registerCheckpoint({ checkpoint, sectionId, x, y: absoluteY, overlapIndex, overlapTotal })
    }
    return () => {
      if (checkpoint.linked_sections && checkpoint.linked_sections.length > 0) {
        unregisterCheckpoint(checkpoint.checkpoint_id, sectionId)
      }
    }
  }, [checkpoint, sectionId, x, absoluteY, overlapIndex, overlapTotal, registerCheckpoint, unregisterCheckpoint])

  const IconComponent = useMemo(() => getLucideIcon(checkpoint.icon), [checkpoint.icon])

  if (x < 0 || x > timelineWidth) return null

  const statusColor = STATUS_COLORS[checkpoint.status]
  const baseColor = checkpoint.color || '#6B7280'
  const rgb = hexToRgb(baseColor)
  const bgColorRgba = rgb ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.15)` : 'rgba(107, 114, 128, 0.15)'

  return (
    <g transform={`translate(${x}, ${y})`}>
      <g className={cn("checkpoint-marker", checkpoint.status === 'pending' && "animate-pulse-subtle")}>
        <circle
          cx={0}
          cy={0}
          r={MARKER_RADIUS}
          fill={bgColorRgba}
          stroke={statusColor}
          strokeWidth={1.5}
        />
        <foreignObject
          x={-ICON_SIZE / 2}
          y={-ICON_SIZE / 2}
          width={ICON_SIZE}
          height={ICON_SIZE}
          className="pointer-events-none overflow-visible"
        >
          <div className="flex items-center justify-center w-full h-full">
            <IconComponent size={ICON_SIZE} style={{ color: baseColor }} strokeWidth={2.5} />
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
}: {
  checkpoint: Checkpoint
  range: TimelineRange
  timelineWidth: number
  onMarkerClick?: (checkpoint: Checkpoint) => void
  overlapIndex: number
  overlapTotal: number
  baseY: number
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

  const statusColor = STATUS_COLORS[checkpoint.status]
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
        side="top"
        align="center"
        sideOffset={8}
        className="bg-zinc-900/95 backdrop-blur-xl border border-white/10 shadow-xl shadow-black/40 rounded-lg px-3 py-2.5 max-w-[280px] z-[100]"
        avoidCollisions={true}
        collisionPadding={16}
      >
        <div className="space-y-1.5">
          <div>
            <div className="text-sm font-medium text-white">{checkpoint.title}</div>
            <div className="text-[10px] text-white/50">{checkpoint.type_name}</div>
          </div>
          <div className="flex items-center justify-between gap-3 text-[11px]">
            <span className="text-white/60 tabular-nums">
              {format(parseISO(checkpoint.checkpoint_date), 'dd.MM.yyyy')}
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ backgroundColor: statusColor }} />
              <span style={{ color: statusColor }} className="text-[10px]">{STATUS_LABELS[checkpoint.status]}</span>
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
