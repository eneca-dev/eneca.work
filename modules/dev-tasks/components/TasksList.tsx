'use client'

import { memo, useMemo } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TaskCard } from './TaskCard'
import type { AggregatedTask, GroupBy, TaskStatus, TaskCategory, TaskPriority } from '../types'

// Group labels
const statusLabels: Record<TaskStatus, string> = {
  'in-progress': 'В работе',
  blocked: 'Заблокировано',
  review: 'На ревью',
  todo: 'Запланировано',
  backlog: 'Бэклог',
  done: 'Готово',
  cancelled: 'Отменено',
}

const categoryLabels: Record<TaskCategory, string> = {
  feature: 'Фичи',
  bug: 'Баги',
  refactor: 'Рефакторинг',
  performance: 'Оптимизация',
  security: 'Безопасность',
  docs: 'Документация',
  'tech-debt': 'Тех. долг',
  migration: 'Миграции',
  audit: 'Аудит',
  research: 'Исследование',
}

const priorityLabels: Record<TaskPriority, string> = {
  critical: 'Критичные',
  high: 'Высокий приоритет',
  medium: 'Средний приоритет',
  low: 'Низкий приоритет',
}

// Group order
const statusOrder: TaskStatus[] = [
  'in-progress',
  'blocked',
  'review',
  'todo',
  'backlog',
  'done',
  'cancelled',
]

const priorityOrder: TaskPriority[] = ['critical', 'high', 'medium', 'low']

const categoryOrder: TaskCategory[] = [
  'bug',
  'security',
  'feature',
  'performance',
  'refactor',
  'tech-debt',
  'docs',
  'migration',
  'audit',
  'research',
]

interface TasksListProps {
  tasks: AggregatedTask[]
  groupBy: GroupBy
  enableGrouping?: boolean
}

interface TaskGroup {
  key: string
  label: string
  tasks: AggregatedTask[]
}

export const TasksList = memo(function TasksList({ tasks, groupBy, enableGrouping = true }: TasksListProps) {
  // Group tasks
  const groups = useMemo((): TaskGroup[] => {
    // If grouping is disabled, return all tasks in a single group
    if (!enableGrouping) {
      return [{ key: 'all', label: 'Все задачи', tasks }]
    }

    const grouped = new Map<string, AggregatedTask[]>()

    for (const task of tasks) {
      let key: string
      switch (groupBy) {
        case 'module':
          key = task.moduleName
          break
        case 'status':
          key = task.status
          break
        case 'category':
          key = task.category
          break
        case 'priority':
          key = task.priority
          break
        default:
          key = task.moduleName
      }

      const existing = grouped.get(key) || []
      existing.push(task)
      grouped.set(key, existing)
    }

    // Convert to array and sort
    const result: TaskGroup[] = []

    if (groupBy === 'status') {
      for (const status of statusOrder) {
        const tasks = grouped.get(status)
        if (tasks && tasks.length > 0) {
          result.push({ key: status, label: statusLabels[status], tasks })
        }
      }
    } else if (groupBy === 'priority') {
      for (const priority of priorityOrder) {
        const tasks = grouped.get(priority)
        if (tasks && tasks.length > 0) {
          result.push({ key: priority, label: priorityLabels[priority], tasks })
        }
      }
    } else if (groupBy === 'category') {
      for (const category of categoryOrder) {
        const tasks = grouped.get(category)
        if (tasks && tasks.length > 0) {
          result.push({ key: category, label: categoryLabels[category], tasks })
        }
      }
    } else {
      // Group by module - sort by task count
      const entries = Array.from(grouped.entries()).sort((a, b) => b[1].length - a[1].length)
      for (const [key, tasks] of entries) {
        const displayName = tasks[0]?.moduleDisplayName || key
        result.push({ key, label: displayName, tasks })
      }
    }

    return result
  }, [tasks, groupBy, enableGrouping])

  if (tasks.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        Задач не найдено
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <TaskGroupSection
          key={group.key}
          group={group}
          showModule={groupBy !== 'module'}
        />
      ))}
    </div>
  )
})

interface TaskGroupSectionProps {
  group: TaskGroup
  showModule: boolean
}

const TaskGroupSection = memo(function TaskGroupSection({
  group,
  showModule,
}: TaskGroupSectionProps) {
  return (
    <div className="space-y-3">
      {/* Group header */}
      <div className="flex items-center gap-2">
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
        <h2 className="font-medium">{group.label}</h2>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          {group.tasks.length}
        </span>
      </div>

      {/* Tasks */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {group.tasks.map((task) => (
          <TaskCard key={task.id} task={task} showModule={showModule} />
        ))}
      </div>
    </div>
  )
})
