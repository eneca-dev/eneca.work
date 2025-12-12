'use client'

import { useState, useCallback } from 'react'
import { format, parseISO } from 'date-fns'
import {
  ChevronRight,
  FolderKanban,
  Layers,
  Box,
  ListTodo,
  Circle,
  Calendar,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip'
import type {
  Project,
  Stage,
  ProjectObject,
  Section,
  DecompositionStage,
  DecompositionItem,
  TimelineRange,
} from '../../types'
import { TimelineBar, calculateBarPosition } from './TimelineBar'
import { ReadinessGraph } from './ReadinessGraph'
import { ActualReadinessBars } from './ActualReadinessBars'
import type { DayCell } from './TimelineHeader'
import { ROW_HEIGHT, SECTION_ROW_HEIGHT, SIDEBAR_WIDTH, DAY_CELL_WIDTH } from '../../constants'

// ============================================================================
// Grid Background
// ============================================================================

interface TimelineGridProps {
  dayCells: DayCell[]
}

export function TimelineGrid({ dayCells }: TimelineGridProps) {
  return (
    <div className="absolute inset-0 pointer-events-none">
      {dayCells.map((cell, i) => {
        // Логика цветов выходных:
        // - Праздники и дополнительные выходные (переносы) → желтоватый
        // - Стандартные выходные (Сб/Вс) → серый
        const isSpecialDayOff = cell.isHoliday || cell.isTransferredDayOff
        const isRegularWeekend = cell.isWeekend && !cell.isWorkday && !isSpecialDayOff
        const showBackground = cell.isToday || isSpecialDayOff || isRegularWeekend

        if (!showBackground) return null

        return (
          <div
            key={i}
            className={cn(
              'absolute top-0 bottom-0',
              cell.isToday && 'bg-primary/5',
              !cell.isToday && isSpecialDayOff && 'bg-amber-50/50 dark:bg-amber-950/20',
              !cell.isToday && isRegularWeekend && 'bg-gray-100/50 dark:bg-gray-800/30'
            )}
            style={{
              left: i * DAY_CELL_WIDTH,
              width: DAY_CELL_WIDTH,
            }}
          />
        )
      })}
      {/* Вертикальные линии */}
      {dayCells.slice(0, -1).map((_, i) => (
        <div
          key={`line-${i}`}
          className="absolute top-0 bottom-0 w-px bg-border/30"
          style={{ left: (i + 1) * DAY_CELL_WIDTH }}
        />
      ))}
    </div>
  )
}

// ============================================================================
// Row Components
// ============================================================================

interface BaseRowProps {
  depth: number
  isExpanded?: boolean
  onToggle?: () => void
  hasChildren?: boolean
  icon: React.ReactNode
  label: string
  children?: React.ReactNode
  // Timeline
  dayCells: DayCell[]
  range: TimelineRange
  barStartDate?: string | null
  barEndDate?: string | null
  barColor?: string | null
  barLabel?: string
  // Optional extra content in sidebar (after label)
  sidebarExtra?: React.ReactNode
}

function BaseRow({
  depth,
  isExpanded,
  onToggle,
  hasChildren,
  icon,
  label,
  children,
  dayCells,
  range,
  barStartDate,
  barEndDate,
  barColor,
  barLabel,
  sidebarExtra,
}: BaseRowProps) {
  const timelineWidth = dayCells.length * DAY_CELL_WIDTH
  const totalWidth = SIDEBAR_WIDTH + timelineWidth

  return (
    <>
      <div
        className={cn(
          'flex border-b border-border/50 hover:bg-muted/30 transition-colors',
          depth === 0 && 'bg-muted/20'
        )}
        style={{ height: ROW_HEIGHT, minWidth: totalWidth }}
      >
        {/* Sidebar - sticky left при горизонтальном скролле */}
        <div
          className={cn(
            'flex items-center gap-1 shrink-0 border-r border-border px-2',
            'sticky left-0 z-10',
            depth === 0 ? 'bg-card' : 'bg-background'
          )}
          style={{
            width: SIDEBAR_WIDTH,
            paddingLeft: 8 + depth * 16,
          }}
        >
          {/* Expand/Collapse */}
          {hasChildren ? (
            <button
              onClick={onToggle}
              className="p-0.5 hover:bg-muted rounded transition-colors"
            >
              <ChevronRight
                className={cn(
                  'w-4 h-4 text-muted-foreground transition-transform',
                  isExpanded && 'rotate-90'
                )}
              />
            </button>
          ) : (
            <div className="w-5" />
          )}
          {/* Icon */}
          <span className="text-muted-foreground">{icon}</span>
          {/* Label */}
          <span className="text-sm truncate flex-1 min-w-0" title={label}>
            {label}
          </span>
          {/* Extra content (avatar, status, etc.) */}
          {sidebarExtra && (
            <div className="flex items-center gap-1.5 shrink-0 ml-auto">
              {sidebarExtra}
            </div>
          )}
        </div>

        {/* Timeline area - fixed width */}
        <div className="relative" style={{ width: timelineWidth }}>
          <TimelineGrid dayCells={dayCells} />
          {barStartDate && barEndDate && (
            <TimelineBar
              startDate={barStartDate}
              endDate={barEndDate}
              range={range}
              color={barColor}
              label={barLabel}
            />
          )}
        </div>
      </div>

      {/* Children */}
      {isExpanded && children}
    </>
  )
}

// ============================================================================
// Decomposition Item Row (задача - без дат)
// ============================================================================

interface DecompositionItemRowProps {
  item: DecompositionItem
  dayCells: DayCell[]
  range: TimelineRange
}

function DecompositionItemRow({ item, dayCells, range }: DecompositionItemRowProps) {
  const label = item.description || 'Без описания'
  const meta = item.plannedHours ? `${item.plannedHours}ч` : ''

  return (
    <BaseRow
      depth={5}
      icon={
        <Circle
          className="w-3 h-3"
          style={{ color: item.status.color || undefined }}
          fill={item.status.color || 'transparent'}
        />
      }
      label={`${label}${meta ? ` (${meta})` : ''}`}
      dayCells={dayCells}
      range={range}
    />
  )
}

// ============================================================================
// Decomposition Stage Row (этап - с датами, разворачивается)
// ============================================================================

interface DecompositionStageRowProps {
  stage: DecompositionStage
  dayCells: DayCell[]
  range: TimelineRange
}

function DecompositionStageRow({ stage, dayCells, range }: DecompositionStageRowProps) {
  const [isExpanded, setIsExpanded] = useState(false) // По умолчанию свёрнуто
  const hasChildren = stage.items.length > 0

  return (
    <BaseRow
      depth={4}
      isExpanded={isExpanded}
      onToggle={() => setIsExpanded(!isExpanded)}
      hasChildren={hasChildren}
      icon={<ListTodo className="w-4 h-4" />}
      label={`${stage.name}${hasChildren ? ` (${stage.items.length})` : ''}`}
      dayCells={dayCells}
      range={range}
      barStartDate={stage.startDate}
      barEndDate={stage.finishDate}
      barColor={stage.status.color}
      barLabel={stage.name}
    >
      {stage.items.map((item) => (
        <DecompositionItemRow
          key={item.id}
          item={item}
          dayCells={dayCells}
          range={range}
        />
      ))}
    </BaseRow>
  )
}

// ============================================================================
// Section Background (фоновая заливка периода раздела)
// ============================================================================

interface SectionBackgroundProps {
  startDate: string | null
  endDate: string | null
  range: TimelineRange
  color?: string | null
}

function SectionBackground({ startDate, endDate, range, color }: SectionBackgroundProps) {
  const position = calculateBarPosition(startDate, endDate, range)

  if (!position) return null

  // Цвет с низкой прозрачностью для фона
  const bgColor = color || '#3b82f6'

  return (
    <div
      className="absolute inset-y-0 pointer-events-none"
      style={{
        left: position.left,
        width: position.width,
        backgroundColor: `${bgColor}15`, // 8% opacity
        borderLeft: `2px solid ${bgColor}40`,
        borderRight: `2px solid ${bgColor}40`,
      }}
    />
  )
}

// ============================================================================
// Section Row (Двухстрочный layout)
// ============================================================================

interface SectionRowProps {
  section: Section
  dayCells: DayCell[]
  range: TimelineRange
}

function SectionRow({ section, dayCells, range }: SectionRowProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const hasChildren = section.decompositionStages.length > 0

  const timelineWidth = dayCells.length * DAY_CELL_WIDTH
  const totalWidth = SIDEBAR_WIDTH + timelineWidth
  const depth = 3

  // Инициалы для fallback аватара
  const getInitials = (firstName: string | null, lastName: string | null) => {
    const first = firstName?.charAt(0)?.toUpperCase() || ''
    const last = lastName?.charAt(0)?.toUpperCase() || ''
    return first + last || '?'
  }

  // Форматирование даты в ДД.ММ
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—'
    try {
      return format(parseISO(dateStr), 'dd.MM')
    } catch {
      return '—'
    }
  }

  return (
    <>
      <div
        className="flex border-b border-border/50 hover:bg-muted/30 transition-colors"
        style={{ height: SECTION_ROW_HEIGHT, minWidth: totalWidth }}
      >
        {/* Sidebar - sticky left при горизонтальном скролле */}
        <div
          className={cn(
            'flex flex-col justify-center gap-0.5 shrink-0 border-r border-border px-2',
            'sticky left-0 z-10 bg-background'
          )}
          style={{
            width: SIDEBAR_WIDTH,
            paddingLeft: 8 + depth * 16,
          }}
        >
          {/* Первая строка: Expand + Avatar + Name */}
          <div className="flex items-center gap-1.5 min-w-0">
            {/* Expand/Collapse */}
            {hasChildren ? (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-0.5 hover:bg-muted rounded transition-colors shrink-0"
              >
                <ChevronRight
                  className={cn(
                    'w-4 h-4 text-muted-foreground transition-transform',
                    isExpanded && 'rotate-90'
                  )}
                />
              </button>
            ) : (
              <div className="w-5 shrink-0" />
            )}

            {/* Avatar вместо иконки */}
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Avatar className="w-5 h-5 shrink-0">
                    {section.responsible.avatarUrl ? (
                      <AvatarImage
                        src={section.responsible.avatarUrl}
                        alt={section.responsible.name || 'Ответственный'}
                      />
                    ) : null}
                    <AvatarFallback className="text-[9px] bg-muted">
                      {getInitials(
                        section.responsible.firstName,
                        section.responsible.lastName
                      )}
                    </AvatarFallback>
                  </Avatar>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  {section.responsible.name || 'Ответственный не указан'}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Section Name */}
            <span className="text-sm font-medium truncate min-w-0" title={section.name}>
              {section.name}
            </span>
          </div>

          {/* Вторая строка: Status chip + Dates */}
          <div className="flex items-center gap-2 pl-[26px]">
            {/* Status chip - outlined style like in projects module */}
            {section.status.name && (
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-medium shrink-0"
                style={{
                  backgroundColor: section.status.color
                    ? `${section.status.color}1A` // 10% opacity
                    : undefined,
                  borderColor: section.status.color
                    ? `${section.status.color}59` // 35% opacity
                    : '#d1d5db',
                  color: section.status.color || '#6b7280',
                }}
                title={section.status.name}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: section.status.color || '#6b7280' }}
                />
                {section.status.name}
              </span>
            )}

            {/* Dates */}
            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {formatDate(section.startDate)} — {formatDate(section.endDate)}
            </span>
          </div>
        </div>

        {/* Timeline area - fixed width */}
        <div className="relative" style={{ width: timelineWidth }}>
          <TimelineGrid dayCells={dayCells} />
          {/* Фоновая заливка периода раздела */}
          <SectionBackground
            startDate={section.startDate}
            endDate={section.endDate}
            range={range}
            color={section.status.color}
          />
          {/* Столбики фактической готовности */}
          {section.actualReadiness.length > 0 && (
            <ActualReadinessBars
              snapshots={section.actualReadiness}
              range={range}
              timelineWidth={timelineWidth}
            />
          )}
          {/* График плановой готовности (поверх всего) */}
          {section.readinessCheckpoints.length > 0 && (
            <ReadinessGraph
              checkpoints={section.readinessCheckpoints}
              range={range}
              timelineWidth={timelineWidth}
            />
          )}
        </div>
      </div>

      {/* Children */}
      {isExpanded &&
        section.decompositionStages.map((stage) => (
          <DecompositionStageRow
            key={stage.id}
            stage={stage}
            dayCells={dayCells}
            range={range}
          />
        ))}
    </>
  )
}

