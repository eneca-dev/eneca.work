'use client'

import { FolderKanban } from 'lucide-react'
import type { Project, TimelineRange } from '../../../types'
import type { DayCell } from '../TimelineHeader'
import { BaseRow } from './BaseRow'
import { ObjectRow } from './ObjectRow'
import { ProjectStatusTags } from '../shared'
import { useProjectTagsMap } from '../../../hooks'
import { useRowExpanded } from '../../../stores'
import { ProjectReportsRow } from '@/modules/project-reports'

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
  const { isExpanded, toggle } = useRowExpanded('project', project.id)
  // Всегда показываем кнопку развёртывания (отчёты могут быть даже без объектов)
  const hasChildren = true

  // Fetch project tags (cached, single request for all projects)
  const { data: tagsMap } = useProjectTagsMap()
  const projectTags = tagsMap?.[project.id] || []

  return (
    <BaseRow
      depth={0}
      isExpanded={isExpanded}
      onToggle={toggle}
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
      {/* Project Reports Row - на уровне проекта */}
      <ProjectReportsRow
        projectId={project.id}
        projectName={project.name}
        dayCells={dayCells}
        depth={1}
        range={range}
      />

      {/* Objects (напрямую под проектом, без Stage) */}
      {project.objects.map((obj) => (
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
