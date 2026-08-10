/**
 * Project Row (content) Component — одна строка проекта на таймлайне разделов.
 * При свёрнутом проекте показывает агрегированные мини-бары. Дети — через flatten.
 */

'use client'

import { useMemo } from 'react'
import { ChevronDown, ChevronRight, FolderKanban } from 'lucide-react'
import { useSectionsPageUIStore, useMultipleSectionsCapacityOverrides } from '../../stores/useSectionsPageUIStore'
import { SIDEBAR_WIDTH, DAY_CELL_WIDTH, PROJECT_ROW_HEIGHT } from '../../constants'
import { AggregatedBarsOverlay } from '../AggregatedBarsOverlay'
import { getCellClassNames } from '../../utils/cell-utils'
import { MockProjectDateBars } from '../mock/MockProjectDateBars'
import type { Project, DayCell, SectionLoading } from '../../types'
import type { VirtualColumn } from '@/modules/shared/virtualized-tree'

interface ProjectRowContentProps {
  project: Project
  dayCells: DayCell[]
  /** Видимые колонки дня (горизонтальная виртуализация). undefined → все. */
  columns?: VirtualColumn[]
}

export function ProjectRowContent({
  project,
  dayCells,
  columns,
}: ProjectRowContentProps) {
  const isExpanded = useSectionsPageUIStore((s) => s.isExpanded(`project-${project.id}`))
  const toggle = useSectionsPageUIStore((s) => s.toggle)

  const handleToggle = () => {
    toggle(`project-${project.id}`)
  }

  const timelineWidth = dayCells.length * DAY_CELL_WIDTH
  const dayCols: VirtualColumn[] =
    columns ?? dayCells.map((_, idx) => ({ index: idx, start: idx * DAY_CELL_WIDTH, size: DAY_CELL_WIDTH }))

  // Aggregate all loadings from all object sections for collapsed view
  const allProjectLoadings = useMemo((): SectionLoading[] => {
    return project.objectSections.flatMap(os => os.loadings)
  }, [project.objectSections])

  // Calculate aggregated capacity (sum of all sections' default capacities)
  const totalCapacity = useMemo(() => {
    return project.objectSections.reduce((sum, os) => {
      return sum + (os.defaultCapacity ?? 0)
    }, 0)
  }, [project.objectSections])

  // rerender-derived-state: подписка только на overrides релевantных разделов (useShallow)
  const sectionIds = useMemo(
    () => project.objectSections.map((os) => os.sectionId),
    [project.objectSections]
  )
  const capacityOverrides = useMultipleSectionsCapacityOverrides(sectionIds)

  // Compute per-date aggregated capacity
  const projectDateCapacityOverrides = useMemo(() => {
    const allDates = new Set(
      project.objectSections.flatMap((os) => Object.keys(capacityOverrides[os.sectionId] ?? {}))
    )
    if (allDates.size === 0) return {}
    const result: Record<string, number> = {}
    for (const dateStr of allDates) {
      result[dateStr] = project.objectSections.reduce((sum, os) => {
        return sum + (capacityOverrides[os.sectionId]?.[dateStr] ?? (os.defaultCapacity ?? 0))
      }, 0)
    }
    return result
  }, [project.objectSections, capacityOverrides])

  return (
    <div className="group/row min-w-full relative border-b border-border/50">
      <div
        className="flex transition-colors"
        style={{ minHeight: PROJECT_ROW_HEIGHT }}
      >
        {/* Sidebar - sticky left */}
        <div
          className="shrink-0 flex items-center justify-between pl-8 pr-3 py-2 border-r border-border bg-muted sticky left-0 z-10 cursor-pointer hover:bg-accent transition-colors"
          style={{ width: SIDEBAR_WIDTH }}
          onClick={handleToggle}
        >
          {/* Left: expand icon + project name */}
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex-shrink-0">
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-primary" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
            <FolderKanban className="h-4 w-4 text-amber-600 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="font-medium text-sm">
                {project.name}
              </div>
              {project.managerName && (
                <div className="text-xs text-muted-foreground">
                  РП: {project.managerName}
                </div>
              )}
            </div>
          </div>

          {/* Right: metrics */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded">
              {project.totalSections} разд. · {project.totalEmployees} сотр.
            </div>
          </div>
        </div>

        {/* Timeline cells with aggregation when collapsed */}
        <div className="flex relative z-0" style={{ width: timelineWidth }}>
          {/* MOCK: плановые даты проекта (мануальные + из разделов). Self-guard по MOCK_PROJECT_ID. */}
          <MockProjectDateBars
            projectId={project.id}
            dayCells={dayCells}
            rowHeight={PROJECT_ROW_HEIGHT}
          />
          {!isExpanded && allProjectLoadings.length > 0 && (
            <AggregatedBarsOverlay
              loadings={allProjectLoadings}
              defaultCapacity={totalCapacity}
              dateCapacityOverrides={projectDateCapacityOverrides}
              dayCells={dayCells}
              columns={columns}
              rowHeight={PROJECT_ROW_HEIGHT}
              editable={false}
              capacityHint="Ёмкость задаётся на строке раздела"
            />
          )}
          {dayCols.map((col) => {
            const cell = dayCells[col.index]
            if (!cell) return null
            return (
              <div
                key={col.index}
                className={`${getCellClassNames(cell)} absolute top-0 bottom-0`}
                style={{ left: col.start, width: col.size }}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}
