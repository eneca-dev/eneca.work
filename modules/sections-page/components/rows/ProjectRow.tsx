/**
 * Project Row (content) Component — одна строка проекта на таймлайне разделов.
 * Агрегированные мини-бары + редактирование ёмкости видны независимо от expand state. Дети — через flatten.
 */

'use client'

import { useCallback, useMemo } from 'react'
import { ChevronDown, ChevronRight, FolderKanban } from 'lucide-react'
import { useHasPermission } from '@/modules/permissions'
import { useSectionsPageUIStore } from '../../stores/useSectionsPageUIStore'
import { SIDEBAR_WIDTH, DAY_CELL_WIDTH, PROJECT_ROW_HEIGHT } from '../../constants'
import { WEEK_CELL_WIDTH } from '@/modules/resource-graph/constants'
import { AggregatedBarsOverlay } from '../AggregatedBarsOverlay'
import { WeeklyAggregatedBarsOverlay } from '../WeeklyAggregatedBarsOverlay'
import { getCellClassNames, getWeekCellClassNames } from '../../utils/cell-utils'
import { expandDateRange } from '../../utils/capacity'
import { MockProjectDateBars } from '../mock/MockProjectDateBars'
import { useUpsertSectionCapacityBatch } from '../../hooks'
import type { Project, DayCell, SectionLoading } from '../../types'
import type { WeekCell } from '@/modules/resource-graph/utils/weekly-cell-utils'
import type { VirtualColumn } from '@/modules/shared/virtualized-tree'

interface ProjectRowContentProps {
  project: Project
  dayCells: DayCell[]
  /** Видимые колонки дня (горизонтальная виртуализация). undefined → все. */
  columns?: VirtualColumn[]
  /** Недельные ячейки — задано только в недельном режиме */
  weekCells?: WeekCell[]
}

