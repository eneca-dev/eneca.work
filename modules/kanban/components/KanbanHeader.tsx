'use client'

import { cn } from '@/lib/utils'
import type { StageStatus } from '../hooks/useStageStatuses'

interface KanbanHeaderProps {
  statuses: StageStatus[]
}

export function KanbanHeader({ statuses }: KanbanHeaderProps) {
  return (
    <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b">
      <div className="flex h-full">
        {/* Spacer for swimlane header area */}
        <div className="w-0 flex-shrink-0" />

        {/* Column Headers */}
        <div className="flex flex-1 gap-0">
          {statuses.map((status) => (
            <div
              key={status.id}
              className="flex-1 px-3 py-3 bg-muted/30"
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: status.color }}
                />
                <span className="text-sm font-medium text-foreground/90">
                  {status.name}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
