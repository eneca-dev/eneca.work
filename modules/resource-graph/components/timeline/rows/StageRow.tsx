'use client'

import { Layers } from 'lucide-react'
import type { Stage, TimelineRange } from '../../../types'
import type { DayCell } from '../TimelineHeader'
import { BaseRow } from './BaseRow'
import { ObjectRow } from './ObjectRow'
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
  const hasChildren = stage.objects.length > 0

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
