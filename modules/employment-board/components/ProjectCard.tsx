'use client'

import { Pin, PinOff, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { EmployeeChip } from './EmployeeChip'
import type { BoardProject } from '../types'

interface ProjectCardProps {
  project: BoardProject
  canManageProjects: boolean
  canManagePlacements: boolean
  isDropTarget: boolean
  onDragOver: (e: React.DragEvent) => void
  onDragLeave: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent) => void
  onUnpin: () => void
  onRemoveEmployee: (employeeId: string) => void
}

export function ProjectCard({
  project,
  canManageProjects,
  canManagePlacements,
  isDropTarget,
  onDragOver,
  onDragLeave,
  onDrop,
  onUnpin,
  onRemoveEmployee,
}: ProjectCardProps) {
  const count = project.employees.length

  return (
    <div
      data-testid="employment-board-project-card"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={cn(
        // break-inside-avoid — карточка не разрывается между колонками masonry
        'group mb-3 break-inside-avoid overflow-hidden rounded-lg border bg-card p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md',
        isDropTarget
          ? 'border-primary bg-primary/5 ring-2 ring-primary/25'
          : 'border-border hover:border-primary/30',
      )}
    >
      <div className="mb-2 flex items-start gap-2">
        <div className="mt-0.5 h-6 w-1 shrink-0 rounded-full bg-primary/80" />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold leading-snug">{project.name}</h3>
          {project.isPending && <p className="text-xs text-muted-foreground">Сохраняется…</p>}
        </div>
        <span className="flex shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs tabular-nums text-muted-foreground">
          <Users className="h-3 w-3" /> {count}
        </span>
        {project.isPinned && canManageProjects && (
          <button
            type="button"
            onClick={onUnpin}
            aria-label="Открепить проект"
            title="Открепить проект"
            disabled={project.isPending}
            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait disabled:opacity-50"
          >
            {count > 0 ? <Pin className="h-3.5 w-3.5" /> : <PinOff className="h-3.5 w-3.5" />}
          </button>
        )}
      </div>

      {count === 0 ? (
        <div className={cn('rounded-md border border-dashed px-3 py-3 text-center text-xs', isDropTarget ? 'border-primary/50 text-primary' : 'border-border text-muted-foreground')}>
          {canManagePlacements ? 'Перетащите сюда сотрудника' : 'Никто не назначен'}
        </div>
      ) : (
        <div className="flex flex-wrap gap-1">
          {project.employees.map((employee) => (
            <EmployeeChip
              key={employee.id}
              employee={employee}
              onRemove={
                canManagePlacements && employee.source === 'manual'
                  ? () => onRemoveEmployee(employee.id)
                  : undefined
              }
            />
          ))}
        </div>
      )}
    </div>
  )
}
