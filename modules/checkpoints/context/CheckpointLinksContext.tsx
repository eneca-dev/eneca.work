'use client'

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import type { Checkpoint } from '../actions/checkpoints'

// ============================================================================
// Types
// ============================================================================

interface CheckpointPosition {
  checkpoint: Checkpoint
  sectionId: string
  /** Y позиция центра маркера чекпоинта в пикселях от верха timeline */
  y: number
  /** X позиция центра маркера чекпоинта в пикселях от левого края timeline */
  x: number
  /** Индекс наложения (для синхронизации смещения между связанными чекпоинтами) */
  overlapIndex: number
  /** Общее количество чекпоинтов на эту дату */
  overlapTotal: number
}

interface CheckpointLinksContextValue {
  /** Зарегистрировать позицию чекпоинта */
  registerCheckpoint: (position: CheckpointPosition) => void
  /** Отменить регистрацию чекпоинта */
  unregisterCheckpoint: (checkpointId: string, sectionId: string) => void
  /** Все зарегистрированные позиции */
  positions: CheckpointPosition[]
  /** Получить синхронизированное максимальное смещение по X для группы связанных чекпоинтов */
  getGroupMaxOffset: (checkpointId: string) => number | null
}

// ============================================================================
// Context
// ============================================================================

const CheckpointLinksContext = createContext<CheckpointLinksContextValue | null>(null)

// ============================================================================
// Provider
// ============================================================================

interface CheckpointLinksProviderProps {
  children: ReactNode
}

export function CheckpointLinksProvider({ children }: CheckpointLinksProviderProps) {
  const [positions, setPositions] = useState<CheckpointPosition[]>([])

  const registerCheckpoint = useCallback((position: CheckpointPosition) => {
    setPositions(prev => {
      // Удаляем старую позицию если есть, добавляем новую
      const filtered = prev.filter(
        p => !(p.checkpoint.checkpoint_id === position.checkpoint.checkpoint_id && p.sectionId === position.sectionId)
      )
      return [...filtered, position]
    })
  }, [])

  const unregisterCheckpoint = useCallback((checkpointId: string, sectionId: string) => {
    setPositions(prev => prev.filter(
      p => !(p.checkpoint.checkpoint_id === checkpointId && p.sectionId === sectionId)
    ))
  }, [])

  const getGroupMaxOffset = useCallback((checkpointId: string) => {
    // Находим все позиции с этим checkpoint_id
    const groupPositions = positions.filter(p => p.checkpoint.checkpoint_id === checkpointId)

    // Если нет связанных чекпоинтов (< 2 позиций), возвращаем null
    if (groupPositions.length < 2) {
      return null
    }

    // Находим максимальный overlapIndex и overlapTotal в группе
    let maxOverlapIndex = 0
    let maxOverlapTotal = 1

    for (const pos of groupPositions) {
      if (pos.overlapTotal > maxOverlapTotal ||
          (pos.overlapTotal === maxOverlapTotal && pos.overlapIndex > maxOverlapIndex)) {
        maxOverlapIndex = pos.overlapIndex
        maxOverlapTotal = pos.overlapTotal
      }
    }

    // Вычисляем только смещение по X (без смещения по Y)
    const offsetMultiplier = maxOverlapTotal > 1 ? maxOverlapIndex - (maxOverlapTotal - 1) / 2 : 0
    const OVERLAP_OFFSET_X = 6

    return offsetMultiplier * OVERLAP_OFFSET_X
  }, [positions])

  return (
    <CheckpointLinksContext.Provider value={{ registerCheckpoint, unregisterCheckpoint, positions, getGroupMaxOffset }}>
      {children}
    </CheckpointLinksContext.Provider>
  )
}

// ============================================================================
// Hook
// ============================================================================

export function useCheckpointLinks() {
  const context = useContext(CheckpointLinksContext)
  if (!context) {
    throw new Error('useCheckpointLinks must be used within CheckpointLinksProvider')
  }
  return context
}
