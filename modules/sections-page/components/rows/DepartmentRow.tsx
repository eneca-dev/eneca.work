/**
 * Department Row (content) Component — одна строка отдела на таймлайне разделов.
 * Раскрытие проектов/разделов/сотрудников — через flatten + виртуализатор.
 */

'use client'

import { useMemo } from 'react'
import { ChevronDown, ChevronRight, Building2 } from 'lucide-react'
import { useSectionsPageUIStore } from '../../stores/useSectionsPageUIStore'
import { SIDEBAR_WIDTH, DEPARTMENT_ROW_HEIGHT } from '../../constants'
import { WEEK_CELL_WIDTH, SECTIONS_MONTH_CELL_WIDTH } from '@/modules/resource-graph/constants'
import { AggregatedBarsOverlay } from '../AggregatedBarsOverlay'
import { WeeklyAggregatedBarsOverlay } from '../WeeklyAggregatedBarsOverlay'
import { MonthlyAggregatedBarsOverlay } from '../MonthlyAggregatedBarsOverlay'
import { getCellClassNames, getWeekCellClassNames, getMonthCellClassNames } from '../../utils/cell-utils'
import { getTimelineGrid } from '../../utils/timeline-grid'
import type { Department, DayCell, SectionLoading } from '../../types'
import type { WeekCell } from '@/modules/resource-graph/utils/weekly-cell-utils'
import type { MonthCell } from '@/modules/resource-graph/utils/monthly-cell-utils'
import type { VirtualColumn } from '@/modules/shared/virtualized-tree'

interface DepartmentRowContentProps {
  department: Department
  dayCells: DayCell[]
  /** Видимые колонки дня (горизонтальная виртуализация). undefined → все. */
  columns?: VirtualColumn[]
  /** Недельные ячейки — задано только в недельном режиме */
  weekCells?: WeekCell[]
  /** Месячные ячейки — задано только в месячном режиме */
  monthCells?: MonthCell[]
}

