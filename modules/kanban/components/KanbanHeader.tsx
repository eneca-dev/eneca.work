'use client'

import { cn } from '@/lib/utils'
import type { StageStatus } from '../hooks/useStageStatuses'
import { KANBAN_COLUMNS } from '../constants'

interface KanbanHeaderProps {
  statuses: StageStatus[]
}

// Маппинг цветов статусов из констант (500-е оттенки для индикаторов)
const STATUS_INDICATOR_COLORS: Record<string, string> = {
  backlog: 'bg-gray-400',
  planned: 'bg-violet-500',
  in_progress: 'bg-blue-500',
  paused: 'bg-amber-500',
  review: 'bg-pink-500',
  done: 'bg-green-500',
}

export function KanbanHeader({ statuses }: KanbanHeaderProps) {
  return (
    <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b">
      <div className="flex h-full">
        {/* Spacer for swimlane header area */}
        <div className="w-0 flex-shrink-0" />

        {/* Column Headers */}
        <div className="flex flex-1 gap-0">
          {statuses.map((status) => {
            // Находим соответствующую колонку из констант по порядку
            const column = KANBAN_COLUMNS[status.kanban_order]
            const indicatorColor = STATUS_INDICATOR_COLORS[column?.id || ''] || 'bg-gray-400'

            return (
              <div
                key={status.id}
                className="flex-1 px-3 py-3 bg-muted/30"
              >
                <div className="flex items-center justify-center gap-2">
                  <div className={cn('w-2 h-2 rounded-full', indicatorColor)} />
                  <span className="text-sm font-medium text-foreground/90">
                    {status.name}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
