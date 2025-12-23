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

// Смещение для чекпоинтов на одну дату
const OVERLAP_OFFSET_X = 8   // Смещение по X для каждого следующего чекпоинта

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
// Single Marker Component
// ============================================================================

function CheckpointMarker({
  checkpoint,
  range,
  timelineWidth,
  sectionId,
  absoluteRowY,
  onMarkerClick,
  overlapIndex = 0,
  overlapTotal = 1
}: CheckpointMarkerProps) {
  const [isHovered, setIsHovered] = useState(false)
  const { registerCheckpoint, unregisterCheckpoint, getGroupMaxOffset } = useCheckpointLinks()

  // Рассчитываем базовую позицию X
  const baseX = useMemo(() => {
    const cpDate = parseISO(checkpoint.checkpoint_date)
    const dayOffset = differenceInDays(cpDate, range.start)
    // Центр ячейки дня
    return dayOffset * DAY_CELL_WIDTH + DAY_CELL_WIDTH / 2
  }, [checkpoint.checkpoint_date, range.start])

  // Проверяем, есть ли связанные чекпоинты (для синхронизации смещения)
  const hasLinkedCheckpoints = checkpoint.linked_sections && checkpoint.linked_sections.length > 0

  // Вычисляем смещение по X
  // Если чекпоинт связан с другими, используем максимальное смещение группы
  // Иначе используем локальное смещение
  const offsetX = useMemo(() => {
    if (hasLinkedCheckpoints) {
      // Пытаемся получить синхронизированное смещение группы
      const groupOffset = getGroupMaxOffset(checkpoint.checkpoint_id)
      if (groupOffset !== null) {
        return groupOffset
      }
    }

    // Локальное смещение (для несвязанных чекпоинтов или если группа ещё не сформирована)
    const offsetMultiplier = overlapTotal > 1 ? overlapIndex - (overlapTotal - 1) / 2 : 0
    return offsetMultiplier * OVERLAP_OFFSET_X
  }, [hasLinkedCheckpoints, checkpoint.checkpoint_id, overlapIndex, overlapTotal, getGroupMaxOffset])

  const x = baseX + offsetX

  // Y позиция — центр дополнительного пространства для чекпоинтов (без вертикального смещения)
  // Дополнительное пространство = SECTION_ROW_HEIGHT_WITH_CHECKPOINTS - SECTION_ROW_HEIGHT
  const checkpointSpace = SECTION_ROW_HEIGHT_WITH_CHECKPOINTS - SECTION_ROW_HEIGHT
  const relativeY = checkpointSpace / 2

  // Абсолютная Y позиция от верха timeline
  const absoluteY = absoluteRowY + relativeY

  // Регистрируем позицию чекпоинта для рисования вертикальных линий
  useEffect(() => {
    // Регистрируем только если есть связанные секции
    if (checkpoint.linked_sections && checkpoint.linked_sections.length > 0) {
      registerCheckpoint({
        checkpoint,
        sectionId,
        x,
        y: absoluteY,
        overlapIndex,
        overlapTotal,
      })
    }

    return () => {
      if (checkpoint.linked_sections && checkpoint.linked_sections.length > 0) {
        unregisterCheckpoint(checkpoint.checkpoint_id, sectionId)
      }
    }
  }, [checkpoint, sectionId, x, absoluteY, overlapIndex, overlapTotal, registerCheckpoint, unregisterCheckpoint])

  // Получаем компонент иконки
  const IconComponent = useMemo(() => getLucideIcon(checkpoint.icon), [checkpoint.icon])

  // Проверяем видимость
  if (x < 0 || x > timelineWidth) return null

  // Цвета: статус для обводки, кастомный цвет для фона и иконки
  const statusColor = STATUS_COLORS[checkpoint.status]
  const baseColor = checkpoint.color || '#6B7280'

  // Преобразуем цвет в RGB для создания полупрозрачного фона
  const rgb = hexToRgb(baseColor)
  const bgColorRgba = rgb
    ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.15)`
    : 'rgba(107, 114, 128, 0.15)'
  const bgColorHoverRgba = rgb
    ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.25)`
    : 'rgba(107, 114, 128, 0.25)'

  // Трансформация для hover (масштабирование от центра)
  const hoverScale = isHovered ? 1.15 : 1

  // Формируем контент для тултипа
  const tooltipContent = (
    <div className="flex flex-col gap-1 max-w-xs">
      <div className="font-semibold text-foreground">{checkpoint.title}</div>
      <div className="flex items-center gap-2 text-xs">
        <span className="text-muted-foreground">{checkpoint.type_name}</span>
        <span className="text-muted-foreground">•</span>
        <span className="text-muted-foreground">{format(parseISO(checkpoint.checkpoint_date), 'dd.MM.yyyy')}</span>
      </div>
      <div className="flex items-center gap-1 text-xs">
        <span
          className="inline-block w-2 h-2 rounded-full"
          style={{ backgroundColor: statusColor }}
        />
        <span style={{ color: statusColor }}>{STATUS_LABELS[checkpoint.status]}</span>
      </div>
      {checkpoint.description && (
        <div className="text-xs text-muted-foreground mt-1 border-t border-border/50 pt-1">
          {checkpoint.description}
        </div>
      )}
      {checkpoint.completed_at && (
        <div className="text-xs text-muted-foreground">
          Выполнен: {format(parseISO(checkpoint.completed_at), 'dd.MM.yyyy')}
        </div>
      )}
    </div>
  )

  return (
    <g transform={`translate(${x}, ${relativeY})`}>
      {/* Внутренняя группа с hover масштабированием */}
      <g
        transform={`scale(${hoverScale})`}
        style={{ transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)' }}
        className={cn(
          "checkpoint-marker",
          checkpoint.status === 'pending' && "animate-pulse-subtle"
        )}
      >
        {/* Вертикальная линия вниз (до начала графиков) */}
        <line
          x1={0}
          y1={MARKER_RADIUS + 2}
          x2={0}
          y2={SECTION_ROW_HEIGHT * 0.5}
          stroke={baseColor}
          strokeWidth="1.5"
          strokeOpacity={isHovered ? 0.5 : 0.25}
          className="transition-all duration-300"
          strokeLinecap="round"
        />

        {/* Определения для эффектов */}
        <defs>
          {/* Градиент для glow эффекта */}
          <radialGradient id={`glow-gradient-${checkpoint.checkpoint_id}`}>
            <stop offset="0%" stopColor={baseColor} stopOpacity="0.4"/>
            <stop offset="60%" stopColor={baseColor} stopOpacity="0.15"/>
            <stop offset="100%" stopColor={baseColor} stopOpacity="0"/>
          </radialGradient>
          {/* Градиент для фона маркера - glass эффект */}
          <linearGradient id={`bg-gradient-${checkpoint.checkpoint_id}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={baseColor} stopOpacity="0.2"/>
            <stop offset="100%" stopColor={baseColor} stopOpacity="0.08"/>
          </linearGradient>
        </defs>

        {/* Внешний glow - появляется при hover */}
        <circle
          cx={0}
          cy={0}
          r={MARKER_RADIUS + 6}
          fill={`url(#glow-gradient-${checkpoint.checkpoint_id})`}
          className="checkpoint-glow transition-opacity duration-300"
          style={{
            opacity: isHovered ? 1 : 0,
            pointerEvents: 'none',
          }}
        />

        {/* Тень под маркером */}
        <ellipse
          cx={0}
          cy={MARKER_RADIUS + 2}
          rx={MARKER_RADIUS * 0.7}
          ry={2}
          fill={baseColor}
          fillOpacity={isHovered ? 0.2 : 0.1}
          className="transition-all duration-300"
          style={{ pointerEvents: 'none' }}
        />

        {/* Основной круг маркера - glass эффект */}
        <circle
          cx={0}
          cy={0}
          r={MARKER_RADIUS}
          fill={isHovered ? bgColorHoverRgba : bgColorRgba}
          stroke={statusColor}
          strokeWidth={1.5}
          strokeOpacity={isHovered ? 1 : 0.7}
          className="transition-all duration-300 checkpoint-circle"
          style={{
            filter: isHovered
              ? `drop-shadow(0 4px 12px ${statusColor}50)`
              : `drop-shadow(0 2px 6px ${statusColor}30)`,
          }}
        />

        {/* Внутренний highlight для glass эффекта */}
        <circle
          cx={0}
          cy={-MARKER_RADIUS * 0.3}
          r={MARKER_RADIUS * 0.6}
          fill="white"
          fillOpacity={isHovered ? 0.15 : 0.08}
          className="transition-all duration-300"
          style={{ pointerEvents: 'none' }}
        />

        {/* Индикатор статуса - маленькая точка */}
        <circle
          cx={MARKER_RADIUS * 0.6}
          cy={-MARKER_RADIUS * 0.6}
          r={3}
          fill={statusColor}
          stroke="hsl(var(--background))"
          strokeWidth={1}
          className="transition-all duration-300"
          style={{
            filter: `drop-shadow(0 1px 2px ${statusColor}60)`,
          }}
        />

        {/* Lucide иконка внутри */}
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
              style={{ color: baseColor }}
              strokeWidth={2.5}
              className="transition-all duration-300"
            />
          </div>
        </foreignObject>
      </g>

      {/* Невидимый foreignObject для тултипа - покрывает весь маркер */}
      <foreignObject
        x={-MARKER_RADIUS - 6}
        y={-MARKER_RADIUS - 6}
        width={(MARKER_RADIUS + 6) * 2}
        height={(MARKER_RADIUS + 6) * 2}
        className="pointer-events-auto overflow-visible"
        style={{ cursor: 'pointer' }}
      >
        <Tooltip delayDuration={200}>
          <TooltipTrigger asChild>
            <div
              className="w-full h-full"
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
              onClick={() => onMarkerClick?.(checkpoint)}
            />
          </TooltipTrigger>
          <TooltipContent
            side="top"
            sideOffset={12}
            align="center"
            className="z-[100]"
            avoidCollisions={true}
            collisionPadding={16}
          >
            {tooltipContent}
          </TooltipContent>
        </Tooltip>
      </foreignObject>
    </g>
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

  // Y позиция для горизонтальной линии — центр дополнительного пространства
  const checkpointSpace = SECTION_ROW_HEIGHT_WITH_CHECKPOINTS - SECTION_ROW_HEIGHT
  const lineY = checkpointSpace / 2

  return (
    <TooltipProvider>
      <style>{`
        @keyframes checkpoint-pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.7;
          }
        }
        .animate-pulse-subtle {
          animation: checkpoint-pulse 2.5s ease-in-out infinite;
        }
      `}</style>
      <svg
        className="absolute top-0 left-0 right-0 pointer-events-none overflow-visible z-10"
        style={{ width: timelineWidth, height: SECTION_ROW_HEIGHT_WITH_CHECKPOINTS }}
      >
        {/* Горизонтальная соединительная линия между чекпоинтами */}
        {checkpointPositions.length > 1 && (
          <>
            {/* Основная линия с градиентом */}
            <defs>
              <linearGradient id="checkpoint-line-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="hsl(var(--border))" stopOpacity="0.2"/>
                <stop offset="50%" stopColor="hsl(var(--border))" stopOpacity="0.5"/>
                <stop offset="100%" stopColor="hsl(var(--border))" stopOpacity="0.2"/>
              </linearGradient>
            </defs>
            <line
              x1={checkpointPositions[0].x}
              y1={lineY}
              x2={checkpointPositions[checkpointPositions.length - 1].x}
              y2={lineY}
              stroke="url(#checkpoint-line-gradient)"
              strokeWidth="1.5"
              strokeLinecap="round"
              className="transition-all duration-300"
            />
          </>
        )}

        {/* Маркеры чекпоинтов - рендерим после линии, чтобы перекрывали её */}
        {checkpoints.map((cp, index) => {
          // Находим количество чекпоинтов на эту дату и индекс текущего
          const checkpointsOnDate = checkpointsByDate.get(cp.checkpoint_date) || [cp]
          const overlapIndex = checkpointsOnDate.findIndex(c => c.checkpoint_id === cp.checkpoint_id)
          const overlapTotal = checkpointsOnDate.length

          return (
            <g
              key={cp.checkpoint_id}
              style={{
                animation: `fade-in-up 400ms cubic-bezier(0.16, 1, 0.3, 1) ${index * 50}ms both`
              }}
            >
              <CheckpointMarker
                checkpoint={cp}
                range={range}
                timelineWidth={timelineWidth}
                sectionId={sectionId}
                absoluteRowY={absoluteRowY}
                onMarkerClick={onMarkerClick}
                overlapIndex={overlapIndex}
                overlapTotal={overlapTotal}
              />
            </g>
          )
        })}
      </svg>
      <style>{`
        @keyframes fade-in-up {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </TooltipProvider>
  )
}

export default CheckpointMarkers
