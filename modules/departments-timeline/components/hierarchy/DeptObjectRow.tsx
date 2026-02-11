/**
 * DeptObjectRow — строка объекта (3-й уровень иерархии)
 *
 * Раскрывается в разделы
 */

'use client'

import { useMemo } from 'react'
import { Box, ChevronDown, ChevronRight } from 'lucide-react'
import { useRowExpanded } from '../../stores'
import { getCellClassNames } from '../../utils'
import { SIDEBAR_WIDTH, DAY_CELL_WIDTH } from '../../constants'
import { collectFromObject } from '../../utils/aggregate-bars'
import { AggregatedBarsOverlay } from './AggregatedBarsOverlay'
import { DeptSectionRow } from './DeptSectionRow'
import type { DeptHierarchyObject } from '../../types/hierarchy'
import type { DayCell } from '../../types'

const OBJECT_ROW_HEIGHT = 40

interface DeptObjectRowProps {
  object: DeptHierarchyObject
  dayCells: DayCell[]
  projectName: string
}

export function DeptObjectRow({ object, dayCells, projectName }: DeptObjectRowProps) {
  const { isExpanded, toggle } = useRowExpanded('object', object.id)
  const timelineWidth = dayCells.length * DAY_CELL_WIDTH

  const collectedLoadings = useMemo(
    () => collectFromObject(object),
    [object]
  )

  return (
    <>
      {/* Object header row */}
      <div className="group/row min-w-full relative border-b border-border/50">
        <div
          className="flex transition-colors cursor-pointer hover:bg-muted/30"
          style={{ height: OBJECT_ROW_HEIGHT }}
          onClick={toggle}
        >
          {/* Sidebar */}
          <div
            className="shrink-0 flex items-center justify-between px-3 border-r border-border bg-card sticky left-0 z-20"
            style={{ width: SIDEBAR_WIDTH }}
          >
            <div className="flex items-center gap-2 min-w-0 pl-[40px]">
              <div className="flex-shrink-0">
                {isExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5 text-primary" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-primary" />
                )}
              </div>
              <Box className="h-3.5 w-3.5 text-cyan-600 flex-shrink-0" />
              <span className="text-xs font-medium truncate">
                {object.name}
              </span>
            </div>

            {/* Aggregated metrics */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300">
                {object.impersonalCount} безлич
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">
                {object.employeeCount} сотруд
              </span>
            </div>
          </div>

          {/* Timeline cells + aggregated bars */}
          <div className="flex relative z-0" style={{ width: timelineWidth }}>
            <AggregatedBarsOverlay
              loadings={collectedLoadings}
              dayCells={dayCells}
              rowHeight={OBJECT_ROW_HEIGHT}
              level="object"
            />
            {dayCells.map((cell, i) => (
              <div
                key={i}
                className={getCellClassNames(cell)}
                style={{ width: DAY_CELL_WIDTH, height: OBJECT_ROW_HEIGHT }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Sections (expanded) — alternating stacked / side-by-side for comparison */}
      {isExpanded && (
        <>
          {object.sections.map((section, i) => (
            <DeptSectionRow
              key={section.id}
              section={section}
              dayCells={dayCells}
              projectName={projectName}
              objectName={object.name}
              sectionLevel={i % 2 === 0 ? 'section' : 'section-side-by-side'}
            />
          ))}
        </>
      )}
    </>
  )
}
