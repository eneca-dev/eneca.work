'use client'

import { cn } from '@/lib/utils'
import type { StageStatus } from '../hooks/useStageStatuses'
import { KANBAN_COLUMNS, COLUMN_MIN_WIDTH } from '../constants'

interface KanbanHeaderProps {
  statuses: StageStatus[]
}

// Цвета индикаторов (точек) для каждого статуса
const STATUS_INDICATOR_COLORS: Record<string, string> = {
  backlog: 'bg-slate-500',
  planned: 'bg-violet-500',
  in_progress: 'bg-blue-500',
  paused: 'bg-amber-500',
  review: 'bg-pink-500',
  done: 'bg-emerald-500',
}

export function KanbanHeader({ statuses }: KanbanHeaderProps) {
  return (
    <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b">
      {/* Column Headers */}
      <div className="flex px-1.5 py-2.5">
        {statuses.map((status) => {
          // Находим соответствующую колонку из констант по порядку
          const column = KANBAN_COLUMNS[status.kanban_order]
          const indicatorColor = STATUS_INDICATOR_COLORS[column?.id || ''] || 'bg-slate-400'

          return (
            <div
              key={status.id}
              className="flex-shrink-0 px-1.5"
              style={{ width: COLUMN_MIN_WIDTH }}
            >
              {/* Badge-style header */}
              <div
                className={cn(
                  'flex items-center justify-center gap-2',
                  'px-4 py-2 rounded-lg',
                  'border transition-colors',
                  column?.bgColor,
                  column?.borderColor
                )}
              >
                <div
                  className={cn(
                    'w-2 h-2 rounded-full',
                    'ring-2 ring-white/50 dark:ring-black/20',
                    indicatorColor
                  )}
                />
                <span className={cn('text-sm font-medium', column?.color)}>
                  {status.name}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
