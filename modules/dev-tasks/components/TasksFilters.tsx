'use client'

import { memo } from 'react'
import { Search, X, Layers, GitBranch, Flag, Tags } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { GroupBy, TaskFilters, TaskStatus, TaskCategory, TaskPriority } from '../types'

interface TasksFiltersProps {
  filters: TaskFilters
  onFiltersChange: (filters: TaskFilters) => void
  groupBy: GroupBy
  onGroupByChange: (groupBy: GroupBy) => void
  modules: string[]
}

const statusOptions: { value: TaskStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Все статусы' },
  { value: 'in-progress', label: 'В работе' },
  { value: 'todo', label: 'Запланировано' },
  { value: 'backlog', label: 'Бэклог' },
  { value: 'review', label: 'На ревью' },
  { value: 'blocked', label: 'Заблокировано' },
  { value: 'done', label: 'Готово' },
  { value: 'cancelled', label: 'Отменено' },
]

const categoryOptions: { value: TaskCategory | 'all'; label: string }[] = [
  { value: 'all', label: 'Все категории' },
  { value: 'feature', label: 'Фичи' },
  { value: 'bug', label: 'Баги' },
  { value: 'refactor', label: 'Рефакторинг' },
  { value: 'performance', label: 'Оптимизация' },
  { value: 'security', label: 'Безопасность' },
  { value: 'docs', label: 'Документация' },
  { value: 'tech-debt', label: 'Тех. долг' },
  { value: 'migration', label: 'Миграции' },
]

const priorityOptions: { value: TaskPriority | 'all'; label: string }[] = [
  { value: 'all', label: 'Все приоритеты' },
  { value: 'critical', label: 'Критичные' },
  { value: 'high', label: 'Высокий' },
  { value: 'medium', label: 'Средний' },
  { value: 'low', label: 'Низкий' },
]

const groupByOptions: { value: GroupBy; label: string; icon: typeof Layers }[] = [
  { value: 'module', label: 'По модулю', icon: Layers },
  { value: 'status', label: 'По статусу', icon: GitBranch },
  { value: 'category', label: 'По категории', icon: Tags },
  { value: 'priority', label: 'По приоритету', icon: Flag },
]

export const TasksFilters = memo(function TasksFilters({
  filters,
  onFiltersChange,
  groupBy,
  onGroupByChange,
  modules,
}: TasksFiltersProps) {
  const hasActiveFilters =
    filters.search ||
    filters.modules.length > 0 ||
    filters.statuses.length > 0 ||
    filters.categories.length > 0 ||
    filters.priorities.length > 0

  const clearFilters = () => {
    onFiltersChange({
      modules: [],
      categories: [],
      statuses: [],
      priorities: [],
      search: '',
    })
  }

  return (
    <div className="space-y-4">
      {/* Search and Group By */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Поиск по ID или названию..."
            value={filters.search}
            onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
            className="pl-9"
          />
        </div>

        {/* Group By */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Группировка:</span>
          <div className="flex rounded-lg border bg-muted/50 p-1">
            {groupByOptions.map((option) => {
              const Icon = option.icon
              return (
                <button
                  key={option.value}
                  onClick={() => onGroupByChange(option.value)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors',
                    groupBy === option.value
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{option.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Module filter */}
        <Select
          value={filters.modules[0] || 'all'}
          onValueChange={(value) =>
            onFiltersChange({
              ...filters,
              modules: value === 'all' ? [] : [value],
            })
          }
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Модуль" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все модули</SelectItem>
            {modules.map((module) => (
              <SelectItem key={module} value={module}>
                {module}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Status filter */}
        <Select
          value={filters.statuses[0] || 'all'}
          onValueChange={(value) =>
            onFiltersChange({
              ...filters,
              statuses: value === 'all' ? [] : [value as TaskStatus],
            })
          }
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Статус" />
          </SelectTrigger>
          <SelectContent>
            {statusOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Category filter */}
        <Select
          value={filters.categories[0] || 'all'}
          onValueChange={(value) =>
            onFiltersChange({
              ...filters,
              categories: value === 'all' ? [] : [value as TaskCategory],
            })
          }
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Категория" />
          </SelectTrigger>
          <SelectContent>
            {categoryOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Priority filter */}
        <Select
          value={filters.priorities[0] || 'all'}
          onValueChange={(value) =>
            onFiltersChange({
              ...filters,
              priorities: value === 'all' ? [] : [value as TaskPriority],
            })
          }
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Приоритет" />
          </SelectTrigger>
          <SelectContent>
            {priorityOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Clear filters */}
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1.5">
            <X className="h-4 w-4" />
            Сбросить
          </Button>
        )}
      </div>
    </div>
  )
})
