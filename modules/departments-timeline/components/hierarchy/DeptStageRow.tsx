/**
 * DeptStageRow — строка этапа декомпозиции (expandable)
 *
 * Этап группирует сотрудников. Раскрывается для показа сотрудников внутри.
 */

'use client'

import { Layers, ChevronDown, ChevronRight } from 'lucide-react'
import { useRowExpanded } from '../../stores'
import { getCellClassNames } from '../../utils'
import { SIDEBAR_WIDTH, DAY_CELL_WIDTH } from '../../constants'
import { DeptEmployeeRow } from './DeptEmployeeRow'
import type { DeptStageGroup } from '../../types/hierarchy'
import type { DayCell } from '../../types'

const STAGE_ROW_HEIGHT = 38

interface DeptStageRowProps {
  stage: DeptStageGroup
  dayCells: DayCell[]
}

export function DeptStageRow({ stage, dayCells }: DeptStageRowProps) {
  const { isExpanded, toggle } = useRowExpanded('section', stage.id)
  const timelineWidth = dayCells.length * DAY_CELL_WIDTH

  return (
    <>
      {/* Stage header row */}
      <div className="group/row min-w-full relative border-b border-border/30">
        <div
          className="flex transition-colors cursor-pointer hover:bg-muted/20"
          style={{ height: STAGE_ROW_HEIGHT }}
          onClick={toggle}
        >
          {/* Sidebar */}
          <div
            className="shrink-0 flex items-center justify-between px-3 border-r border-border bg-card sticky left-0 z-20"
            style={{ width: SIDEBAR_WIDTH }}
          >
            <div className="flex items-center gap-2 min-w-0 pl-[72px]">
              <div className="flex-shrink-0">
                {isExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5 text-primary" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-primary" />
                )}
              </div>
              <Layers className="h-3.5 w-3.5 text-violet-500 flex-shrink-0" />
              <span className="text-xs font-medium text-muted-foreground truncate">
                {stage.name}
              </span>
            </div>

            {/* Employee count badge */}
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300 flex-shrink-0">
              {stage.employees.length} сотр
            </span>
          </div>

          {/* Timeline cells */}
          <div className="flex relative z-0" style={{ width: timelineWidth }}>
            {dayCells.map((cell, i) => (
              <div
                key={i}
                className={getCellClassNames(cell)}
                style={{ width: DAY_CELL_WIDTH, height: STAGE_ROW_HEIGHT }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Employees inside stage (expanded) */}
      {isExpanded && (
        <>
          {stage.employees.map((employee) => (
            <DeptEmployeeRow
              key={employee.id}
              employee={employee}
              dayCells={dayCells}
              paddingLeft={88}
            />
          ))}
        </>
      )}
    </>
  )
}
