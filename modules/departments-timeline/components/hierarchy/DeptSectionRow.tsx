/**
 * DeptSectionRow — строка раздела (4-й уровень иерархии)
 *
 * Раскрывается в плоский список:
 * 1. Безличные загрузки (с bar: проект · объект)
 * 2. Именные сотрудники (с bar: проект · объект · этап если есть)
 *
 * Этап НЕ является уровнем дерева — он отображается на баре загрузки.
 */

'use client'

import { useMemo } from 'react'
import { FileText, ChevronDown, ChevronRight, Plus } from 'lucide-react'
import { useRowExpanded } from '../../stores'
import { useDeptTimelineActions } from '../../context'
import { getCellClassNames } from '../../utils'
import { SIDEBAR_WIDTH, DAY_CELL_WIDTH } from '../../constants'
import { collectSectionLoadings } from '../../utils/aggregate-bars'
import { AggregatedBarsOverlay } from './AggregatedBarsOverlay'
import { DeptImpersonalRow } from './DeptImpersonalRow'
import { DeptEmployeeRow } from './DeptEmployeeRow'
import type { HierarchyLevel } from './AggregatedBarsOverlay'
import type { DeptHierarchySection, DeptEmployeeLeaf } from '../../types/hierarchy'
import type { DayCell } from '../../types'

const SECTION_ROW_HEIGHT = 40

interface DeptSectionRowProps {
  section: DeptHierarchySection
  dayCells: DayCell[]
  projectName: string
  objectName: string
  /** Visual layout for aggregated bars: stacked (default) or side-by-side */
  sectionLevel?: HierarchyLevel
}

/** Employee + context for flat rendering */
interface FlatEmployee {
  employee: DeptEmployeeLeaf
  stageName?: string
}

export function DeptSectionRow({ section, dayCells, projectName, objectName, sectionLevel = 'section' }: DeptSectionRowProps) {
  const { isExpanded, toggle } = useRowExpanded('section', section.id)
  const { onCreateLoading } = useDeptTimelineActions()
  const timelineWidth = dayCells.length * DAY_CELL_WIDTH

  const collectedLoadings = useMemo(
    () => collectSectionLoadings(section),
    [section]
  )

  // Base bar label: project · object
  const baseBarLabel = `${projectName} · ${objectName}`

  // Flatten all employees (from stages + standalone) into a single list
  const flatEmployees = useMemo((): FlatEmployee[] => {
    const result: FlatEmployee[] = []

    // Employees from stages (with stage context)
    for (const stage of section.stages) {
      for (const emp of stage.employees) {
        result.push({ employee: emp, stageName: stage.name })
      }
    }

    // Standalone employees (no stage)
    for (const emp of section.standaloneEmployees) {
      result.push({ employee: emp })
    }

    return result
  }, [section.stages, section.standaloneEmployees])

  return (
    <>
      {/* Section header row */}
      <div className="group/row min-w-full relative border-b border-border/50">
        <div
          className="flex transition-colors cursor-pointer hover:bg-muted/30"
          style={{ height: SECTION_ROW_HEIGHT }}
          onClick={toggle}
        >
          {/* Sidebar */}
          <div
            className="shrink-0 flex items-center justify-between px-3 border-r border-border bg-card sticky left-0 z-20"
            style={{ width: SIDEBAR_WIDTH }}
          >
            <div className="flex items-center gap-2 min-w-0 pl-[56px]">
              <div className="flex-shrink-0">
                {isExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5 text-primary" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-primary" />
                )}
              </div>
              <FileText className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
              <span className="text-xs font-medium truncate">
                {section.name}
              </span>
            </div>

            {/* Actions + Aggregated metrics */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                type="button"
                className="h-5 w-5 rounded flex items-center justify-center opacity-0 group-hover/row:opacity-100 transition-opacity hover:bg-primary/10"
                onClick={(e) => {
                  e.stopPropagation()
                  onCreateLoading(section.id)
                }}
                title="Создать загрузку"
              >
                <Plus className="h-3 w-3 text-primary" />
              </button>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300">
                {section.impersonalCount} безлич
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">
                {section.employeeCount} сотруд
              </span>
            </div>
          </div>

          {/* Timeline cells + aggregated bars */}
          <div className="flex relative z-0" style={{ width: timelineWidth }}>
            <AggregatedBarsOverlay
              loadings={collectedLoadings}
              dayCells={dayCells}
              rowHeight={SECTION_ROW_HEIGHT}
              level={sectionLevel}
            />
            {dayCells.map((cell, i) => (
              <div
                key={i}
                className={getCellClassNames(cell)}
                style={{ width: DAY_CELL_WIDTH, height: SECTION_ROW_HEIGHT }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Children (expanded) — flat list */}
      {isExpanded && (
        <>
          {/* 1. Impersonal loadings */}
          {section.impersonalLoadings.map((loading) => (
            <DeptImpersonalRow
              key={loading.id}
              loading={loading}
              dayCells={dayCells}
              barLabel={baseBarLabel}
            />
          ))}
          {/* 2. All employees flat (from stages + standalone) */}
          {flatEmployees.map(({ employee, stageName }) => (
            <DeptEmployeeRow
              key={employee.id}
              employee={employee}
              dayCells={dayCells}
              barLabel={stageName ? `${baseBarLabel} · ${stageName}` : baseBarLabel}
            />
          ))}
        </>
      )}
    </>
  )
}
