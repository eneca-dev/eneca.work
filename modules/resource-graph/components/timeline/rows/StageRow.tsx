'use client'

import { useState } from 'react'
import { Layers } from 'lucide-react'
import type { Stage, TimelineRange } from '../../../types'
import type { DayCell } from '../TimelineHeader'
import { BaseRow } from './BaseRow'
import { ObjectRow } from './ObjectRow'
import { ProjectReportsRow } from '../ProjectReportsRow'

// ============================================================================
// Stage Row
// ============================================================================

interface StageRowProps {
  stage: Stage
  dayCells: DayCell[]
  range: TimelineRange
}

/**
 * Строка стадии проекта
 */
export function StageRow({ stage, dayCells, range }: StageRowProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  // Всегда показываем кнопку развёртывания для стадий (отчёты могут быть даже без объектов)
  const hasChildren = true

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
      {/* Stage Reports Row */}
      <ProjectReportsRow
        stageId={stage.id}
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
