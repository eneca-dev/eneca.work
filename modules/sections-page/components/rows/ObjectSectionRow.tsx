/**
 * Object/Section Row (content) Component — одна строка объект/раздел.
 * Агрегированные мини-бары X/Y + редактируемая ёмкость. Сотрудники — через flatten.
 */

'use client'

import { useMemo, useCallback } from 'react'
import { Box, ChevronDown, ChevronRight, UserPlus } from 'lucide-react'
import { useHasPermission, useHasAnyLoadingEditPermission } from '@/modules/permissions'
import { useRowExpanded } from '../../stores/useSectionsPageUIStore'
import { getCellClassNames, getWeekCellClassNames } from '../../utils/cell-utils'
import { expandDateRange } from '../../utils/capacity'
import { SIDEBAR_WIDTH, DAY_CELL_WIDTH, OBJECT_SECTION_ROW_HEIGHT } from '../../constants'
import { WEEK_CELL_WIDTH } from '@/modules/resource-graph/constants'
import { AggregatedBarsOverlay } from '../AggregatedBarsOverlay'
import { WeeklyAggregatedBarsOverlay } from '../WeeklyAggregatedBarsOverlay'
import { openLoadingModalNewCreate } from '@/modules/modals'
import { useUpsertSectionCapacityBatch } from '../../hooks'
import { MockSectionPeriodBar } from '../mock/MockSectionPeriodBar'
import { MockCapacityPlanBar } from '../mock/MockCapacityPlanBar'
import { MOCK_PROJECT_ID } from '@/modules/resource-graph/mocks/stagePeriods'
import type { ObjectSection, DayCell } from '../../types'
import type { WeekCell } from '@/modules/resource-graph/utils/weekly-cell-utils'
import type { VirtualColumn } from '@/modules/shared/virtualized-tree'

interface ObjectSectionRowContentProps {
  objectSection: ObjectSection
  projectId: string
  dayCells: DayCell[]
  /** Видимые колонки дня (горизонтальная виртуализация). undefined → все. */
  columns?: VirtualColumn[]
  /** Недельные ячейки — задано только в недельном режиме */
  weekCells?: WeekCell[]
}

