/**
 * Resource Graph - Main Component
 *
 * Главный компонент модуля графика ресурсов с timeline
 * Full-width layout со sticky сворачиваемой панелью фильтров
 */

'use client'

import { useState, useMemo, useCallback, useRef } from 'react'
import {
  ChevronDown,
  ChevronUp,
  Database,
  FilterX,
  Tag,
  Loader2,
  X,
} from 'lucide-react'
import { addDays, startOfDay } from 'date-fns'
import { useResourceGraphData, useTagOptions, useCompanyCalendarEvents } from '../hooks'
import { useDisplaySettingsStore, useFiltersStore } from '../stores'
import { FilterSelect } from '../filters/FilterSelect'
import {
  useManagerOptions,
  useProjectOptions,
  useSubdivisionOptions,
  useDepartmentOptions,
  useEmployeeOptions,
} from '../filters/useFilterOptions'
import { ResourceGraphTimeline, TimelineHeader, generateDayCells } from './timeline'
import { SIDEBAR_WIDTH, DAY_CELL_WIDTH } from '../constants'
import { cn } from '@/lib/utils'
import type { TimelineRange } from '../types'

// Timeline config - 180 дней (полгода)
const DAYS_BEFORE_TODAY = 30  // Месяц назад
const DAYS_AFTER_TODAY = 150  // 5 месяцев вперёд
const TOTAL_DAYS = DAYS_BEFORE_TODAY + DAYS_AFTER_TODAY

function calculateTimelineRange(): TimelineRange {
  const today = startOfDay(new Date())
  const start = addDays(today, -DAYS_BEFORE_TODAY)
  const end = addDays(today, DAYS_AFTER_TODAY - 1)
  return { start, end, totalDays: TOTAL_DAYS }
}

/**
 * Проверяет, установлен ли хотя бы один фильтр
 */
function hasAnyFilter(filters: Record<string, unknown>): boolean {
  return Object.values(filters).some(
    (value) =>
      value !== undefined &&
      value !== null &&
      value !== '' &&
      !(Array.isArray(value) && value.length === 0)
  )
}

