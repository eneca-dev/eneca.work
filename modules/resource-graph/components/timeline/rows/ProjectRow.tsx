'use client'

import { useState } from 'react'
import { FolderKanban } from 'lucide-react'
import type { Project, TimelineRange } from '../../../types'
import type { DayCell } from '../TimelineHeader'
import { BaseRow } from './BaseRow'
import { StageRow } from './StageRow'

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
