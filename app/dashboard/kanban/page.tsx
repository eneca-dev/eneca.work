'use client'

import { KanbanBoard } from '@/modules/kanban'

export default function KanbanPage() {
  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <KanbanBoard />
    </div>
  )
}