export function DepartmentRowContent({
  department,
  dayCells,
  columns,
  weekCells,
  monthCells,
}: DepartmentRowContentProps) {
  const { isDailyMode, isWeeklyMode, isMonthlyMode, timelineWidth, dayCols, weekCols, monthCols } =
    getTimelineGrid({ dayCells, weekCells, monthCells, columns })
  const isExpanded = useSectionsPageUIStore((s) => s.isExpanded(`department-${department.id}`))
  const toggle = useSectionsPageUIStore((s) => s.toggle)

  const handleToggle = () => {
    toggle(`department-${department.id}`)
  }

  // X: агрегация всех загрузок из всех проектов и разделов отдела
  const allDepartmentLoadings = useMemo((): SectionLoading[] => {
    return department.projects.flatMap(p =>
      p.objectSections.flatMap(os => os.loadings)
    )
  }, [department.projects])

  // Y: суммарная ёмкость всех разделов всех проектов отдела.
  // Округляем до 0.01 — иначе сумма чисел с плавающей точкой (0.2+0.2+0.2)
  // даёт 0.6000000000000001 вместо 0.6.
  const totalDepartmentCapacity = useMemo(() => {
    const rawSum = department.projects.reduce((sum, p) =>
      sum + p.objectSections.reduce((s, os) => s + (os.defaultCapacity ?? 0), 0)
    , 0)
    return Math.round(rawSum * 100) / 100
  }, [department.projects])

  // Агрегация по всем разделам всех проектов отдела (источник — серверные capacityOverrides)
  const allSections = useMemo(
    () => department.projects.flatMap((p) => p.objectSections),
    [department.projects]
  )

  // Compute per-date aggregated capacity across all sections of all projects
  const departmentDateCapacityOverrides = useMemo(() => {
    const allDates = new Set(
      allSections.flatMap((os) => Object.keys(os.capacityOverrides ?? {}))
    )
    if (allDates.size === 0) return {}
    const result: Record<string, number> = {}
    for (const dateStr of allDates) {
      const rawSum = allSections.reduce((sum, os) => {
        return sum + (os.capacityOverrides?.[dateStr] ?? (os.defaultCapacity ?? 0))
      }, 0)
      result[dateStr] = Math.round(rawSum * 100) / 100
    }
    return result
  }, [allSections])

  return (
    <div className="group/row min-w-full relative border-b border-border">
      <div
        className="flex transition-colors"
        style={{ height: DEPARTMENT_ROW_HEIGHT }}
      >
        {/* Sidebar - sticky left */}
        <div
          className="shrink-0 flex items-center justify-between px-3 border-r border-border bg-card sticky left-0 z-10 cursor-pointer hover:bg-accent transition-colors"
          style={{ width: SIDEBAR_WIDTH }}
          onClick={handleToggle}
        >
          {/* Left: expand icon + department name */}
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex-shrink-0">
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-primary" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
            <Building2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-sm truncate">
                {department.name}
              </div>
              {department.departmentHeadName && (
                <div className="text-xs text-muted-foreground truncate">
                  {department.departmentHeadName}
                </div>
              )}
            </div>
          </div>

          {/* Right: занятость сегодня относительно штата отдела (feature-AB-06).
              departmentHeadcount === null — знаменатель недоступен (запрос штата не
              удался) или несопоставим с busyTodayCount (активен фильтр team/project,
              сужающий занятость ниже уровня всего отдела) — показываем без "из Y". */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded">
              занято {department.busyTodayCount}
              {department.departmentHeadcount !== null && <> из {department.departmentHeadcount}</>}
              {department.busyOnNonProjectCount > 0 && (
                <> · {department.busyOnNonProjectCount} на непроектных</>
              )}
            </div>
          </div>
        </div>

        {/* Timeline cells with department-level capacity aggregation */}
        <div className="flex relative z-0" style={{ width: timelineWidth }}>
          {/* Ветвим по самим ячейкам, а не по флагам режима: так TypeScript сужает
              weekCells/monthCells до непустых и их можно передать вниз без `!`. */}
          {allDepartmentLoadings.length > 0 && (
            weekCells ? (
              <WeeklyAggregatedBarsOverlay
                loadings={allDepartmentLoadings}
                defaultCapacity={totalDepartmentCapacity}
                dateCapacityOverrides={departmentDateCapacityOverrides}
                weekCells={weekCells}
                weekCellWidth={WEEK_CELL_WIDTH}
                columns={columns}
                rowHeight={DEPARTMENT_ROW_HEIGHT}
                editable={false}
                decimals={0}
              />
            ) : monthCells ? (
              <MonthlyAggregatedBarsOverlay
                loadings={allDepartmentLoadings}
                defaultCapacity={totalDepartmentCapacity}
                dateCapacityOverrides={departmentDateCapacityOverrides}
                monthCells={monthCells}
                monthCellWidth={SECTIONS_MONTH_CELL_WIDTH}
                columns={columns}
                rowHeight={DEPARTMENT_ROW_HEIGHT}
                editable={false}
                decimals={0}
              />
            ) : (
              <AggregatedBarsOverlay
                loadings={allDepartmentLoadings}
                defaultCapacity={totalDepartmentCapacity}
                dateCapacityOverrides={departmentDateCapacityOverrides}
                dayCells={dayCells}
                columns={columns}
                rowHeight={DEPARTMENT_ROW_HEIGHT}
                editable={false}
                decimals={0}
              />
            )
          )}
          {/* Колонки неактивных режимов — пустые массивы (см. getTimelineGrid),
              поэтому отдельные флаги режима здесь не нужны. */}
          {dayCols.map((col) => {
            const cell = dayCells[col.index]
            if (!cell) return null
            return (
              <div
                key={`d-${col.index}`}
                className={`${getCellClassNames(cell)} absolute top-0 bottom-0`}
                style={{ left: col.start, width: col.size }}
              />
            )
          })}
          {weekCols.map((col) => {
            const week = weekCells?.[col.index]
            if (!week) return null
            return (
              <div
                key={`w-${col.index}`}
                className={`${getWeekCellClassNames(week)} absolute top-0 bottom-0`}
                style={{ left: col.start, width: col.size }}
              />
            )
          })}
          {monthCols.map((col) => {
            const month = monthCells?.[col.index]
            if (!month) return null
            return (
              <div
                key={`m-${col.index}`}
                className={`${getMonthCellClassNames(month, col.index)} absolute top-0 bottom-0`}
                style={{ left: col.start, width: col.size }}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}