export function ObjectSectionRowContent({
  objectSection,
  projectId,
  dayCells,
  columns,
  weekCells,
}: ObjectSectionRowContentProps) {
  const isWeeklyMode = weekCells !== undefined
  const { isExpanded, toggle } = useRowExpanded('objectSection', objectSection.id)
  const timelineWidth = isWeeklyMode
    ? weekCells.length * WEEK_CELL_WIDTH
    : dayCells.length * DAY_CELL_WIDTH
  const dayCols: VirtualColumn[] =
    columns ?? dayCells.map((_, idx) => ({ index: idx, start: idx * DAY_CELL_WIDTH, size: DAY_CELL_WIDTH }))
  const weekCols: VirtualColumn[] =
    columns ?? (weekCells ?? []).map((_, idx) => ({ index: idx, start: idx * WEEK_CELL_WIDTH, size: WEEK_CELL_WIDTH }))

  // Для мок-проекта: верхняя зона — плановая ёмкость, нижняя — фактические загрузки
  const MOCK_CAPACITY_ZONE_HEIGHT = 20
  const effectiveRowHeight = projectId === MOCK_PROJECT_ID
    ? OBJECT_SECTION_ROW_HEIGHT + MOCK_CAPACITY_ZONE_HEIGHT
    : OBJECT_SECTION_ROW_HEIGHT

  const loadings = useMemo(() => objectSection.loadings, [objectSection.loadings])

  // Per-date capacity overrides — с сервера (часть иерархии, отдельного запроса не требует)
  const dateCapacityOverrides = objectSection.capacityOverrides

  // Permission check for capacity editing
  const canEditCapacity = useHasPermission('sections.capacity.edit')

  const { mutate: saveCapacityBatch } = useUpsertSectionCapacityBatch()

  const handleSaveCapacity = useCallback((startDate: string, endDate: string, value: number) => {
    const dates = expandDateRange(startDate, endDate)
    saveCapacityBatch(
      dates.map((date) => ({
        sectionId: objectSection.sectionId,
        capacityDate: date,
        capacityValue: value,
      }))
    )
  }, [objectSection.sectionId, saveCapacityBatch])

  // Permission: есть ли хотя бы одна edit-permission на загрузки
  const canCreateAnyLoading = useHasAnyLoadingEditPermission()

  // Кол-во уникальных сотрудников раздела — для бейджа «N сотр».
  const employeeCount = useMemo(() => {
    const ids = new Set<string>()
    for (const loading of objectSection.loadings) ids.add(loading.employeeId)
    return ids.size
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
    <div className="group/row min-w-full relative border-b border-border/50">
      <div
        className="flex transition-colors"
        style={{ minHeight: effectiveRowHeight }}
      >
        {/* Sidebar wrapper - sticky, provides positioning context for the tab button */}
        <div
          className="shrink-0 sticky left-0 z-20 relative"
          style={{ width: SIDEBAR_WIDTH, minHeight: effectiveRowHeight }}
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
                {employeeCount} сотр
              </span>
            </div>
          </div>

          {/* Create loading tab - sibling to clickable area, so hover doesn't highlight the row */}
          {canCreateAnyLoading && (
            <button
              type="button"
              className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-full z-30 opacity-0 group-hover/row:opacity-100 transition-opacity flex items-center gap-1 px-1.5 py-1 hover:bg-muted rounded-r text-[9px] text-muted-foreground hover:text-foreground bg-background border-r border-t border-b border-border"
              onClick={handleCreateLoading}
              title="Создать загрузку"
            >
              <UserPlus className="w-3 h-3" />
              <span>Загрузка</span>
            </button>
          )}
        </div>

        {/* Timeline cells + aggregation (editable capacity) */}
        <div className="flex relative z-0" style={{ width: timelineWidth }}>
          {/* MOCK: подоснова дат раздела + плановая ёмкость (верхняя зона). Компоненты не само-защищены — обёртка по MOCK_PROJECT_ID. */}
          {!isWeeklyMode && projectId === MOCK_PROJECT_ID && (
            <>
              <MockSectionPeriodBar
                sectionId={objectSection.sectionId}
                dayCells={dayCells}
                rowHeight={effectiveRowHeight}
              />
              <MockCapacityPlanBar
                sectionId={objectSection.sectionId}
                dayCells={dayCells}
              />
            </>
          )}
          {/* Фактические загрузки: для мок-проекта — нижняя зона строки */}
          {isWeeklyMode ? (
            <WeeklyAggregatedBarsOverlay
              loadings={loadings}
              defaultCapacity={objectSection.defaultCapacity ?? 0}
              dateCapacityOverrides={dateCapacityOverrides}
              weekCells={weekCells}
              weekCellWidth={WEEK_CELL_WIDTH}
              columns={columns}
              rowHeight={OBJECT_SECTION_ROW_HEIGHT}
              editable={canEditCapacity}
              onSaveCapacity={canEditCapacity ? handleSaveCapacity : undefined}
            />
          ) : projectId === MOCK_PROJECT_ID ? (
            <div
              style={{
                position: 'absolute',
                top: MOCK_CAPACITY_ZONE_HEIGHT,
                left: 0,
                right: 0,
                height: OBJECT_SECTION_ROW_HEIGHT,
              }}
            >
              <AggregatedBarsOverlay
                loadings={loadings}
                defaultCapacity={objectSection.defaultCapacity ?? 0}
                dateCapacityOverrides={dateCapacityOverrides}
                dayCells={dayCells}
                columns={columns}
                rowHeight={OBJECT_SECTION_ROW_HEIGHT}
                editable={canEditCapacity}
                onSaveCapacity={canEditCapacity ? handleSaveCapacity : undefined}
              />
            </div>
          ) : (
            <AggregatedBarsOverlay
              loadings={loadings}
              defaultCapacity={objectSection.defaultCapacity ?? 0}
              dateCapacityOverrides={dateCapacityOverrides}
              dayCells={dayCells}
              columns={columns}
              rowHeight={OBJECT_SECTION_ROW_HEIGHT}
              editable={canEditCapacity}
              onSaveCapacity={canEditCapacity ? handleSaveCapacity : undefined}
            />
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
                className={`${getWeekCellClassNames(week, col.index)} absolute top-0 bottom-0`}
                style={{ left: col.start, width: col.size }}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}
