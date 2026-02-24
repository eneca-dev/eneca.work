'use client'

/**
 * TasksTab - Вкладка с этапами декомпозиции
 */

import { StagesManager } from '../decomposition'

// ============================================================================
// Types
// ============================================================================

interface TasksTabProps {
  sectionId: string
  onOpenLog?: (itemId: string) => void
}

// ============================================================================
// Component
// ============================================================================

export function TasksTab({ sectionId, onOpenLog }: TasksTabProps) {
  return (
    <div className="h-full overflow-hidden">
      <StagesManager sectionId={sectionId} onOpenLog={onOpenLog} />
    </div>
  )
}
