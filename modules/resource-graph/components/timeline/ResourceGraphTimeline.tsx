'use client'

import { forwardRef } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Project, TimelineRange } from '../../types'
import { TimelineHeader, type DayCell } from './TimelineHeader'
import { ProjectRow } from './rows'
import { SIDEBAR_WIDTH } from '../../constants'
import { CheckpointLinksProvider, CheckpointVerticalLinks } from '@/modules/checkpoints'

interface ResourceGraphTimelineProps {
  projects: Project[]
  dayCells: DayCell[]
  range: TimelineRange
  isLoading?: boolean
  className?: string
  /** Hide the header (when rendered externally in sticky area) */
  hideHeader?: boolean
  /** Scroll event handler for sync with header */
  onScroll?: () => void
}

/**
 * Главный компонент графика ресурсов с timeline
 *
 * Full-width layout без границ
 */
export const ResourceGraphTimeline = forwardRef<HTMLDivElement, ResourceGraphTimelineProps>(
  function ResourceGraphTimeline(
    {
      projects,
      dayCells,
      range,
      isLoading,
      className,
      hideHeader = false,
      onScroll,
    },
    ref
  ) {
    if (isLoading) {
      return (
        <div className={cn('flex items-center justify-center h-full', className)}>
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      )
    }

    if (projects.length === 0) {
      return (
        <div className={cn('flex items-center justify-center h-full text-muted-foreground', className)}>
          Нет данных для отображения
        </div>
      )
    }

    return (
      <CheckpointLinksProvider>
        <div
          ref={ref}
          onScroll={onScroll}
          data-timeline-container
          className={cn('flex flex-col h-full overflow-auto relative', className)}
        >
          {/* Header area - only shown when not hidden (header in parent sticky area) */}
          {!hideHeader && (
            <div className="flex border-b border-border/50 sticky top-0 z-20 bg-background">
              {/* Sidebar header */}
              <div
                className="shrink-0 flex items-center px-3 py-2 border-r border-border/50 bg-muted/20"
                style={{ width: SIDEBAR_WIDTH }}
              >
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Структура
                </span>
              </div>

              {/* Timeline header */}
              <div className="flex-1 overflow-hidden">
                <TimelineHeader dayCells={dayCells} />
              </div>
            </div>
          )}

          {/* Content area - project rows */}
          {projects.map((project) => (
            <ProjectRow
              key={project.id}
              project={project}
              dayCells={dayCells}
              range={range}
            />
          ))}

          {/* Вертикальные линии между связанными чекпоинтами */}
          <CheckpointVerticalLinks />
        </div>
      </CheckpointLinksProvider>
    )
  }
)
