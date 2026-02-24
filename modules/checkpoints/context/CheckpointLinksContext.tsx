'use client'

import { createContext, useContext, useState, useCallback, useRef, useMemo, useEffect, type ReactNode } from 'react'
import type { Checkpoint } from '../actions/checkpoints'
import { useUIStateStore } from '@/modules/resource-graph/stores'

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
  /** Версия layout - инкрементируется при изменении expandedNodes */
  layoutVersion: number
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

/**
 * Провайдер для отслеживания позиций чекпоинтов
 *
 * Каждый видимый чекпоинт регистрирует свою позицию через registerCheckpoint.
 * CheckpointVerticalLinks использует эти позиции для отрисовки связей.
 *
 * Когда секция сворачивается/скрывается, чекпоинт отменяет регистрацию
 * через unregisterCheckpoint (в useEffect cleanup).
 *
 * ОПТИМИЗАЦИЯ: Используем useRef + Map для хранения позиций, чтобы избежать
 * cascade re-renders. useState[version] используется только для trigger
 * финального re-render когда нужно отрисовать линии.
 *
 * FIX RG-001: Добавлен layoutVersion который инкрементируется при изменении
 * expandedNodes. Это заставляет CheckpointMarkerSvg пересчитывать позиции
 * когда другие строки раскрываются/сворачиваются.
 */
export function CheckpointLinksProvider({ children }: CheckpointLinksProviderProps) {
  // Map хранит позиции без trigger re-render при каждом изменении
  const positionsRef = useRef<Map<string, CheckpointPosition>>(new Map())

  // version увеличивается когда нужно пересчитать positions массив
  const [version, setVersion] = useState(0)

  // layoutVersion инкрементируется при изменении expandedNodes
  // Это заставляет useLayoutEffect в CheckpointMarkerSvg пересчитать позиции
  const [layoutVersion, setLayoutVersion] = useState(0)

  // Подписываемся на изменения expandedNodes
  const expandedNodes = useUIStateStore((state) => state.expandedNodes)

  // Вычисляем "fingerprint" текущего состояния expandedNodes для отслеживания изменений
  const expandedNodesFingerprint = useMemo(() => {
    // Суммируем размеры всех Set'ов - при любом expand/collapse сумма изменится
    return (
      expandedNodes.project.size +
      expandedNodes.object.size +
      expandedNodes.section.size +
      expandedNodes.decomposition_stage.size +
      expandedNodes.decomposition_item.size
    )
  }, [expandedNodes])

  // Инкрементируем layoutVersion при изменении fingerprint
  // Используем useEffect чтобы не блокировать рендер
  const prevFingerprintRef = useRef(expandedNodesFingerprint)
  useEffect(() => {
    if (prevFingerprintRef.current !== expandedNodesFingerprint) {
      prevFingerprintRef.current = expandedNodesFingerprint
      // Небольшая задержка чтобы DOM успел обновиться после expand/collapse
      const timeoutId = setTimeout(() => {
        setLayoutVersion(v => v + 1)
      }, 50)
      return () => clearTimeout(timeoutId)
    }
  }, [expandedNodesFingerprint])

  const registerCheckpoint = useCallback((position: CheckpointPosition) => {
    const key = `${position.checkpoint.checkpoint_id}-${position.sectionId}`
    positionsRef.current.set(key, position)
    setVersion(v => v + 1)
  }, [])

  const unregisterCheckpoint = useCallback((checkpointId: string, sectionId: string) => {
    const key = `${checkpointId}-${sectionId}`
    if (positionsRef.current.has(key)) {
      positionsRef.current.delete(key)
      setVersion(v => v + 1)
    }
  }, [])

  // Преобразуем Map в массив только когда version меняется
  const positions = useMemo(() => {
    return Array.from(positionsRef.current.values())
  }, [version])

  return (
    <CheckpointLinksContext.Provider
      value={{
        registerCheckpoint,
        unregisterCheckpoint,
        positions,
        layoutVersion,
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
