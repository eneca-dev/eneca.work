/**
 * Optimistic Updates Utilities
 *
 * Общие утилиты для optimistic updates в иерархии бюджетов.
 * Устраняет дублирование кода между inline CRUD компонентами.
 */

import type { QueryClient, QueryKey } from '@tanstack/react-query'
import type { HierarchyNode, BudgetInfo } from '../types'
import { queryKeys } from '@/modules/cache'

// ============================================================================
// Types
// ============================================================================

/**
 * Тип кешированных данных Resource Graph (с пагинацией)
 */
type CachedResourceGraphData = {
  success: true
  data: HierarchyNode[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}

export type OptimisticSnapshot = Array<[QueryKey, CachedResourceGraphData | undefined]>

// ============================================================================
// Snapshot Operations
// ============================================================================

/**
 * Сохраняет текущее состояние кэша для возможного отката
 */
export function saveOptimisticSnapshot(queryClient: QueryClient): OptimisticSnapshot {
  return queryClient.getQueriesData<CachedResourceGraphData>({
    queryKey: queryKeys.resourceGraph.all,
  })
}

/**
 * Откатывает optimistic update к сохранённому состоянию
 */
export function rollbackOptimisticUpdate(
  queryClient: QueryClient,
  snapshot: OptimisticSnapshot
): void {
  for (const [queryKey, data] of snapshot) {
    queryClient.setQueryData(queryKey, data)
  }
}

// ============================================================================
// Tree Manipulation
// ============================================================================

/**
 * Рекурсивно обновляет узел в иерархии по предикату
 */
export function updateHierarchyNode(
  nodes: HierarchyNode[],
  predicate: (node: HierarchyNode) => boolean,
  updater: (node: HierarchyNode) => HierarchyNode
): HierarchyNode[] {
  return nodes.map((node) => {
    if (predicate(node)) {
      return updater(node)
    }
    if (node.children && node.children.length > 0) {
      return { ...node, children: updateHierarchyNode(node.children, predicate, updater) }
    }
    return node
  })
}

/**
 * Рекурсивно удаляет узел из иерархии по ID
 */
export function removeHierarchyNode(
  nodes: HierarchyNode[],
  nodeId: string
): HierarchyNode[] {
  return nodes
    .filter((node) => node.id !== nodeId)
    .map((node) => {
      if (node.children && node.children.length > 0) {
        return { ...node, children: removeHierarchyNode(node.children, nodeId) }
      }
      return node
    })
}

/**
 * Добавляет дочерний узел к родителю
 */
export function addChildToParent(
  nodes: HierarchyNode[],
  parentId: string,
  parentType: HierarchyNode['type'],
  newChild: HierarchyNode
): HierarchyNode[] {
  return updateHierarchyNode(
    nodes,
    (node) => node.type === parentType && node.id === parentId,
    (node) => ({
      ...node,
      children: [...(node.children || []), newChild],
    })
  )
}

// ============================================================================
// Entity Factories
// ============================================================================

/**
 * Создаёт optimistic бюджет для новой сущности
 */
export function createOptimisticBudget(tempBudgetId: string): BudgetInfo {
  return {
    budget_id: tempBudgetId,
    name: 'Бюджет',
    planned_amount: 0,
    spent_amount: 0,
    remaining_amount: 0,
    spent_percentage: 0,
    main_part_id: null,
    main_amount: 0,
    main_spent: 0,
    premium_part_id: null,
    premium_amount: null,
    premium_spent: 0,
    type_id: null,
    type_name: null,
    type_color: null,
    parent_budget_id: null,
    parent_planned_amount: 0,
    is_active: true,
  }
}

/**
 * Создаёт optimistic этап декомпозиции
 */
export function createOptimisticStage(
  tempId: string,
  name: string,
  operationId: number
): HierarchyNode {
  return {
    id: tempId,
    name,
    type: 'decomposition_stage',
    entityType: 'decomposition_stage',
    children: [],
    budgets: [createOptimisticBudget(`temp-budget-${operationId}`)],
    aggregatedBudgets: [],
    plannedHours: 0,
  }
}

/**
 * Создаёт optimistic задачу декомпозиции
 */
export function createOptimisticItem(
  tempId: string,
  name: string,
  operationId: number
): HierarchyNode {
  return {
    id: tempId,
    name,
    type: 'decomposition_item',
    entityType: 'decomposition_item',
    children: [],
    budgets: [createOptimisticBudget(`temp-budget-${operationId}`)],
    aggregatedBudgets: [],
    plannedHours: 0,
  }
}

// ============================================================================
// Cache Invalidation
// ============================================================================

/**
 * Инвалидирует все связанные кэши после изменения иерархии
 */
export async function invalidateHierarchyCache(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.decomposition.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.sections.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.resourceGraph.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.budgets.all }),
  ])
}
