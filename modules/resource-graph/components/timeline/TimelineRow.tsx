'use client'

import { useState, useCallback } from 'react'
import {
  ChevronRight,
  FolderKanban,
  Layers,
  Box,
  FileText,
  ListTodo,
  Circle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type {
  Project,
  Stage,
  ProjectObject,
  Section,
  DecompositionStage,
  DecompositionItem,
  TimelineRange,
} from '../../types'
import { TimelineBar } from './TimelineBar'
import type { DayCell } from './TimelineHeader'
import { ROW_HEIGHT, SIDEBAR_WIDTH } from '../../constants'

// ============================================================================
// Grid Background
// ============================================================================

interface TimelineGridProps {
  dayCells: DayCell[]
}

export function TimelineGrid({ dayCells }: TimelineGridProps) {
  const cellWidth = 100 / dayCells.length

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {dayCells.map((cell, i) => {
        if (!cell.isWeekend && !cell.isToday) return null
        return (
          <div
            key={i}
            className={cn(
              'absolute top-0 bottom-0',
              cell.isToday ? 'bg-primary/5' : 'bg-muted/30'
            )}
            style={{
              left: `${i * cellWidth}%`,
              width: `${cellWidth}%`,
            }}
          />
        )
      })}
      {/* Вертикальные линии */}
      {dayCells.slice(0, -1).map((_, i) => (
        <div
          key={`line-${i}`}
          className="absolute top-0 bottom-0 w-px bg-border/30"
          style={{ left: `${(i + 1) * cellWidth}%` }}
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
}: BaseRowProps) {
  return (
    <>
      <div
        className={cn(
          'flex border-b border-border/50 hover:bg-muted/30 transition-colors',
          depth === 0 && 'bg-muted/20'
        )}
        style={{ height: ROW_HEIGHT }}
      >
        {/* Sidebar */}
        <div
          className="flex items-center gap-1 shrink-0 border-r border-border px-2"
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
          <span className="text-sm truncate" title={label}>
            {label}
          </span>
        </div>

        {/* Timeline area */}
        <div className="flex-1 relative">
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
// Section Row
// ============================================================================

interface SectionRowProps {
  section: Section
  dayCells: DayCell[]
  range: TimelineRange
}

function SectionRow({ section, dayCells, range }: SectionRowProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const hasChildren = section.decompositionStages.length > 0

  return (
    <BaseRow
      depth={3}
      isExpanded={isExpanded}
      onToggle={() => setIsExpanded(!isExpanded)}
      hasChildren={hasChildren}
      icon={<FileText className="w-4 h-4" />}
      label={section.name}
      dayCells={dayCells}
      range={range}
      barStartDate={section.startDate}
      barEndDate={section.endDate}
      barColor={section.status.color}
      barLabel={section.name}
    >
      {section.decompositionStages.map((stage) => (
        <DecompositionStageRow
          key={stage.id}
          stage={stage}
          dayCells={dayCells}
          range={range}
        />
      ))}
    </BaseRow>
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
