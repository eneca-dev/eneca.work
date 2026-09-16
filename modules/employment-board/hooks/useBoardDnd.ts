'use client'

import { useState, useCallback } from 'react'

/**
 * Нативный HTML5 drag & drop — по паттерну modules/kanban/hooks/useDragHandlers.
 * @dnd-kit здесь не используется осознанно: см. modules/kanban/drag-and-drop-implementation.md
 */

export type DragPayload =
  | { kind: 'employee'; employeeId: string }
  | { kind: 'project'; projectId: string }

interface UseBoardDndParams {
  onDropEmployee: (employeeId: string, projectId: string) => void
  onDropProject: (projectId: string) => void
}

export function useBoardDnd({ onDropEmployee, onDropProject }: UseBoardDndParams) {
  const [dragged, setDragged] = useState<DragPayload | null>(null)

  const handleDragStart = useCallback((payload: DragPayload, e: React.DragEvent) => {
    setDragged(payload)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', JSON.stringify(payload))
  }, [])

  const handleDragEnd = useCallback(() => setDragged(null), [])

  /** Карточка проекта принимает только сотрудников */
  const handleProjectDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      // Критично: без stopPropagation всплывший handleBoardDragOver перезапишет
      // dropEffect на 'none' (фон принимает только проекты), и браузер вообще
      // не выдаст событие drop — перетаскивание молча не работает.
      e.stopPropagation()
      e.dataTransfer.dropEffect = dragged?.kind === 'employee' ? 'move' : 'none'
    },
    [dragged],
  )

  const handleProjectDrop = useCallback(
    (projectId: string, e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (dragged?.kind === 'employee') onDropEmployee(dragged.employeeId, projectId)
      setDragged(null)
    },
    [dragged, onDropEmployee],
  )

  /** Фон доски принимает только проекты (закрепление) */
  const handleBoardDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.dataTransfer.dropEffect = dragged?.kind === 'project' ? 'copy' : 'none'
    },
    [dragged],
  )

  const handleBoardDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      if (dragged?.kind === 'project') onDropProject(dragged.projectId)
      setDragged(null)
    },
    [dragged, onDropProject],
  )

  return {
    dragged,
    handleDragStart,
    handleDragEnd,
    handleProjectDragOver,
    handleProjectDrop,
    handleBoardDragOver,
    handleBoardDrop,
  }
}
