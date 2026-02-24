'use client'

import { memo } from 'react'
import {
  CheckCircle2,
  Circle,
  Clock,
  PlayCircle,
  AlertTriangle,
  Bug,
  Sparkles,
  Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TaskStats } from '../types'

interface TasksStatsProps {
  stats: TaskStats
}

export const TasksStats = memo(function TasksStats({ stats }: TasksStatsProps) {
  const activeCount =
    stats.byStatus['in-progress'] + stats.byStatus.todo + stats.byStatus.review
  const blockedCount = stats.byStatus.blocked
  const doneCount = stats.byStatus.done

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* Total */}
      <StatCard
        icon={Circle}
        iconColor="text-slate-500"
        label="Всего задач"
        value={stats.total}
      />

      {/* Active */}
      <StatCard
        icon={PlayCircle}
        iconColor="text-amber-500"
        label="Активных"
        value={activeCount}
        subtitle={`${stats.byStatus['in-progress']} в работе`}
      />

      {/* Done */}
      <StatCard
        icon={CheckCircle2}
        iconColor="text-emerald-500"
        label="Готово"
        value={doneCount}
        subtitle={stats.total > 0 ? `${Math.round((doneCount / stats.total) * 100)}%` : '0%'}
      />

      {/* Blocked + Critical */}
      <StatCard
        icon={AlertTriangle}
        iconColor="text-red-500"
        label="Требуют внимания"
        value={blockedCount + stats.byPriority.critical}
        subtitle={`${stats.byPriority.critical} критичных`}
        highlight={blockedCount + stats.byPriority.critical > 0}
      />
    </div>
  )
})

interface StatCardProps {
  icon: typeof Circle
  iconColor: string
  label: string
  value: number
  subtitle?: string
  highlight?: boolean
}

const StatCard = memo(function StatCard({
  icon: Icon,
  iconColor,
  label,
  value,
  subtitle,
  highlight,
}: StatCardProps) {
  return (
    <div
      className={cn(
        'rounded-lg border bg-card p-4',
        highlight && 'border-red-500/50 bg-red-500/5'
      )}
    >
      <div className="flex items-center gap-3">
        <div className={cn('rounded-lg bg-muted p-2', highlight && 'bg-red-500/10')}>
          <Icon className={cn('h-5 w-5', iconColor)} />
        </div>
        <div>
          <div className="text-2xl font-semibold">{value}</div>
          <div className="text-sm text-muted-foreground">{label}</div>
          {subtitle && <div className="text-xs text-muted-foreground">{subtitle}</div>}
        </div>
      </div>
    </div>
  )
})

// Mini breakdown component
interface TasksBreakdownProps {
  stats: TaskStats
}

export const TasksBreakdown = memo(function TasksBreakdown({ stats }: TasksBreakdownProps) {
  return (
    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
      <div className="flex items-center gap-1.5">
        <Bug className="h-4 w-4 text-red-500" />
        <span>{stats.byCategory.bug} багов</span>
      </div>
      <div className="flex items-center gap-1.5">
        <Sparkles className="h-4 w-4 text-emerald-500" />
        <span>{stats.byCategory.feature} фич</span>
      </div>
      <div className="flex items-center gap-1.5">
        <Zap className="h-4 w-4 text-amber-500" />
        <span>{stats.byCategory.performance} оптимизаций</span>
      </div>
      <div className="flex items-center gap-1.5">
        <Clock className="h-4 w-4 text-slate-500" />
        <span>{stats.byStatus.backlog} в бэклоге</span>
      </div>
    </div>
  )
})
