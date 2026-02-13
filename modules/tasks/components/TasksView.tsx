/**
 * Tasks View - Main Component
 *
 * Объединяет Kanban и Timeline (Resource Graph) представления
 * с общими фильтрами и системой вкладок
 */

'use client'

import { useMemo, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Lock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { InlineFilter, parseFilterString, tokensToQueryParams } from '@/modules/inline-filter'
import { useTasksTabsStore, TASKS_FILTER_CONFIG } from '../stores'
import { useTasksFilterOptions } from '../hooks'
import { KanbanBoardInternal } from '@/modules/kanban/components/KanbanBoard'
import { ResourceGraphInternal } from '@/modules/resource-graph/components/ResourceGraph'
import { BudgetsViewInternal } from '@/modules/budgets-page'
import { DepartmentsTimelineInternal } from '@/modules/departments-timeline'
import { SectionsPageInternal } from '@/modules/sections-page'
import { TasksTabs } from './TasksTabs'
import { PermissionsDebugPanel } from './PermissionsDebugPanel'

// ============================================================================
// Main Component
// ============================================================================

export function TasksView() {
  // URL search params
  const searchParams = useSearchParams()

  // Get active tab data from tabs store (proper selectors for reactivity)
  const tabs = useTasksTabsStore((s) => s.tabs)
  const activeTabId = useTasksTabsStore((s) => s.activeTabId)
  const updateActiveTabFilters = useTasksTabsStore((s) => s.updateActiveTabFilters)

  // Find active tab from tabs array
  const activeTab = useMemo(
    () => tabs.find((t) => t.id === activeTabId),
    [tabs, activeTabId]
  )

  // Current filter and view mode from active tab
  const filterString = activeTab?.filterString ?? ''
  const viewMode = activeTab?.viewMode ?? 'kanban'

  // Filter options for autocomplete + locked filters
  const { options: filterOptions, lockedFilters } = useTasksFilterOptions()

  // Log URL params for debugging
  useEffect(() => {
    const projectId = searchParams.get('projectId')
    const sectionId = searchParams.get('sectionId')
    const highlight = searchParams.get('highlight')

    console.log('[TasksView] URL params:', { projectId, sectionId, highlight })
    console.log('[TasksView] Current viewMode:', viewMode)
  }, [searchParams, viewMode])

  // Parse filter string to query params (shared between views)
  const queryParams = useMemo(() => {
    const parsed = parseFilterString(filterString, TASKS_FILTER_CONFIG)
    return tokensToQueryParams(parsed.tokens, TASKS_FILTER_CONFIG)
  }, [filterString])

  // Handler for filter changes
  const handleFilterChange = (newFilterString: string) => {
    updateActiveTabFilters(newFilterString)
  }

  return (
    <div className="h-screen flex flex-col bg-card">
      {/* Header with tabs and filter */}
      <header className="shrink-0 sticky top-0 z-50 bg-card border-b">
        {/* Tabs row */}
        <div className="flex items-center gap-6 px-4 pt-2">
          <h1 className="text-lg font-semibold">Задачи</h1>

          {/* Tabs component */}
          <TasksTabs />
        </div>

        {/* Filter row - only show when tabs exist */}
        {tabs.length > 0 && (
          <div className="px-4 py-2 border-t border-border/50">
            <div className="flex items-center gap-2">
              {/* Locked filters */}
              {lockedFilters.map((lock) => (
                <Badge
                  key={lock.key}
                  variant="secondary"
                  className="flex items-center gap-1.5 text-xs font-normal bg-muted/50"
                >
                  <Lock className="h-3 w-3 text-muted-foreground" />
                  <span className="text-muted-foreground">{lock.key}:</span>
                  <span>{lock.displayName}</span>
                </Badge>
              ))}

              {/* Inline filter */}
              <div className="flex-1">
                <InlineFilter
                  key={activeTabId}
                  config={TASKS_FILTER_CONFIG}
                  value={filterString}
                  onChange={handleFilterChange}
                  options={filterOptions}
                />
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Content - takes remaining height */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {/* Empty state when no tabs */}
        {tabs.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-muted-foreground">
              <p className="text-lg mb-2">Нет вкладок</p>
              <p className="text-sm">Нажмите + чтобы создать новую вкладку</p>
            </div>
          </div>
        )}
        {tabs.length > 0 && viewMode === 'kanban' && (
          <KanbanBoardInternal
            filterString={filterString}
            queryParams={queryParams}
            filterConfig={TASKS_FILTER_CONFIG}
          />
        )}
        {tabs.length > 0 && viewMode === 'timeline' && (
          <ResourceGraphInternal
            filterString={filterString}
            queryParams={queryParams}
            filterConfig={TASKS_FILTER_CONFIG}
          />
        )}
        {tabs.length > 0 && viewMode === 'departments' && (
          <DepartmentsTimelineInternal
            queryParams={queryParams}
          />
        )}
        {tabs.length > 0 && viewMode === 'sections' && (
          <SectionsPageInternal
            queryParams={queryParams}
          />
        )}
        {tabs.length > 0 && viewMode === 'budgets' && (
          <BudgetsViewInternal
            filterString={filterString}
            queryParams={queryParams}
            filterConfig={TASKS_FILTER_CONFIG}
          />
        )}
      </div>

      {/* Debug Panel - только в dev режиме */}
      {process.env.NODE_ENV === 'development' && <PermissionsDebugPanel />}
    </div>
  )
}
