'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { Code2, RefreshCcw, List, LayoutGrid } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TasksStats } from './TasksStats'
import { TasksFilters } from './TasksFilters'
import { TasksList } from './TasksList'
import { CompactTasksList } from './CompactTasksList'
import { PromptGenerator } from './PromptGenerator'
import { ClaudeLauncher } from './ClaudeLauncher'
import { Changelog } from './Changelog'
import { getAllTasks } from '../actions'
import type { AggregatedTask, TaskStats, TaskFilters, GroupBy } from '../types'

const defaultFilters: TaskFilters = {
  modules: [],
  categories: [],
  statuses: [],
  priorities: [],
  search: '',
}

type ViewMode = 'compact' | 'cards'

export function DevTasksPage() {
  const [tasks, setTasks] = useState<AggregatedTask[]>([])
  const [stats, setStats] = useState<TaskStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [filters, setFilters] = useState<TaskFilters>(defaultFilters)
  const [groupBy, setGroupBy] = useState<GroupBy>('module')
  const [viewMode, setViewMode] = useState<ViewMode>('compact')
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set())

  // Load tasks
  const loadTasks = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    const result = await getAllTasks()

    if (result.success) {
      setTasks(result.tasks)
      setStats(result.stats)
    } else {
      setError(result.error || 'Ошибка загрузки задач')
    }

    setIsLoading(false)
  }, [])

  useEffect(() => {
    loadTasks()
  }, [loadTasks])

  // Get unique modules
  const modules = useMemo(() => {
    const set = new Set(tasks.map((t) => t.moduleName))
    return Array.from(set).sort()
  }, [tasks])

  // Apply filters
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (filters.modules.length > 0 && !filters.modules.includes(task.moduleName)) {
        return false
      }
      if (filters.statuses.length > 0 && !filters.statuses.includes(task.status)) {
        return false
      }
      if (filters.categories.length > 0 && !filters.categories.includes(task.category)) {
        return false
      }
      if (filters.priorities.length > 0 && !filters.priorities.includes(task.priority)) {
        return false
      }
      if (filters.search) {
        const search = filters.search.toLowerCase()
        const matchesId = task.id.toLowerCase().includes(search)
        const matchesTitle = task.title.toLowerCase().includes(search)
        const matchesDescription = task.description?.toLowerCase().includes(search)
        if (!matchesId && !matchesTitle && !matchesDescription) {
          return false
        }
      }
      return true
    })
  }, [tasks, filters])

  // Loading state
  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-primary"></div>
          <p className="text-muted-foreground">Загрузка задач...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <p className="mb-4 text-red-500">{error}</p>
          <Button onClick={loadTasks} variant="outline">
            Повторить
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2">
            <Code2 className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Development Tasks</h1>
            <p className="text-sm text-muted-foreground">
              Задачи из module.meta.json файлов
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex rounded-lg border bg-muted/50 p-1">
            <button
              onClick={() => setViewMode('compact')}
              className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                viewMode === 'compact'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <List className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                viewMode === 'cards'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>

          <Button onClick={loadTasks} variant="outline" size="sm" className="gap-2">
            <RefreshCcw className="h-4 w-4" />
            Обновить
          </Button>
        </div>
      </div>

      {/* Stats - compact */}
      {stats && (
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-1.5">
            <span className="font-medium">{stats.total}</span>
            <span className="text-muted-foreground">всего</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-amber-500">
              {stats.byStatus['in-progress'] + stats.byStatus.todo}
            </span>
            <span className="text-muted-foreground">активных</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-emerald-500">{stats.byStatus.done}</span>
            <span className="text-muted-foreground">готово</span>
          </div>
          {stats.byPriority.critical > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="font-medium text-red-500">{stats.byPriority.critical}</span>
              <span className="text-muted-foreground">критичных</span>
            </div>
          )}
          {stats.byStatus.blocked > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="font-medium text-red-500">{stats.byStatus.blocked}</span>
              <span className="text-muted-foreground">заблокировано</span>
            </div>
          )}
        </div>
      )}

      {/* Main content */}
      <div className="grid gap-6 lg:grid-cols-[1fr,400px]">
        {/* Tasks list */}
        <div className="space-y-4">
          {/* Filters - only in cards mode */}
          {viewMode === 'cards' && (
            <TasksFilters
              filters={filters}
              onFiltersChange={setFilters}
              groupBy={groupBy}
              onGroupByChange={setGroupBy}
              modules={modules}
            />
          )}

          {/* Results count */}
          <div className="text-sm text-muted-foreground">
            {filteredTasks.length === tasks.length
              ? `${tasks.length} задач`
              : `${filteredTasks.length} из ${tasks.length}`}
            {selectedTasks.size > 0 && (
              <span className="ml-2 text-primary">• {selectedTasks.size} выбрано</span>
            )}
          </div>

          {/* Tasks */}
          {viewMode === 'compact' ? (
            <CompactTasksList
              tasks={filteredTasks}
              selectedTasks={selectedTasks}
              onSelectionChange={setSelectedTasks}
            />
          ) : (
            <TasksList tasks={filteredTasks} groupBy={groupBy} />
          )}
        </div>

        {/* Sidebar: Prompt generator + Claude launcher + Changelog */}
        <div className="lg:sticky lg:top-6 lg:self-start space-y-4">
          <div className="rounded-lg border bg-card p-4">
            <PromptGenerator tasks={tasks} selectedTaskIds={selectedTasks} />
            <ClaudeLauncher tasks={tasks} selectedTaskIds={selectedTasks} />
          </div>
          <div className="rounded-lg border bg-card p-4">
            <Changelog />
          </div>
        </div>
      </div>
    </div>
  )
}
