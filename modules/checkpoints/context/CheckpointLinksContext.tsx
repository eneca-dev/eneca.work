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

interface SectionVisibility {
  sectionId: string
  sectionName: string
  isExpanded: boolean
}

interface ObjectVisibility {
  objectId: string
  objectName: string
  isExpanded: boolean
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
  /** Обновить видимость секции (развёрнута/свёрнута) */
  trackSectionVisibility: (sectionId: string, sectionName: string, isExpanded: boolean) => void
  /** Получить информацию о видимости секции */
  getSectionVisibility: (sectionId: string) => SectionVisibility | undefined
  /** Обновить видимость объекта (развёрнут/свёрнут) */
  trackObjectVisibility: (objectId: string, objectName: string, isExpanded: boolean) => void
  /** Получить информацию о видимости объекта */
  getObjectVisibility: (objectId: string) => ObjectVisibility | undefined
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
  const [sectionVisibility, setSectionVisibility] = useState<Map<string, SectionVisibility>>(new Map())
  const [objectVisibility, setObjectVisibility] = useState<Map<string, ObjectVisibility>>(new Map())

  const registerCheckpoint = useCallback((position: CheckpointPosition) => {
    console.log('[CheckpointLinksContext] 📝 Registering checkpoint:', {
      checkpoint_id: position.checkpoint.checkpoint_id,
      sectionId: position.sectionId,
      x: position.x,
      y: position.y,
      overlapIndex: position.overlapIndex,
      overlapTotal: position.overlapTotal,
      linkedSectionsCount: position.checkpoint.linked_sections?.length || 0,
    })

    setPositions(prev => {
      // Удаляем старую позицию если есть, добавляем новую
      const filtered = prev.filter(
        p => !(p.checkpoint.checkpoint_id === position.checkpoint.checkpoint_id && p.sectionId === position.sectionId)
      )
      const newPositions = [...filtered, position]

      console.log('[CheckpointLinksContext] 📊 Total positions after registration:', {
        total: newPositions.length,
        byCheckpointId: newPositions.reduce((acc, p) => {
          acc[p.checkpoint.checkpoint_id] = (acc[p.checkpoint.checkpoint_id] || 0) + 1
          return acc
        }, {} as Record<string, number>),
      })

      return newPositions
    })
  }, [])

  const unregisterCheckpoint = useCallback((checkpointId: string, sectionId: string) => {
    console.log('[CheckpointLinksContext] 🗑️ Unregistering checkpoint:', {
      checkpoint_id: checkpointId,
      sectionId,
    })

    setPositions(prev => {
      const newPositions = prev.filter(
        p => !(p.checkpoint.checkpoint_id === checkpointId && p.sectionId === sectionId)
      )

      console.log('[CheckpointLinksContext] 📊 Total positions after unregistration:', {
        total: newPositions.length,
      })

      return newPositions
    })
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

  const trackSectionVisibility = useCallback((sectionId: string, sectionName: string, isExpanded: boolean) => {
    console.log('[CheckpointLinksContext] 👁️ Tracking section visibility:', {
      sectionId,
      sectionName,
      isExpanded,
      action: isExpanded ? 'EXPAND' : 'COLLAPSE',
    })

    setSectionVisibility(prev => {
      const next = new Map(prev)
      next.set(sectionId, { sectionId, sectionName, isExpanded })

      console.log('[CheckpointLinksContext] 📊 Total sections tracked:', {
        total: next.size,
        expanded: Array.from(next.values()).filter(v => v.isExpanded).length,
        collapsed: Array.from(next.values()).filter(v => !v.isExpanded).length,
      })

      return next
    })
  }, [])

  const getSectionVisibility = useCallback((sectionId: string) => {
    const visibility = sectionVisibility.get(sectionId)

    console.log('[CheckpointLinksContext] 🔍 Getting section visibility:', {
      sectionId,
      found: !!visibility,
      isExpanded: visibility?.isExpanded,
      sectionName: visibility?.sectionName,
    })

    return visibility
  }, [sectionVisibility])

  const trackObjectVisibility = useCallback((objectId: string, objectName: string, isExpanded: boolean) => {
    console.log('[CheckpointLinksContext] 🏢 Tracking object visibility:', {
      objectId,
      objectName,
      isExpanded,
      action: isExpanded ? 'EXPAND' : 'COLLAPSE',
    })

    setObjectVisibility(prev => {
      const next = new Map(prev)
      next.set(objectId, { objectId, objectName, isExpanded })

      console.log('[CheckpointLinksContext] 📊 Total objects tracked:', {
        total: next.size,
        expanded: Array.from(next.values()).filter(v => v.isExpanded).length,
        collapsed: Array.from(next.values()).filter(v => !v.isExpanded).length,
      })

      return next
    })
  }, [])

  const getObjectVisibility = useCallback((objectId: string) => {
    const visibility = objectVisibility.get(objectId)

    console.log('[CheckpointLinksContext] 🔍 Getting object visibility:', {
      objectId,
      found: !!visibility,
      isExpanded: visibility?.isExpanded,
      objectName: visibility?.objectName,
    })

    return visibility
  }, [objectVisibility])

  return (
    <CheckpointLinksContext.Provider
      value={{
        registerCheckpoint,
        unregisterCheckpoint,
        positions,
        getGroupMaxOffset,
        trackSectionVisibility,
        getSectionVisibility,
        trackObjectVisibility,
        getObjectVisibility
      }}
    >
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
