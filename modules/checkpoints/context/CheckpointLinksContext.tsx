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
}

interface CheckpointLinksContextValue {
  /** Зарегистрировать позицию чекпоинта */
  registerCheckpoint: (position: CheckpointPosition) => void
  /** Отменить регистрацию чекпоинта */
  unregisterCheckpoint: (checkpointId: string, sectionId: string) => void
  /** Все зарегистрированные позиции */
  positions: CheckpointPosition[]
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

  return (
    <CheckpointLinksContext.Provider value={{ registerCheckpoint, unregisterCheckpoint, positions }}>
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