export function ResourceGraph() {
  const [isExpanded, setIsExpanded] = useState(true)
  const [loadAll, setLoadAll] = useState(false)

  // Refs for scroll synchronization
  const headerScrollRef = useRef<HTMLDivElement>(null)
  const contentScrollRef = useRef<HTMLDivElement>(null)
  const isScrollingSyncRef = useRef(false)

  // Sync scroll between header and content
  const handleHeaderScroll = useCallback(() => {
    if (isScrollingSyncRef.current) return
    if (headerScrollRef.current && contentScrollRef.current) {
      isScrollingSyncRef.current = true
      contentScrollRef.current.scrollLeft = headerScrollRef.current.scrollLeft
      requestAnimationFrame(() => {
        isScrollingSyncRef.current = false
      })
    }
  }, [])

  const handleContentScroll = useCallback(() => {
    if (isScrollingSyncRef.current) return
    if (headerScrollRef.current && contentScrollRef.current) {
      isScrollingSyncRef.current = true
      headerScrollRef.current.scrollLeft = contentScrollRef.current.scrollLeft
      requestAnimationFrame(() => {
        isScrollingSyncRef.current = false
      })
    }
  }, [])

  // Load company calendar events (holidays and transfers) - cached for 24h
  const { data: calendarEvents = [] } = useCompanyCalendarEvents()

  // Timeline range and cells (recalculated when calendar events load)
  const range = useMemo(() => calculateTimelineRange(), [])
  const dayCells = useMemo(
    () => generateDayCells(range, calendarEvents),
    [range, calendarEvents]
  )
  const timelineWidth = dayCells.length * DAY_CELL_WIDTH
  const totalWidth = SIDEBAR_WIDTH + timelineWidth

  // Filters and settings
  const {
    filters,
    setManagerId,
    setProjectId,
    setSubdivisionId,
    setDepartmentId,
    setEmployeeId,
    setTagIds,
    clearFilters,
  } = useFiltersStore()
  const { settings } = useDisplaySettingsStore()

  // Load filter options
  const { data: managers = [], isLoading: loadingManagers } = useManagerOptions()
  const { data: projects = [], isLoading: loadingProjects } = useProjectOptions(filters.managerId)
  const { data: subdivisions = [], isLoading: loadingSubdivisions } = useSubdivisionOptions()
  const { data: departments = [], isLoading: loadingDepartments } = useDepartmentOptions(filters.subdivisionId)
  const { data: employees = [], isLoading: loadingEmployees } = useEmployeeOptions(filters.departmentId)
  const { data: tags = [], isLoading: loadingTags } = useTagOptions()

  // Проверяем наличие фильтров
  const filtersApplied = useMemo(() => hasAnyFilter(filters), [filters])

  // Определяем, нужно ли загружать данные
  const shouldFetchData = filtersApplied || loadAll

  // Data fetching
  const { data, isLoading, error } = useResourceGraphData(filters, {
    enabled: shouldFetchData,
  })

  const handleLoadAll = useCallback(() => {
    setLoadAll(true)
  }, [])

  const handleClearAll = useCallback(() => {
    clearFilters()
    setLoadAll(false)
  }, [clearFilters])

  const handleTagToggle = useCallback(
    (tagId: string) => {
      const currentTags = filters.tagIds || []
      const isSelected = currentTags.includes(tagId)

      if (isSelected) {
        setTagIds(currentTags.filter((id) => id !== tagId))
      } else {
        setTagIds([...currentTags, tagId])
      }
    },
    [filters.tagIds, setTagIds]
  )

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Sticky Header */}
      <header className="sticky top-0 z-30 bg-card border-b shadow-sm">
        {/* Main toolbar */}
        <div className="px-4 py-2 flex items-center justify-between gap-4">
          {/* Left: Title & Stats */}
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-lg font-semibold">График ресурсов</h1>
              <p className="text-xs text-muted-foreground">
                {shouldFetchData
                  ? `Проектов: ${data?.length || 0}${loadAll && !filtersApplied ? ' (все)' : ''}`
                  : 'Выберите фильтры'}
              </p>
            </div>
          </div>

          {/* Center: Tags */}
          <div className="flex-1 flex items-center gap-2 min-w-0">
            <Tag size={14} className="text-muted-foreground shrink-0" />
            {loadingTags ? (
              <Loader2 size={14} className="animate-spin text-muted-foreground" />
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag) => {
                  const isSelected = filters.tagIds?.includes(tag.id)
                  return (
                    <button
                      key={tag.id}
                      onClick={() => handleTagToggle(tag.id)}
                      className={cn(
                        'px-2 py-0.5 text-xs font-medium rounded-full transition-all',
                        'border',
                        isSelected
                          ? 'border-transparent text-white'
                          : 'border-border bg-background hover:bg-muted'
                      )}
                      style={
                        isSelected && tag.color
                          ? { backgroundColor: tag.color }
                          : undefined
                      }
                    >
                      {tag.name}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {(filtersApplied || loadAll) && (
              <button
                onClick={handleClearAll}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs',
                  'text-destructive hover:bg-destructive/10 transition-colors'
                )}
              >
                <FilterX size={14} />
                Сбросить
              </button>
            )}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs',
                'border border-border hover:bg-muted transition-colors'
              )}
            >
              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              Фильтры
            </button>
          </div>
        </div>

        {/* Expandable Filters */}
        <div
          className={cn(
            'overflow-hidden transition-all duration-300 ease-in-out',
            isExpanded ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'
          )}
        >
          <div className="px-4 py-3 border-t bg-muted/30 flex flex-wrap gap-3">
            <FilterSelect
              id="manager-filter"
              label="Руководитель"
              value={filters.managerId ?? null}
              onChange={setManagerId}
              options={managers}
              placeholder="Все"
              loading={loadingManagers}
              compact
            />
            <FilterSelect
              id="project-filter"
              label="Проект"
              value={filters.projectId ?? null}
              onChange={setProjectId}
              options={projects}
              placeholder="Все"
              loading={loadingProjects}
              compact
            />
            <div className="w-px h-8 bg-border self-center" />
            <FilterSelect
              id="subdivision-filter"
              label="Подразделение"
              value={filters.subdivisionId ?? null}
              onChange={setSubdivisionId}
              options={subdivisions}
              placeholder="Все"
              loading={loadingSubdivisions}
              compact
            />
            <FilterSelect
              id="department-filter"
              label="Отдел"
              value={filters.departmentId ?? null}
              onChange={setDepartmentId}
              options={departments}
              placeholder="Все"
              loading={loadingDepartments}
              compact
            />
            <FilterSelect
              id="employee-filter"
              label="Сотрудник"
              value={filters.employeeId ?? null}
              onChange={setEmployeeId}
              options={employees}
              placeholder="Все"
              loading={loadingEmployees}
              compact
            />
          </div>
        </div>

        {/* Timeline Header - Dates row (sticky with main header) */}
        {shouldFetchData && !error && (
          <div
            ref={headerScrollRef}
            onScroll={handleHeaderScroll}
            className="border-t border-border/50 bg-background overflow-x-auto"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            <div className="flex" style={{ minWidth: totalWidth }}>
              {/* Sidebar header - sticky left */}
              <div
                className="shrink-0 flex items-center px-3 py-2 border-r border-border bg-card sticky left-0 z-20"
                style={{ width: SIDEBAR_WIDTH }}
              >
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Структура
                </span>
              </div>
              {/* Timeline header with dates */}
              <TimelineHeader dayCells={dayCells} />
            </div>
          </div>
        )}
      </header>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {/* Empty state */}
        {!shouldFetchData && (
          <div className="flex h-full items-center justify-center">
            <div className="text-center max-w-md">
              <Database className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" />
              <h2 className="text-lg font-medium mb-2">
                Выберите данные для отображения
              </h2>
              <p className="text-sm text-muted-foreground mb-6">
                Используйте теги или фильтры выше, чтобы выбрать проекты.
              </p>
              <button
                onClick={handleLoadAll}
                className={cn(
                  'inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm',
                  'bg-primary text-primary-foreground',
                  'hover:bg-primary/90 transition-colors'
                )}
              >
                <Database size={16} />
                Загрузить всё
              </button>
            </div>
          </div>
        )}

        {/* Error state */}
        {shouldFetchData && error && !isLoading && (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <p className="text-destructive mb-2">Ошибка загрузки данных</p>
              <p className="text-sm text-muted-foreground">{error.message}</p>
            </div>
          </div>
        )}

        {/* Timeline Content (rows only, header is in sticky area) */}
        {shouldFetchData && !error && (
          <ResourceGraphTimeline
            ref={contentScrollRef}
            onScroll={handleContentScroll}
            projects={data || []}
            dayCells={dayCells}
            range={range}
            isLoading={isLoading}
            hideHeader
          />
        )}
      </div>
    </div>
  )
}
