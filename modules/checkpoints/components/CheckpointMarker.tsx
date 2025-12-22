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

// ============================================================================
// Constants
// ============================================================================

const MARKER_RADIUS = 8  // Увеличили с 5 до 8 для иконок
const ICON_SIZE = 12     // Размер иконки внутри маркера

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

// ============================================================================
// Single Marker Component
// ============================================================================

function CheckpointMarker({ checkpoint, range, timelineWidth, sectionId, absoluteRowY, onMarkerClick }: CheckpointMarkerProps) {
  const [isHovered, setIsHovered] = useState(false)
  const { registerCheckpoint, unregisterCheckpoint } = useCheckpointLinks()

  // Рассчитываем позицию X
  const x = useMemo(() => {
    const cpDate = parseISO(checkpoint.checkpoint_date)
    const dayOffset = differenceInDays(cpDate, range.start)
    // Центр ячейки дня
    return dayOffset * DAY_CELL_WIDTH + DAY_CELL_WIDTH / 2
  }, [checkpoint.checkpoint_date, range.start])

  // Y позиция — центр дополнительного пространства для чекпоинтов
  // Дополнительное пространство = SECTION_ROW_HEIGHT_WITH_CHECKPOINTS - SECTION_ROW_HEIGHT
  const checkpointSpace = SECTION_ROW_HEIGHT_WITH_CHECKPOINTS - SECTION_ROW_HEIGHT
  const relativeY = checkpointSpace / 2

  // Абсолютная Y позиция от верха timeline
  const absoluteY = absoluteRowY + relativeY

  // Регистрируем позицию чекпоинта для рисования вертикальных линий
  useEffect(() => {
    // Регистрируем только если есть связанные секции (> 0 linked_sections)
    if (checkpoint.linked_sections && checkpoint.linked_sections.length > 0) {
      console.log('[CheckpointMarker] Registering checkpoint:', {
        checkpoint_id: checkpoint.checkpoint_id,
        sectionId,
        x,
        y: absoluteY,
        linked_sections: checkpoint.linked_sections,
      })
      registerCheckpoint({
        checkpoint,
        sectionId,
        x,
        y: absoluteY,
      })
    } else {
      console.log('[CheckpointMarker] NOT registering (no linked sections):', {
        checkpoint_id: checkpoint.checkpoint_id,
        sectionId,
        linked_sections: checkpoint.linked_sections,
      })
    }

    return () => {
      if (checkpoint.linked_sections && checkpoint.linked_sections.length > 0) {
        unregisterCheckpoint(checkpoint.checkpoint_id, sectionId)
      }
    }
  }, [checkpoint, sectionId, x, absoluteY, registerCheckpoint, unregisterCheckpoint])

  // Получаем компонент иконки
  const IconComponent = useMemo(() => getLucideIcon(checkpoint.icon), [checkpoint.icon])

  // Проверяем видимость
  if (x < 0 || x > timelineWidth) return null

  // Цвета: статус для обводки, кастомный цвет для иконки
  const statusColor = STATUS_COLORS[checkpoint.status]
  const iconColor = checkpoint.color || '#6B7280'

  // Трансформация для hover (масштабирование от центра)
  const hoverScale = isHovered ? 1.2 : 1

  // Формируем текст для тултипа
  const tooltipText = [
    checkpoint.title,
    checkpoint.type_name,
    format(parseISO(checkpoint.checkpoint_date), 'dd.MM.yyyy'),
    STATUS_LABELS[checkpoint.status],
    checkpoint.description,
    checkpoint.completed_at && `Выполнен: ${format(parseISO(checkpoint.completed_at), 'dd.MM.yyyy')}`,
  ].filter(Boolean).join(' • ')

  return (
    <g
      transform={`translate(${x}, ${relativeY})`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onMarkerClick?.(checkpoint)}
      className={cn(
        "checkpoint-marker cursor-pointer pointer-events-auto",
        checkpoint.status === 'pending' && "animate-pulse-subtle"
      )}
      style={{
        animation: checkpoint.status === 'pending'
          ? 'checkpoint-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
          : undefined,
        transition: 'all 0.3s ease-out'
      }}
    >
      {/* Внутренняя группа с hover масштабированием */}
      <g transform={`scale(${hoverScale})`} style={{ transition: 'transform 0.3s ease-out' }}>
        {/* Вертикальная линия вниз (до начала графиков) */}
        {/* Линия начинается от нижней границы маркера (MARKER_RADIUS) */}
        <line
          x1={0}
          y1={MARKER_RADIUS}
          x2={0}
          y2={SECTION_ROW_HEIGHT * 0.5}
          stroke="currentColor"
          strokeWidth="1"
          className="text-border/30 transition-all duration-300"
          style={{
            strokeDasharray: '2,2'
          }}
        />

        {/* Glow эффект при hover - добавляем через filter */}
        <defs>
          <filter id={`glow-${checkpoint.checkpoint_id}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          <radialGradient id={`gradient-${checkpoint.checkpoint_id}`}>
            <stop offset="0%" stopColor={statusColor} stopOpacity="0.3"/>
            <stop offset="70%" stopColor={statusColor} stopOpacity="0.1"/>
            <stop offset="100%" stopColor={statusColor} stopOpacity="0"/>
          </radialGradient>
        </defs>

        {/* Внешний glow круг - видим только при hover */}
        <circle
          cx={0}
          cy={0}
          r={MARKER_RADIUS + 4}
          fill={`url(#gradient-${checkpoint.checkpoint_id})`}
          className="hover-glow"
          style={{ pointerEvents: 'none' }}
        />

        {/* Основной круг маркера - полупрозрачный фон, обводка по статусу */}
        <circle
          cx={0}
          cy={0}
          r={MARKER_RADIUS}
          fill="hsl(var(--background))"
          fillOpacity="0.95"
          stroke={statusColor}
          strokeWidth={2}
          className="transition-all duration-300 checkpoint-circle"
          style={{
            filter: `drop-shadow(0 2px 4px ${statusColor}40)`
          }}
        />

        {/* Lucide иконка внутри - цветная */}
        <foreignObject
          x={-ICON_SIZE / 2}
          y={-ICON_SIZE / 2}
          width={ICON_SIZE}
          height={ICON_SIZE}
          className="pointer-events-none overflow-visible"
        >
          <div className="flex items-center justify-center w-full h-full transition-transform duration-300">
            <IconComponent
              size={ICON_SIZE}
              style={{ color: iconColor }}
              strokeWidth={2.5}
              className="transition-all duration-300"
            />
          </div>
        </foreignObject>
      </g>

      {/* HTML title tooltip */}
      <title>{tooltipText}</title>
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

  // Вычисляем позиции всех чекпоинтов для горизонтальной линии
  const checkpointPositions = useMemo(() => {
    return checkpoints
      .map((cp) => {
        const cpDate = parseISO(cp.checkpoint_date)
        const dayOffset = differenceInDays(cpDate, range.start)
        const x = dayOffset * DAY_CELL_WIDTH + DAY_CELL_WIDTH / 2
        return { checkpoint: cp, x }
      })
      .filter(({ x }) => x >= 0 && x <= timelineWidth)
      .sort((a, b) => a.x - b.x)
  }, [checkpoints, range, timelineWidth])

  // Y позиция для горизонтальной линии — центр дополнительного пространства
  const checkpointSpace = SECTION_ROW_HEIGHT_WITH_CHECKPOINTS - SECTION_ROW_HEIGHT
  const lineY = checkpointSpace / 2

  return (
    <>
      <style>{`
        @keyframes checkpoint-pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.85;
          }
        }

        /* Hover эффект glow */
        .checkpoint-marker .hover-glow {
          opacity: 0;
          transition: opacity 0.3s ease-out;
        }

        .checkpoint-marker:hover .hover-glow {
          opacity: 1;
        }

        /* Hover эффект для circle */
        .checkpoint-marker .checkpoint-circle {
          transition: filter 0.3s ease-out;
        }

        .checkpoint-marker:hover .checkpoint-circle {
          filter: drop-shadow(0 4px 12px currentColor);
        }
      `}</style>
      <svg
        className="absolute top-0 left-0 right-0 pointer-events-none overflow-visible z-10"
        style={{ width: timelineWidth, height: SECTION_ROW_HEIGHT_WITH_CHECKPOINTS }}
      >
        {/* Горизонтальная соединительная линия между первым и последним чекпоинтом - рендерим ПЕРВОЙ чтобы была под маркерами */}
        {checkpointPositions.length > 1 && (
          <line
            x1={checkpointPositions[0].x}
            y1={lineY}
            x2={checkpointPositions[checkpointPositions.length - 1].x}
            y2={lineY}
            stroke="hsl(var(--border))"
            strokeWidth="2"
            opacity="0.7"
            className="transition-all duration-300"
          />
        )}

        {/* Маркеры чекпоинтов - рендерим после линии, чтобы перекрывали её */}
        {checkpoints.map((cp, index) => (
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
            />
          </g>
        ))}
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
    </>
  )
}

export default CheckpointMarkers
