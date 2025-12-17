'use client'

import { cn } from '@/lib/utils'
import { KANBAN_COLUMNS } from '../constants'

export function KanbanHeader() {
  return (
    <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b">
      <div className="flex h-full">
        {/* Spacer for swimlane header area */}
        <div className="w-0 flex-shrink-0" />

        {/* Column Headers */}
        <div className="flex flex-1 gap-0">
          {KANBAN_COLUMNS.map((column) => (
            <div
              key={column.id}
              className={cn(
                'flex-1',
                'px-3 py-3',
                column.bgColor
              )}
            >
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    'w-2 h-2 rounded-full',
                    column.id === 'backlog' && 'bg-slate-400',
                    column.id === 'planned' && 'bg-teal-500',
                    column.id === 'in_progress' && 'bg-orange-500',
                    column.id === 'paused' && 'bg-stone-500',
                    column.id === 'review' && 'bg-indigo-500',
                    column.id === 'done' && 'bg-emerald-500'
                  )}
                />
                <span className={cn('text-sm font-medium', column.color)}>
                  {column.title}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
