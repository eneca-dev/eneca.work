/**
 * DeptObjectSectionRow — строка Объект/Раздел (merged level)
 *
 * Expandable: показывает сотрудников внутри.
 * Агрегация X/Y на timeline с вертикальными мини-барами.
 * Ёмкость (Y) редактируется кликом по ячейке на таймлайне.
 */

'use client'

import { useMemo } from 'react'
import { Box, ChevronDown, ChevronRight, Plus } from 'lucide-react'
import { useRowExpanded, useDateCapacityOverrides } from '../../stores'
import { useDeptTimelineActions } from '../../context'
import { getCellClassNames } from '../../utils'
import { SIDEBAR_WIDTH, DAY_CELL_WIDTH } from '../../constants'
import { AggregatedBarsOverlay } from './AggregatedBarsOverlay'
import { DeptEmployeeRow } from './DeptEmployeeRow'
import type { DeptHierarchyObjectSection } from '../../types/hierarchy'
import type { DayCell } from '../../types'

const OBJECT_SECTION_ROW_HEIGHT = 40

interface DeptObjectSectionRowProps {
  objectSection: DeptHierarchyObjectSection
  dayCells: DayCell[]
  /** Название проекта — для отображения на барах сотрудников */
  projectName: string
}

export function DeptObjectSectionRow({ objectSection, dayCells, projectName }: DeptObjectSectionRowProps) {
  const { isExpanded, toggle } = useRowExpanded('object', objectSection.id)
  const { onCreateLoading } = useDeptTimelineActions()
  const timelineWidth = dayCells.length * DAY_CELL_WIDTH

  const employees = useMemo(() => objectSection.employees, [objectSection.employees])

  // Per-date capacity overrides from store
  const dateCapacityOverrides = useDateCapacityOverrides(objectSection.id)

  // Display label: "Объект / Раздел"
  const displayName = `${objectSection.objectName} / ${objectSection.sectionName}`

  return (
    <>
      {/* Object/Section header row */}
      <div className="group/row min-w-full relative border-b border-border/50">
        <div
          className="flex transition-colors cursor-pointer hover:bg-muted/30"
          style={{ height: OBJECT_SECTION_ROW_HEIGHT }}
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
                {displayName}
              </span>
            </div>

            {/* Actions + metrics */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                type="button"
                className="h-5 w-5 rounded flex items-center justify-center opacity-0 group-hover/row:opacity-100 transition-opacity hover:bg-primary/10"
                onClick={(e) => {
                  e.stopPropagation()
                  onCreateLoading(objectSection.id)
                }}
                title="Создать загрузку"
              >
                <Plus className="h-3 w-3 text-primary" />
              </button>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">
                {objectSection.employees.length} чел
              </span>
            </div>
          </div>

          {/* Timeline cells + aggregation (editable capacity) */}
          <div className="flex relative z-0" style={{ width: timelineWidth }}>
            <AggregatedBarsOverlay
              employees={employees}
              defaultCapacity={objectSection.capacity}
              dateCapacityOverrides={dateCapacityOverrides}
              dayCells={dayCells}
              rowHeight={OBJECT_SECTION_ROW_HEIGHT}
              editable
              osId={objectSection.id}
            />
            {dayCells.map((cell, i) => (
              <div
                key={i}
                className={getCellClassNames(cell)}
                style={{ width: DAY_CELL_WIDTH, height: OBJECT_SECTION_ROW_HEIGHT }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Employees (expanded) */}
      {isExpanded && (
        <>
          {objectSection.employees.map((employee) => (
            <DeptEmployeeRow
              key={employee.id}
              employee={employee}
              dayCells={dayCells}
              projectName={projectName}
              objectName={objectSection.objectName}
            />
          ))}
        </>
      )}
    </>
  )
}