export function ProjectRowContent({
  project,
  dayCells,
  columns,
  weekCells,
}: ProjectRowContentProps) {
  const isWeeklyMode = weekCells !== undefined
  const isExpanded = useSectionsPageUIStore((s) => s.isExpanded(`project-${project.id}`))
  const toggle = useSectionsPageUIStore((s) => s.toggle)

  const handleToggle = () => {
    toggle(`project-${project.id}`)
  }

  const timelineWidth = isWeeklyMode
    ? weekCells.length * WEEK_CELL_WIDTH
    : dayCells.length * DAY_CELL_WIDTH
  const dayCols: VirtualColumn[] =
    columns ?? dayCells.map((_, idx) => ({ index: idx, start: idx * DAY_CELL_WIDTH, size: DAY_CELL_WIDTH }))
  const weekCols: VirtualColumn[] =
    columns ?? (weekCells ?? []).map((_, idx) => ({ index: idx, start: idx * WEEK_CELL_WIDTH, size: WEEK_CELL_WIDTH }))

  // Aggregate all loadings from all object sections for collapsed view
  const allProjectLoadings = useMemo((): SectionLoading[] => {
    return project.objectSections.flatMap(os => os.loadings)
  }, [project.objectSections])

  // Calculate aggregated capacity (sum of all sections' default capacities).
  // Округляем до 0.01 — иначе сумма чисел с плавающей точкой (0.2+0.2+0.2)
  // даёт 0.6000000000000001 вместо 0.6.
  const totalCapacity = useMemo(() => {
    const rawSum = project.objectSections.reduce((sum, os) => {
      return sum + (os.defaultCapacity ?? 0)
    }, 0)
    return Math.round(rawSum * 100) / 100
  }, [project.objectSections])

  // Compute per-date aggregated capacity (источник — серверные capacityOverrides разделов)
  const projectDateCapacityOverrides = useMemo(() => {
    const allDates = new Set(
      project.objectSections.flatMap((os) => Object.keys(os.capacityOverrides ?? {}))
    )
    if (allDates.size === 0) return {}
    const result: Record<string, number> = {}
    for (const dateStr of allDates) {
      const rawSum = project.objectSections.reduce((sum, os) => {
        return sum + (os.capacityOverrides?.[dateStr] ?? (os.defaultCapacity ?? 0))
      }, 0)
      result[dateStr] = Math.round(rawSum * 100) / 100
    }
    return result
  }, [project.objectSections])

  // Permission check for capacity editing
  const canEditCapacity = useHasPermission('sections.capacity.edit')

  const { mutate: saveCapacityBatch } = useUpsertSectionCapacityBatch()

  // Ввод ёмкости на строке проекта делит введённое число поровну на все разделы
  // проекта (чтобы сумма при агрегации совпадала с тем, что ввёл пользователь,
  // а не умножалась на количество разделов). Округляем до 0.01, остаток от
  // округления уходит на последний раздел — чтобы сумма точно билась.
  const handleSaveCapacity = useCallback((startDate: string, endDate: string, value: number) => {
    const dates = expandDateRange(startDate, endDate)
    const sectionCount = project.objectSections.length
    if (sectionCount === 0) return

    const base = Math.floor((value / sectionCount) * 100) / 100
    const inputs = project.objectSections.flatMap((os, index) => {
      const isLast = index === sectionCount - 1
      const sectionValue = isLast
        ? Math.round((value - base * (sectionCount - 1)) * 100) / 100
        : base
      return dates.map((date) => ({
        sectionId: os.sectionId,
        capacityDate: date,
        capacityValue: sectionValue,
      }))
    })
    saveCapacityBatch(inputs)
  }, [project.objectSections, saveCapacityBatch])

  return (
    <div className="group/row min-w-full relative border-b border-border/50">
      <div
        className="flex transition-colors"
        style={{ minHeight: PROJECT_ROW_HEIGHT }}
      >
        {/* Sidebar - sticky left */}
        <div
          className="shrink-0 flex items-center justify-between pl-8 pr-3 py-2 border-r border-border bg-muted sticky left-0 z-10 cursor-pointer hover:bg-accent transition-colors"
          style={{ width: SIDEBAR_WIDTH }}
          onClick={handleToggle}
        >
          {/* Left: expand icon + project name */}
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex-shrink-0">
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-primary" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
            <FolderKanban className="h-4 w-4 text-amber-600 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="font-medium text-sm">
                {project.name}
              </div>
              {project.managerName && (
                <div className="text-xs text-muted-foreground">
                  РП: {project.managerName}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Timeline cells with aggregation (видна и свёрнутой, и развёрнутой — редактирование ёмкости не завязано на expand state) */}
        <div className="flex relative z-0" style={{ width: timelineWidth }}>
          {/* MOCK: плановые даты проекта (мануальные + из разделов). Self-guard по MOCK_PROJECT_ID. */}
          {!isWeeklyMode && (
            <MockProjectDateBars
              projectId={project.id}
              dayCells={dayCells}
              rowHeight={PROJECT_ROW_HEIGHT}
            />
          )}
          {(allProjectLoadings.length > 0 || canEditCapacity) && (
            isWeeklyMode ? (
              <WeeklyAggregatedBarsOverlay
                loadings={allProjectLoadings}
                defaultCapacity={totalCapacity}
                dateCapacityOverrides={projectDateCapacityOverrides}
                weekCells={weekCells}
                weekCellWidth={WEEK_CELL_WIDTH}
                columns={columns}
                rowHeight={PROJECT_ROW_HEIGHT}
                editable={canEditCapacity}
                onSaveCapacity={canEditCapacity ? handleSaveCapacity : undefined}
              />
            ) : (
              <AggregatedBarsOverlay
                loadings={allProjectLoadings}
                defaultCapacity={totalCapacity}
                dateCapacityOverrides={projectDateCapacityOverrides}
                dayCells={dayCells}
                columns={columns}
                rowHeight={PROJECT_ROW_HEIGHT}
                editable={canEditCapacity}
                onSaveCapacity={canEditCapacity ? handleSaveCapacity : undefined}
              />
            )
          )}
          {!isWeeklyMode && dayCols.map((col) => {
            const cell = dayCells[col.index]
            if (!cell) return null
            return (
              <div
                key={col.index}
                className={`${getCellClassNames(cell)} absolute top-0 bottom-0`}
                style={{ left: col.start, width: col.size }}
              />
            )
          })}
          {isWeeklyMode && weekCols.map((col) => {
            const week = weekCells?.[col.index]
            if (!week) return null
            return (
              <div
                key={col.index}
                className={`${getWeekCellClassNames(week)} absolute top-0 bottom-0`}
                style={{ left: col.start, width: col.size }}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}
