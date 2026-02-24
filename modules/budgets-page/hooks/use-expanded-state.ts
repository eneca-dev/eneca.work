/**
 * Expanded State Hook
 *
 * Управляет состоянием раскрытости узлов иерархии.
 * Сохраняет состояние в localStorage для persistence.
 */

'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import type { ExpandedState, HierarchyNode } from '../types'

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEY = 'budgets-hierarchy-expanded'
const DEBOUNCE_MS = 300

// ============================================================================
// Helpers
// ============================================================================

/**
 * Собирает все ID узлов из иерархии
 */
function collectAllNodeIds(nodes: HierarchyNode[]): string[] {
  const ids: string[] = []

  function collect(node: HierarchyNode) {
    ids.push(node.id)
    for (const child of node.children) {
      collect(child)
    }
  }

  for (const node of nodes) {
    collect(node)
  }

  return ids
}

/**
 * Загружает состояние из localStorage
 */
function loadFromStorage(): ExpandedState {
  if (typeof window === 'undefined') return {}

  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch (e) {
    console.warn('[useExpandedState] Failed to load from localStorage:', e)
  }

  return {}
}

/**
 * Сохраняет состояние в localStorage
 */
function saveToStorage(state: ExpandedState): void {
  if (typeof window === 'undefined') return

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch (e) {
    console.warn('[useExpandedState] Failed to save to localStorage:', e)
  }
}

// ============================================================================
// Hook
// ============================================================================

interface UseExpandedStateOptions {
  /** Начальные узлы (для определения проектов верхнего уровня) */
  nodes: HierarchyNode[]
}

interface UseExpandedStateResult {
  /** Текущее состояние раскрытости */
  expanded: ExpandedState
  /** Toggle одного узла */
  toggle: (nodeId: string) => void
  /** Раскрыть несколько узлов */
  expandMultiple: (nodeIds: string[]) => void
  /** Раскрыть узел и его родителей до корня */
  expandWithParents: (nodeId: string, parentIds: string[]) => void
  /** Раскрыть все */
  expandAll: () => void
  /** Свернуть все */
  collapseAll: () => void
}

export function useExpandedState({ nodes }: UseExpandedStateOptions): UseExpandedStateResult {
  // Инициализация: загружаем из localStorage или раскрываем проекты по умолчанию
  const [expanded, setExpanded] = useState<ExpandedState>(() => {
    const stored = loadFromStorage()

    // Если есть сохранённое состояние - используем его
    if (Object.keys(stored).length > 0) {
      return stored
    }

    // Иначе раскрываем только проекты верхнего уровня
    const initial: ExpandedState = {}
    for (const node of nodes) {
      initial[node.id] = true
    }
    return initial
  })

  // Debounced save to localStorage
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    // Debounce save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveToStorage(expanded)
    }, DEBOUNCE_MS)

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [expanded])

  // Toggle одного узла
  const toggle = useCallback((nodeId: string) => {
    setExpanded((prev) => ({
      ...prev,
      [nodeId]: !prev[nodeId],
    }))
  }, [])

  // Раскрыть несколько узлов
  const expandMultiple = useCallback((nodeIds: string[]) => {
    setExpanded((prev) => {
      const next = { ...prev }
      for (const id of nodeIds) {
        next[id] = true
      }
      return next
    })
  }, [])

  // Раскрыть узел и его родителей
  const expandWithParents = useCallback((nodeId: string, parentIds: string[]) => {
    setExpanded((prev) => {
      const next = { ...prev }
      // Раскрываем родителей
      for (const id of parentIds) {
        next[id] = true
      }
      // Раскрываем сам узел
      next[nodeId] = true
      return next
    })
  }, [])

  // Раскрыть все
  const expandAll = useCallback(() => {
    const allIds = collectAllNodeIds(nodes)
    const newExpanded: ExpandedState = {}
    for (const id of allIds) {
      newExpanded[id] = true
    }
    setExpanded(newExpanded)
  }, [nodes])

  // Свернуть все
  const collapseAll = useCallback(() => {
    setExpanded({})
  }, [])

  return {
    expanded,
    toggle,
    expandMultiple,
    expandWithParents,
    expandAll,
    collapseAll,
  }
}
