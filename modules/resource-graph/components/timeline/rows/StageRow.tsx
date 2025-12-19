'use client'

import { useState } from 'react'
import { Layers } from 'lucide-react'
import type { Stage, TimelineRange } from '../../../types'
import type { DayCell } from '../TimelineHeader'
import { BaseRow } from './BaseRow'
import { ObjectRow } from './ObjectRow'

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
  const hasChildren = stage.objects.length > 0

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
