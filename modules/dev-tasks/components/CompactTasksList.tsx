'use client'

import { memo, useState, useMemo } from 'react'
import {
  Bug,
  Sparkles,
  RefreshCcw,
  Zap,
  Shield,
  FileText,
  Wrench,
  ArrowRightLeft,
  CheckCircle2,
  Circle,
  Clock,
  Copy,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  ClipboardCheck,
  Search,
  HelpCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import type { AggregatedTask, TaskCategory, TaskPriority } from '../types'

// Category icons
const categoryIcons: Record<TaskCategory, typeof Bug> = {
  feature: Sparkles,
  bug: Bug,
  refactor: RefreshCcw,
  performance: Zap,
  security: Shield,
  docs: FileText,
  'tech-debt': Wrench,
  migration: ArrowRightLeft,
  audit: ClipboardCheck,
  research: Search,
}

const categoryColors: Record<TaskCategory, string> = {
  feature: 'text-emerald-500',
  bug: 'text-red-500',
  refactor: 'text-blue-500',
  performance: 'text-amber-500',
  security: 'text-purple-500',
  docs: 'text-slate-500',
  'tech-debt': 'text-orange-500',
  migration: 'text-cyan-500',
  audit: 'text-teal-500',
  research: 'text-indigo-500',
}

const priorityColors: Record<TaskPriority, string> = {
  critical: 'text-red-500 font-medium',
  high: 'text-orange-500',
  medium: 'text-blue-500',
  low: 'text-slate-400',
}

const priorityLabels: Record<TaskPriority, string> = {
  critical: '!!!',
  high: '!!',
  medium: '!',
  low: '',
}

interface CompactTasksListProps {
  tasks: AggregatedTask[]
  selectedTasks: Set<string>
  onSelectionChange: (selected: Set<string>) => void
}

export const CompactTasksList = memo(function CompactTasksList({
  tasks,
  selectedTasks,
  onSelectionChange,
}: CompactTasksListProps) {
  const [showCompleted, setShowCompleted] = useState(false)

  // Split tasks into done and not done
  const { activeTasks, completedTasks } = useMemo(() => {
    const active: AggregatedTask[] = []
    const completed: AggregatedTask[] = []

    for (const task of tasks) {
      if (task.status === 'done' || task.status === 'cancelled') {
        completed.push(task)
      } else {
        active.push(task)
      }
    }

    return { activeTasks: active, completedTasks: completed }
  }, [tasks])

  // Group active tasks by module
  const groupedActiveTasks = useMemo(() => {
    const groups = new Map<string, AggregatedTask[]>()
    for (const task of activeTasks) {
      const existing = groups.get(task.moduleName) || []
      existing.push(task)
      groups.set(task.moduleName, existing)
    }
    return groups
  }, [activeTasks])

  const toggleTask = (taskId: string) => {
    const newSelected = new Set(selectedTasks)
    if (newSelected.has(taskId)) {
      newSelected.delete(taskId)
    } else {
      newSelected.add(taskId)
    }
    onSelectionChange(newSelected)
  }

  const toggleModule = (moduleName: string) => {
    const moduleTasks = groupedActiveTasks.get(moduleName) || []
    const moduleTaskIds = moduleTasks.map((t) => t.id)
    const allSelected = moduleTaskIds.every((id) => selectedTasks.has(id))

    const newSelected = new Set(selectedTasks)
    if (allSelected) {
      moduleTaskIds.forEach((id) => newSelected.delete(id))
    } else {
      moduleTaskIds.forEach((id) => newSelected.add(id))
    }
    onSelectionChange(newSelected)
  }

  return (
    <div className="space-y-4">
      {/* Active Tasks */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Circle className="h-4 w-4 text-amber-500" />
          <span>Активные задачи</span>
          <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-500">
            {activeTasks.length}
          </span>
        </div>

        {Array.from(groupedActiveTasks.entries()).map(([moduleName, moduleTasks]) => (
          <ModuleTaskGroup
            key={moduleName}
            moduleName={moduleName}
            displayName={moduleTasks[0]?.moduleDisplayName || moduleName}
            tasks={moduleTasks}
            selectedTasks={selectedTasks}
            onToggleTask={toggleTask}
            onToggleModule={toggleModule}
          />
        ))}
      </div>

      {/* Completed Tasks */}
      {completedTasks.length > 0 && (
        <div className="space-y-2">
          <button
            onClick={() => setShowCompleted(!showCompleted)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            {showCompleted ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <span>Завершённые</span>
            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-500">
              {completedTasks.length}
            </span>
          </button>

          {showCompleted && (
            <div className="ml-6 space-y-1 opacity-60">
              {completedTasks.map((task) => (
                <CompactTaskRow key={task.id} task={task} isCompleted />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
})

interface ModuleTaskGroupProps {
  moduleName: string
  displayName: string
  tasks: AggregatedTask[]
  selectedTasks: Set<string>
  onToggleTask: (taskId: string) => void
  onToggleModule: (moduleName: string) => void
}

const ModuleTaskGroup = memo(function ModuleTaskGroup({
  moduleName,
  displayName,
  tasks,
  selectedTasks,
  onToggleTask,
  onToggleModule,
}: ModuleTaskGroupProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const selectedCount = tasks.filter((t) => selectedTasks.has(t.id)).length
  const allSelected = selectedCount === tasks.length

  return (
    <div className="rounded-lg border bg-card/50">
      {/* Module Header */}
      <div className="flex items-center gap-2 border-b bg-muted/30 px-3 py-2">
        <Checkbox
          checked={allSelected}
          onCheckedChange={() => onToggleModule(moduleName)}
          className="h-4 w-4"
        />
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex flex-1 items-center gap-2 text-sm font-medium"
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
          <span>{displayName}</span>
          <span className="text-xs text-muted-foreground">({tasks.length})</span>
        </button>
        {selectedCount > 0 && (
          <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary">
            {selectedCount} выбрано
          </span>
        )}
      </div>

      {/* Tasks */}
      {isExpanded && (
        <div className="divide-y divide-border/50">
          {tasks.map((task) => (
            <CompactTaskRow
              key={task.id}
              task={task}
              isSelected={selectedTasks.has(task.id)}
              onToggle={() => onToggleTask(task.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
})

interface CompactTaskRowProps {
  task: AggregatedTask
  isSelected?: boolean
  isCompleted?: boolean
  onToggle?: () => void
}

const CompactTaskRow = memo(function CompactTaskRow({
  task,
  isSelected,
  isCompleted,
  onToggle,
}: CompactTaskRowProps) {
  // Fallback to HelpCircle if category icon is not defined
  const CategoryIcon = categoryIcons[task.category] || HelpCircle

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-2 text-sm',
        isSelected && 'bg-primary/5',
        isCompleted && 'line-through'
      )}
    >
      {!isCompleted && onToggle && (
        <Checkbox checked={isSelected} onCheckedChange={onToggle} className="h-4 w-4" />
      )}

      {/* ID */}
      <code className="w-20 shrink-0 font-mono text-xs text-muted-foreground">{task.id}</code>

      {/* Category Icon */}
      <CategoryIcon className={cn('h-4 w-4 shrink-0', categoryColors[task.category])} />

      {/* Priority */}
      {task.priority !== 'low' && (
        <span className={cn('w-6 shrink-0 text-xs', priorityColors[task.priority])}>
          {priorityLabels[task.priority]}
        </span>
      )}

      {/* Title */}
      <span className="flex-1 truncate" title={task.title}>
        {task.title}
      </span>

      {/* Status badge */}
      <StatusBadge status={task.status} />
    </div>
  )
})

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    backlog: { label: 'бэклог', className: 'bg-slate-500/10 text-slate-500' },
    todo: { label: 'todo', className: 'bg-blue-500/10 text-blue-500' },
    'in-progress': { label: 'в работе', className: 'bg-amber-500/10 text-amber-500' },
    review: { label: 'ревью', className: 'bg-purple-500/10 text-purple-500' },
    blocked: { label: 'blocked', className: 'bg-red-500/10 text-red-500' },
    done: { label: 'готово', className: 'bg-emerald-500/10 text-emerald-500' },
    cancelled: { label: 'отменено', className: 'bg-slate-500/10 text-slate-500' },
  }

  const { label, className } = config[status] || config.backlog

  return (
    <span className={cn('shrink-0 rounded px-1.5 py-0.5 text-xs', className)}>{label}</span>
  )
}
