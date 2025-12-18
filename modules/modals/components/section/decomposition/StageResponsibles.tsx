'use client'

/**
 * StageResponsibles - Компонент для отображения ответственных на этапе
 */

import { Plus, X } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import type { Employee } from './types'

// ============================================================================
// Types
// ============================================================================

interface StageResponsiblesProps {
  responsibles: string[]
  employees: Employee[]
  onAdd: () => void
  onRemove: (userId: string) => void
  compact?: boolean
}

// ============================================================================
// Full View Component
// ============================================================================

function StageResponsiblesFull({
  responsibles,
  employees,
  onAdd,
  onRemove,
}: Omit<StageResponsiblesProps, 'compact'>) {
  const responsibleEmployees = employees.filter((emp) => responsibles.includes(emp.user_id))

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {responsibleEmployees.map((emp) => (
        <div
          key={emp.user_id}
          className="flex items-center gap-1.5 bg-primary/10 dark:bg-primary/20 hover:bg-primary/15 dark:hover:bg-primary/25 px-2.5 py-1 rounded-full border border-primary/20 transition-colors group"
        >
          <div className="flex items-center gap-1.5">
            {emp.avatar_url ? (
              <img
                src={emp.avatar_url}
                alt={emp.full_name}
                className="h-5 w-5 rounded-full object-cover"
              />
            ) : (
              <div className="h-5 w-5 rounded-full bg-primary/30 dark:bg-primary/40 flex items-center justify-center text-[10px] font-semibold text-primary-foreground">
                {emp.first_name?.[0]}
                {emp.last_name?.[0]}
              </div>
            )}
            <span className="text-xs font-medium text-foreground">
              {emp.first_name} {emp.last_name}
            </span>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onRemove(emp.user_id)
            }}
            className="opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/20 rounded-full p-0.5"
            title="Удалить ответственного"
          >
            <X className="h-3 w-3 text-destructive" />
          </button>
        </div>
      ))}
      <button
        onClick={onAdd}
        className="flex items-center justify-center h-7 w-7 rounded-full bg-muted/60 hover:bg-muted/80 dark:bg-muted/40 dark:hover:bg-muted/60 border border-border/40 hover:border-primary/40 transition-colors group"
        title="Добавить ответственного"
      >
        <Plus className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
      </button>
    </div>
  )
}

// ============================================================================
// Compact View Component (Avatars Only)
// ============================================================================

function StageResponsiblesAvatars({
  responsibles,
  employees,
  onAdd,
}: Omit<StageResponsiblesProps, 'onRemove' | 'compact'>) {
  const responsibleEmployees = employees.filter((emp) => responsibles.includes(emp.user_id))

  return (
    <TooltipProvider>
      <div className="flex items-center">
        {responsibleEmployees.map((emp, index) => (
          <Tooltip key={emp.user_id} delayDuration={300}>
            <TooltipTrigger asChild>
              <div
                className="relative cursor-pointer"
                style={{
                  marginLeft: index === 0 ? 0 : '-8px',
                  zIndex: responsibleEmployees.length - index,
                }}
              >
                {emp.avatar_url ? (
                  <img
                    src={emp.avatar_url}
                    alt={emp.full_name}
                    className="h-7 w-7 rounded-full object-cover border-2 border-background hover:border-primary/50 transition-colors"
                  />
                ) : (
                  <div className="h-7 w-7 rounded-full bg-primary/30 dark:bg-primary/40 flex items-center justify-center text-[10px] font-semibold text-primary-foreground border-2 border-background hover:border-primary/50 transition-colors">
                    {emp.first_name?.[0]}
                    {emp.last_name?.[0]}
                  </div>
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              <p className="font-medium">{emp.full_name}</p>
              {emp.position_name && (
                <p className="text-muted-foreground">{emp.position_name}</p>
              )}
            </TooltipContent>
          </Tooltip>
        ))}
        <Tooltip delayDuration={300}>
          <TooltipTrigger asChild>
            <button
              onClick={onAdd}
              className="flex items-center justify-center h-7 w-7 rounded-full bg-muted/60 hover:bg-muted/80 dark:bg-muted/40 dark:hover:bg-muted/60 border border-border/40 hover:border-primary/40 transition-colors"
              style={{
                marginLeft: responsibleEmployees.length > 0 ? '-8px' : 0,
                zIndex: 0,
              }}
            >
              <Plus className="h-4 w-4 text-muted-foreground" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            Добавить ответственного
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  )
}

// ============================================================================
// Main Export
// ============================================================================

export function StageResponsibles({
  responsibles,
  employees,
  onAdd,
  onRemove,
  compact = false,
}: StageResponsiblesProps) {
  if (compact) {
    return (
      <StageResponsiblesAvatars
        responsibles={responsibles}
        employees={employees}
        onAdd={onAdd}
      />
    )
  }

  return (
    <StageResponsiblesFull
      responsibles={responsibles}
      employees={employees}
      onAdd={onAdd}
      onRemove={onRemove}
    />
  )
}
