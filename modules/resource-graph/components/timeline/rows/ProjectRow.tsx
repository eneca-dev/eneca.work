'use client'

import { useState } from 'react'
import { FolderKanban } from 'lucide-react'
import type { Project, TimelineRange } from '../../../types'
import type { DayCell } from '../TimelineHeader'
import { BaseRow } from './BaseRow'
import { StageRow } from './StageRow'
import { ProjectStatusTags } from '../shared'
import { useProjectTagsMap } from '../../../hooks'

// ============================================================================
// Project Row (Top Level)
// ============================================================================

interface ProjectRowProps {
  project: Project
  dayCells: DayCell[]
  range: TimelineRange
}

/**
 * Строка проекта - верхний уровень иерархии
 */
export function ProjectRow({ project, dayCells, range }: ProjectRowProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const hasChildren = project.stages.length > 0

  // Fetch project tags (cached, single request for all projects)
  const { data: tagsMap } = useProjectTagsMap()
  const projectTags = tagsMap?.[project.id] || []

  return (
    <BaseRow
      depth={0}
      isExpanded={isExpanded}
      onToggle={() => setIsExpanded(!isExpanded)}
      hasChildren={hasChildren}
      icon={<FolderKanban className="w-4 h-4" />}
      label={project.name}
      sidebarExtra={
        <ProjectStatusTags
          status={project.status}
          tags={projectTags}
          maxTags={2}
        />
      }
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
