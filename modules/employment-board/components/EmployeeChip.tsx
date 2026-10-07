'use client'

import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { UserAvatar } from '@/components/ui/user-avatar'
import type { BoardEmployee, BoardProjectEmployee } from '../types'

interface EmployeeChipProps {
  employee: BoardEmployee | BoardProjectEmployee
  draggable?: boolean
  onDragStart?: (e: React.DragEvent) => void
  onDragEnd?: () => void
  /** Показывается только для ручных размещений — авто-размещение снять нельзя */
  onRemove?: () => void
  className?: string
}

export function EmployeeChip({
  employee,
  draggable,
  onDragStart,
  onDragEnd,
  onRemove,
  className,
}: EmployeeChipProps) {
  const source = 'source' in employee ? employee.source : null
  const rate = 'rate' in employee ? employee.rate : null
  const isPending = 'isPending' in employee && employee.isPending
  const isCalculationGroup = employee.teamName === 'Расчётная группа'
  const title = [isCalculationGroup ? 'Расчётная группа' : null, employee.positionName]
    .filter(Boolean)
    .join(' · ') || undefined

  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      title={title}
      role={isCalculationGroup ? 'group' : undefined}
      aria-label={isCalculationGroup ? `${employee.name}. Расчётная группа` : undefined}
      className={cn(
        'group inline-flex min-w-0 items-center gap-1.5 rounded-full border py-1 pl-1 pr-2 text-xs transition-colors',
        draggable && 'cursor-grab active:cursor-grabbing',
        source === 'manual'
          ? 'border-dashed border-primary/50 bg-primary/5'
          : 'border-border bg-muted/50',
        isCalculationGroup && 'bg-violet-500/10 ring-1 ring-inset ring-violet-400/45',
        className,
      )}
    >
      <UserAvatar avatarUrl={employee.avatarUrl} name={employee.name} size="sm" />
      <span className="truncate max-w-[11rem] font-medium">{employee.name}</span>
      {isPending && <span className="text-xs text-muted-foreground">сохраняется…</span>}
      {rate !== null && rate > 0 && (
        <span className="text-xs text-muted-foreground tabular-nums">
          {rate.toFixed(2).replace(/\.?0+$/, '')}
        </span>
      )}
      {onRemove && !isPending && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Убрать ${employee.name} с проекта`}
          className="-mr-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full opacity-100 transition-opacity hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  )
}
