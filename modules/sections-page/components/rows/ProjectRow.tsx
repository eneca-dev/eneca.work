/**
 * Project Row Component
 *
 * Строка проекта на таймлайне разделов с агрегированными барами (когда свёрнут)
 */

'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { ChevronDown, ChevronRight, FolderKanban } from 'lucide-react'
import { useSectionsPageUIStore } from '../../stores/useSectionsPageUIStore'
import { SIDEBAR_WIDTH, DAY_CELL_WIDTH, PROJECT_ROW_HEIGHT } from '../../constants'
import { ObjectSectionRow } from './ObjectSectionRow'
import { AggregatedBarsOverlay } from '../AggregatedBarsOverlay'
import { getCellClassNames } from '../../utils/cell-utils'
import type { Project, DayCell, SectionLoading } from '../../types'

interface ProjectRowProps {
  project: Project
  projectIndex: number
  departmentId: string
  dayCells: DayCell[]
}

export function ProjectRow({
  project,
  projectIndex,
  departmentId,
  dayCells,
}: ProjectRowProps) {
  const isExpanded = useSectionsPageUIStore((s) => s.isExpanded(`project-${project.id}`))
  const toggle = useSectionsPageUIStore((s) => s.toggle)

  const handleToggle = () => {
    toggle(`project-${project.id}`)
  }

  const timelineWidth = dayCells.length * DAY_CELL_WIDTH

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

  return (
    <>
      {/* Project header row */}
      <div className="group/row min-w-full relative border-b border-border/50">
        <div
          className="flex transition-colors"
          style={{ height: PROJECT_ROW_HEIGHT }}
        >
          {/* Sidebar - sticky left */}
          <div
            className="shrink-0 flex items-center justify-between pl-8 pr-3 border-r border-border bg-muted sticky left-0 z-10 cursor-pointer hover:bg-accent transition-colors"
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
                <div className="font-medium text-sm truncate">
                  {project.name}
                </div>
                {project.managerName && (
                  <div className="text-xs text-muted-foreground truncate">
                    РП: {project.managerName}
                  </div>
                )}
              </div>
            </div>

            {/* Right: metrics */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded">
                {project.totalSections} разд. · {project.totalLoadings} загр.
              </div>
            </div>
          </div>

          {/* Timeline cells with aggregation when collapsed */}
          <div className="flex relative z-0" style={{ width: timelineWidth }}>
            {/* Show aggregated bars when collapsed */}
            {!isExpanded && allProjectLoadings.length > 0 && (
              <AggregatedBarsOverlay
                loadings={allProjectLoadings}
                defaultCapacity={totalCapacity}
                dateCapacityOverrides={{}}
                dayCells={dayCells}
                rowHeight={PROJECT_ROW_HEIGHT}
                editable={false}
                capacityHint="Ёмкость задаётся на строке раздела"
              />
            )}
            {dayCells.map((cell, i) => (
              <div
                key={`${project.id}-${cell.dateKey}-${i}`}
                className={getCellClassNames(cell)}
                style={{ width: DAY_CELL_WIDTH, height: PROJECT_ROW_HEIGHT }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Object/Sections (when expanded) */}
      {isExpanded &&
        project.objectSections.map((objectSection, sectionIndex) => (
          <ObjectSectionRow
            key={objectSection.id}
            objectSection={objectSection}
            sectionIndex={sectionIndex}
            projectId={project.id}
            projectName={project.name}
            departmentId={departmentId}
            dayCells={dayCells}
          />
        ))}
    </>
  )
}
