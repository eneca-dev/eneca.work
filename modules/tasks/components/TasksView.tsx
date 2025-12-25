/**
 * Tasks View - Main Component
 *
 * Объединяет Kanban и Timeline (Resource Graph) представления
 * с общими фильтрами и вкладками в стиле GitHub
 */

'use client'

import { useMemo } from 'react'
import { LayoutGrid, GanttChart } from 'lucide-react'
import { cn } from '@/lib/utils'
import { InlineFilter, parseFilterString, tokensToQueryParams } from '@/modules/inline-filter'
import { useTasksFiltersStore, useTasksViewStore, TASKS_FILTER_CONFIG, type TasksViewMode } from '../stores'
import { useTasksFilterOptions } from '../hooks'
import { KanbanBoardInternal } from '@/modules/kanban/components/KanbanBoard'
import { ResourceGraphInternal } from '@/modules/resource-graph/components/ResourceGraph'

// ============================================================================
// Tab Configuration
// ============================================================================

interface TabConfig {
  id: TasksViewMode
  label: string
  icon: React.ComponentType<{ className?: string }>
}

const TABS: TabConfig[] = [
  { id: 'kanban', label: 'Канбан', icon: LayoutGrid },
  { id: 'timeline', label: 'График', icon: GanttChart },
]

// ============================================================================
// Main Component
// ============================================================================

export function TasksView() {
  // Stores
  const { filterString, setFilterString } = useTasksFiltersStore()
  const { viewMode, setViewMode } = useTasksViewStore()

  // Filter options for autocomplete
  const { options: filterOptions } = useTasksFilterOptions()

  // Parse filter string to query params (shared between views)
  const queryParams = useMemo(() => {
    const parsed = parseFilterString(filterString, TASKS_FILTER_CONFIG)
    return tokensToQueryParams(parsed.tokens, TASKS_FILTER_CONFIG)
  }, [filterString])

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header with tabs and filter */}
      <header className="shrink-0 sticky top-0 z-30 bg-card border-b">
        {/* Tabs row */}
        <div className="flex items-center gap-6 px-4 pt-2">
          <h1 className="text-lg font-semibold">Задачи</h1>

          {/* GitHub-style tabs */}
          <nav className="flex items-center -mb-px">
            {TABS.map((tab) => {
              const Icon = tab.icon
              const isActive = viewMode === tab.id

              return (
                <button
                  key={tab.id}
                  onClick={() => setViewMode(tab.id)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors',
                    isActive
                      ? 'border-primary text-foreground'
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              )
            })}
          </nav>
        </div>

        {/* Filter row */}
        <div className="px-4 py-2 border-t border-border/50">
          <InlineFilter
            config={TASKS_FILTER_CONFIG}
            value={filterString}
            onChange={setFilterString}
            options={filterOptions}
          />
        </div>
      </header>

      {/* Content - takes remaining height */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {viewMode === 'kanban' ? (
          <KanbanBoardInternal
            filterString={filterString}
            queryParams={queryParams}
            filterConfig={TASKS_FILTER_CONFIG}
          />
        ) : (
          <ResourceGraphInternal
            filterString={filterString}
            queryParams={queryParams}
            filterConfig={TASKS_FILTER_CONFIG}
          />
        )}
      </div>
    </div>
  )
}
