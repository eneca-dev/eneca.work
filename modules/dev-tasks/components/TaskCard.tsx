'use client'

import { memo } from 'react'
import {
  Bug,
  Sparkles,
  RefreshCcw,
  Zap,
  Shield,
  FileText,
  Wrench,
  ArrowRightLeft,
  Circle,
  Clock,
  PlayCircle,
  Eye,
  CheckCircle2,
  Ban,
  XCircle,
  AlertTriangle,
  Search,
  ClipboardCheck,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AggregatedTask, TaskCategory, TaskStatus, TaskPriority } from '../types'

// Category icons and colors
const categoryConfig: Record<
  TaskCategory,
  { icon: typeof Bug; label: string; color: string }
> = {
  feature: { icon: Sparkles, label: 'Фича', color: 'text-emerald-500' },
  bug: { icon: Bug, label: 'Баг', color: 'text-red-500' },
  refactor: { icon: RefreshCcw, label: 'Рефакторинг', color: 'text-blue-500' },
  performance: { icon: Zap, label: 'Оптимизация', color: 'text-amber-500' },
  security: { icon: Shield, label: 'Безопасность', color: 'text-purple-500' },
  docs: { icon: FileText, label: 'Документация', color: 'text-slate-500' },
  'tech-debt': { icon: Wrench, label: 'Тех. долг', color: 'text-orange-500' },
  migration: { icon: ArrowRightLeft, label: 'Миграция', color: 'text-cyan-500' },
  audit: { icon: ClipboardCheck, label: 'Аудит', color: 'text-indigo-500' },
  research: { icon: Search, label: 'Исследование', color: 'text-pink-500' },
}

// Status icons and colors
const statusConfig: Record<
  TaskStatus,
  { icon: typeof Circle; label: string; color: string; bg: string }
> = {
  backlog: {
    icon: Circle,
    label: 'Бэклог',
    color: 'text-slate-400',
    bg: 'bg-slate-400/10',
  },
  todo: {
    icon: Clock,
    label: 'Запланировано',
    color: 'text-blue-500',
    bg: 'bg-blue-500/10',
  },
  'in-progress': {
    icon: PlayCircle,
    label: 'В работе',
    color: 'text-amber-500',
    bg: 'bg-amber-500/10',
  },
  review: {
    icon: Eye,
    label: 'На ревью',
    color: 'text-purple-500',
    bg: 'bg-purple-500/10',
  },
  done: {
    icon: CheckCircle2,
    label: 'Готово',
    color: 'text-emerald-500',
    bg: 'bg-emerald-500/10',
  },
  blocked: {
    icon: Ban,
    label: 'Заблокировано',
    color: 'text-red-500',
    bg: 'bg-red-500/10',
  },
  cancelled: {
    icon: XCircle,
    label: 'Отменено',
    color: 'text-slate-400',
    bg: 'bg-slate-400/10',
  },
}

// Priority colors
const priorityConfig: Record<TaskPriority, { label: string; color: string; bg: string }> = {
  critical: { label: 'Критично', color: 'text-red-600', bg: 'bg-red-500/20' },
  high: { label: 'Высокий', color: 'text-orange-500', bg: 'bg-orange-500/15' },
  medium: { label: 'Средний', color: 'text-blue-500', bg: 'bg-blue-500/10' },
  low: { label: 'Низкий', color: 'text-slate-500', bg: 'bg-slate-500/10' },
}

interface TaskCardProps {
  task: AggregatedTask
  showModule?: boolean
}

export const TaskCard = memo(function TaskCard({ task, showModule = true }: TaskCardProps) {
  const category = categoryConfig[task.category] || categoryConfig.feature
  const status = statusConfig[task.status] || statusConfig.backlog
  const priority = priorityConfig[task.priority] || priorityConfig.medium
  const CategoryIcon = category.icon
  const StatusIcon = status.icon

  return (
    <div
      className={cn(
        'group relative rounded-lg border bg-card p-4 transition-all hover:shadow-md',
        'dark:bg-card/50 dark:hover:bg-card/80',
        task.status === 'done' && 'opacity-60',
        task.status === 'cancelled' && 'opacity-40'
      )}
    >
      {/* Header: ID + Module */}
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono text-muted-foreground">
            {task.id}
          </code>
          {showModule && (
            <span className="text-xs text-muted-foreground">{task.moduleDisplayName}</span>
          )}
        </div>

        {/* Priority badge */}
        {task.priority === 'critical' && (
          <div className="flex items-center gap-1 text-red-500">
            <AlertTriangle className="h-3.5 w-3.5" />
            <span className="text-xs font-medium">Критично</span>
          </div>
        )}
      </div>

      {/* Title */}
      <h3 className="mb-2 font-medium leading-snug">{task.title}</h3>

      {/* Description */}
      {task.description && (
        <p className="mb-3 text-sm text-muted-foreground line-clamp-2">{task.description}</p>
      )}

      {/* Footer: Category + Status + Priority */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Category */}
        <div className={cn('flex items-center gap-1', category.color)}>
          <CategoryIcon className="h-3.5 w-3.5" />
          <span className="text-xs">{category.label}</span>
        </div>

        {/* Status */}
        <div
          className={cn('flex items-center gap-1 rounded-full px-2 py-0.5', status.bg, status.color)}
        >
          <StatusIcon className="h-3 w-3" />
          <span className="text-xs">{status.label}</span>
        </div>

        {/* Priority (only if not critical, as it's shown in header) */}
        {task.priority !== 'critical' && (
          <div className={cn('rounded-full px-2 py-0.5 text-xs', priority.bg, priority.color)}>
            {priority.label}
          </div>
        )}

        {/* Assignee */}
        {task.assignee && (
          <div className="ml-auto text-xs text-muted-foreground">@{task.assignee}</div>
        )}
      </div>

      {/* Blocked indicator */}
      {task.blockedBy && task.blockedBy.length > 0 && (
        <div className="mt-2 text-xs text-red-500">
          Заблокировано: {task.blockedBy.join(', ')}
        </div>
      )}
    </div>
  )
})
