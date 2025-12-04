'use client'

import { KanbanBoard } from '@/modules/kanban'

export default function KanbanPage() {
  return (
    <div className="h-full flex flex-col">
      <KanbanBoard />
    </div>
  )
}
