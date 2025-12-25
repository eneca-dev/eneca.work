'use client'

import { Layers } from 'lucide-react'
import type { Stage, TimelineRange } from '../../../types'
import type { DayCell } from '../TimelineHeader'
import { BaseRow } from './BaseRow'
import { ObjectRow } from './ObjectRow'
import { ProjectReportsRow } from '@/modules/project-reports'
import { useRowExpanded } from '../../../stores'

// ============================================================================
// Stage Row
// ============================================================================

interface StageRowProps {
  stage: Stage
  projectName: string
  dayCells: DayCell[]
  range: TimelineRange
}

/**
 * Строка стадии проекта
 */
export function StageRow({ stage, projectName, dayCells, range }: StageRowProps) {
  const { isExpanded, toggle } = useRowExpanded('stage', stage.id)
  // Всегда показываем кнопку развёртывания для стадий (отчёты могут быть даже без объектов)
  const hasChildren = true

  return (
    <BaseRow
      depth={1}
      isExpanded={isExpanded}
      onToggle={toggle}
      hasChildren={hasChildren}
      icon={<Layers className="w-4 h-4" />}
      label={stage.name}
      dayCells={dayCells}
      range={range}
    >
      {/* Stage Reports Row */}
      <ProjectReportsRow
        stageId={stage.id}
        projectName={projectName}
        stageName={stage.name}
        dayCells={dayCells}
        depth={2}
        range={range}
      />

      {/* Objects */}
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