// ============================================================================
// Object Row
// ============================================================================

interface ObjectRowProps {
  object: ProjectObject
  dayCells: DayCell[]
  range: TimelineRange
}

function ObjectRow({ object, dayCells, range }: ObjectRowProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const hasChildren = object.sections.length > 0

  return (
    <BaseRow
      depth={2}
      isExpanded={isExpanded}
      onToggle={() => setIsExpanded(!isExpanded)}
      hasChildren={hasChildren}
      icon={<Box className="w-4 h-4" />}
      label={object.name}
      dayCells={dayCells}
      range={range}
    >
      {object.sections.map((section) => (
        <SectionRow
          key={section.id}
          section={section}
          dayCells={dayCells}
          range={range}
        />
      ))}
    </BaseRow>
  )
}

// ============================================================================
// Stage Row
// ============================================================================

interface StageRowProps {
  stage: Stage
  dayCells: DayCell[]
  range: TimelineRange
}

function StageRow({ stage, dayCells, range }: StageRowProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const hasChildren = stage.objects.length > 0

  return (
    <BaseRow
      depth={1}
      isExpanded={isExpanded}
      onToggle={() => setIsExpanded(!isExpanded)}
      hasChildren={hasChildren}
      icon={<Layers className="w-4 h-4" />}
      label={stage.name}
      dayCells={dayCells}
      range={range}
    >
      {stage.objects.map((obj) => (
        <ObjectRow
          key={obj.id}
          object={obj}
          dayCells={dayCells}
          range={range}
        />
      ))}
    </BaseRow>
  )
}

// ============================================================================
// Project Row (Top Level)
// ============================================================================

interface ProjectRowProps {
  project: Project
  dayCells: DayCell[]
  range: TimelineRange
}

export function ProjectRow({ project, dayCells, range }: ProjectRowProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const hasChildren = project.stages.length > 0

  return (
    <BaseRow
      depth={0}
      isExpanded={isExpanded}
      onToggle={() => setIsExpanded(!isExpanded)}
      hasChildren={hasChildren}
      icon={<FolderKanban className="w-4 h-4" />}
      label={project.name}
      dayCells={dayCells}
      range={range}
    >
      {project.stages.map((stage) => (
        <StageRow
          key={stage.id}
          stage={stage}
          dayCells={dayCells}
          range={range}
        />
      ))}
    </BaseRow>
  )
}
