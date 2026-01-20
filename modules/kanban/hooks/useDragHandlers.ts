import { useState, useCallback } from 'react'
import type { StageStatus } from '../types'

interface DraggedCard {
  stageId: string
  sectionId: string
}

interface UseDragHandlersParams {
  onUpdateStatus: (params: {
    stageId: string
    sectionId: string
    newStatus: StageStatus
  }) => void
}

interface UseDragHandlersReturn {
  draggedCard: DraggedCard | null
  handleDragStart: (stageId: string, sectionId: string, e: React.DragEvent) => void
  handleDragOver: (targetSectionId: string, e: React.DragEvent) => void
  handleDrop: (targetSectionId: string, targetStatus: StageStatus, e: React.DragEvent) => void
  handleDragEnd: () => void
}

/**
 * Hook для управления HTML5 Drag and Drop в канбан-доске
 *
 * Выделен из KanbanBoard для устранения дублирования кода
 * между KanbanBoardInternal и KanbanBoard компонентами.
 */
export function useDragHandlers({
  onUpdateStatus,
}: UseDragHandlersParams): UseDragHandlersReturn {
  const [draggedCard, setDraggedCard] = useState<DraggedCard | null>(null)

  const handleDragStart = useCallback(
    (stageId: string, sectionId: string, e: React.DragEvent) => {
      setDraggedCard({ stageId, sectionId })
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('text/plain', JSON.stringify({ stageId, sectionId }))
      if (e.currentTarget instanceof HTMLElement) {
        e.dataTransfer.setDragImage(e.currentTarget, 0, 0)
      }
    },
    []
  )

  const handleDragOver = useCallback(
    (targetSectionId: string, e: React.DragEvent) => {
      e.preventDefault()
      if (!draggedCard) {
        e.dataTransfer.dropEffect = 'none'
        return
      }
      // Запрещаем drop в другую секцию
      if (draggedCard.sectionId !== targetSectionId) {
        e.dataTransfer.dropEffect = 'none'
        return
      }
      e.dataTransfer.dropEffect = 'move'
    },
    [draggedCard]
  )

  const handleDrop = useCallback(
    (targetSectionId: string, targetStatus: StageStatus, e: React.DragEvent) => {
      e.preventDefault()
      if (!draggedCard) return
      if (draggedCard.sectionId !== targetSectionId) {
        setDraggedCard(null)
        return
      }
      onUpdateStatus({
        stageId: draggedCard.stageId,
        sectionId: draggedCard.sectionId,
        newStatus: targetStatus,
      })
      setDraggedCard(null)
    },
    [draggedCard, onUpdateStatus]
  )

  const handleDragEnd = useCallback(() => {
    setDraggedCard(null)
  }, [])

  return {
    draggedCard,
    handleDragStart,
    handleDragOver,
    handleDrop,
    handleDragEnd,
  }
}
