'use client'

import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TimelineRange } from '../../../types'
import type { DayCell } from '../TimelineHeader'
import { TimelineBar } from '../TimelineBar'
import { TimelineGrid } from '../shared'
import { ROW_HEIGHT, SIDEBAR_WIDTH, DAY_CELL_WIDTH } from '../../../constants'

// ============================================================================
// Base Row Component
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
  // Optional extra content in timeline area (work logs, etc.)
  timelineContent?: React.ReactNode
  // Optional custom height (defaults to ROW_HEIGHT)
  height?: number
}

/**
 * Базовый компонент строки Timeline
 * Используется для Project, Stage и других простых уровней иерархии
 */
export function BaseRow({
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
  timelineContent,
  height = ROW_HEIGHT,
}: BaseRowProps) {
  const timelineWidth = dayCells.length * DAY_CELL_WIDTH
  const totalWidth = SIDEBAR_WIDTH + timelineWidth

  return (
    <>
      <div
        className={cn(
          'flex border-b border-border/50',
          depth === 0 && 'bg-muted/20'
        )}
        style={{ height, minWidth: totalWidth }}
      >
        {/* Sidebar - sticky left при горизонтальном скролле */}
        <div
          className={cn(
            'flex items-center gap-1 shrink-0 border-r border-border px-2',
            'sticky left-0 z-40',
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
          {/* Extra timeline content (work logs, etc.) */}
          {timelineContent}
        </div>
      </div>

      {/* Children */}
      {isExpanded && children}
    </>
  )
}
