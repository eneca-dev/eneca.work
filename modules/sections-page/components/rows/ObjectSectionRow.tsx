/**
 * Object/Section Row Component
 *
 * Строка объект/раздел с агрегированными мини-барами X/Y и редактируемой ёмкостью
 */

'use client'

import { useMemo, useCallback } from 'react'
import { Box, ChevronDown, ChevronRight, UserPlus } from 'lucide-react'
import { useHasPermission } from '@/modules/permissions'
import { useRowExpanded, useDateCapacityOverrides } from '../../stores/useSectionsPageUIStore'
import { useSectionsPageActions } from '../../context'
import { getCellClassNames } from '../../utils/cell-utils'
import { SIDEBAR_WIDTH, DAY_CELL_WIDTH, OBJECT_SECTION_ROW_HEIGHT } from '../../constants'
import { AggregatedBarsOverlay } from '../AggregatedBarsOverlay'
import { EmployeeRow } from './EmployeeRow'
import { openLoadingModalNewCreate } from '@/modules/modals'
import { useDecompositionStages } from '@/modules/modals/hooks/useDecompositionStages'
import type { ObjectSection, DayCell, SectionLoading } from '../../types'

interface ObjectSectionRowProps {
  objectSection: ObjectSection
  sectionIndex: number
  projectId: string
  projectName: string
  departmentId: string
  dayCells: DayCell[]
}

export function ObjectSectionRow({
  objectSection,
  sectionIndex,
  projectId,
  projectName,
  departmentId,
  dayCells,
}: ObjectSectionRowProps) {
  const { isExpanded, toggle } = useRowExpanded('objectSection', objectSection.id)
  const timelineWidth = dayCells.length * DAY_CELL_WIDTH

  // Загрузка stages для раздела
  const { data: stages = [] } = useDecompositionStages({
    sectionId: objectSection.sectionId,
    enabled: true,
  })

  const loadings = useMemo(() => objectSection.loadings, [objectSection.loadings])

  // Per-date capacity overrides from store
  const dateCapacityOverrides = useDateCapacityOverrides(objectSection.sectionId)

  // Permission check for capacity editing
  const canEditCapacity = useHasPermission('sections.capacity.edit')

  // Group loadings by employee
  const employeesWithLoadings = useMemo(() => {
    const employeeMap = new Map<string, {
      employeeId: string
      employeeName: string
      employeeAvatarUrl: string | null
      employeeDepartmentName: string | null
      employeePosition: string | null
      employeeCategory: string | null
      employeeEmploymentRate: number | null
      loadings: SectionLoading[]
    }>()

    for (const loading of objectSection.loadings) {
      const empId = loading.employeeId
      if (!employeeMap.has(empId)) {
        employeeMap.set(empId, {
          employeeId: empId,
          employeeName: loading.employeeName,
          employeeAvatarUrl: loading.employeeAvatarUrl,
          employeeDepartmentName: loading.employeeDepartmentName,
          employeePosition: loading.employeePosition ?? null,
          employeeCategory: loading.employeeCategory ?? null,
          employeeEmploymentRate: loading.employeeEmploymentRate ?? null,
          loadings: [],
        })
      }
      employeeMap.get(empId)!.loadings.push(loading)
    }

    return Array.from(employeeMap.values())
  }, [objectSection.loadings])

  // Handler для открытия модалки создания загрузки
  const handleCreateLoading = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    openLoadingModalNewCreate({
      sectionId: objectSection.sectionId,
      projectId: projectId,
    })
  }, [objectSection.sectionId, projectId])

  return (
    <>
      {/* Object/Section header row */}
      <div className="group/row min-w-full relative border-b border-border/50">
        <div
          className="flex transition-colors"
          style={{ minHeight: OBJECT_SECTION_ROW_HEIGHT }}
        >
          {/* Sidebar wrapper - sticky, provides positioning context for the tab button */}
          <div
            className="shrink-0 sticky left-0 z-20 relative"
            style={{ width: SIDEBAR_WIDTH, minHeight: OBJECT_SECTION_ROW_HEIGHT }}
          >
            {/* Clickable area - hover highlight only here, NOT on the tab button */}
            <div
              className="flex items-center justify-between px-3 py-2 h-full border-r border-border bg-card cursor-pointer hover:bg-accent transition-colors"
              onClick={toggle}
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
                <span className="text-xs font-medium">
                  {objectSection.name}
                </span>
              </div>

              {/* Actions + metrics */}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">
                  {employeesWithLoadings.length} сотр
                </span>
              </div>
            </div>

            {/* Create loading tab - sibling to clickable area, so hover doesn't highlight the row */}
            <button
              type="button"
              className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-full z-30 opacity-0 group-hover/row:opacity-100 transition-opacity flex items-center gap-1 px-1.5 py-1 hover:bg-muted rounded-r text-[9px] text-muted-foreground hover:text-foreground bg-background border-r border-t border-b border-border"
              onClick={handleCreateLoading}
              title="Создать загрузку"
            >
              <UserPlus className="w-3 h-3" />
              <span>Загрузка</span>
            </button>
          </div>

          {/* Timeline cells + aggregation (editable capacity) */}
          <div className="flex relative z-0" style={{ width: timelineWidth }}>
            <AggregatedBarsOverlay
              loadings={loadings}
              defaultCapacity={objectSection.defaultCapacity ?? 0}
              dateCapacityOverrides={dateCapacityOverrides}
              dayCells={dayCells}
              rowHeight={OBJECT_SECTION_ROW_HEIGHT}
              editable={canEditCapacity}
              osId={objectSection.sectionId}
            />
            {dayCells.map((cell, i) => (
              <div
                key={i}
                className={`${getCellClassNames(cell)} self-stretch`}
                style={{ width: DAY_CELL_WIDTH }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Employees (expanded) */}
      {isExpanded && (
        <>
          {employeesWithLoadings.map((employee) => (
            <EmployeeRow
              key={employee.employeeId}
              employee={employee}
              sectionId={objectSection.sectionId}
              sectionName={objectSection.sectionName}
              projectId={projectId}
              projectName={projectName}
              objectId={objectSection.objectId}
              objectName={objectSection.objectName}
              dayCells={dayCells}
              stages={stages}
            />
          ))}
        </>
      )}
    </>
  )
}
