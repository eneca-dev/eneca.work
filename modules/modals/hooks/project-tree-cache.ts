'use client'

/**
 * Чтение уже загруженного дерева проекта из кэша TanStack Query.
 *
 * Дерево (`queryKeys.projects.tree(projectId)`) содержит всю иерархию
 * project → object → section → decomposition_stage. Поэтому breadcrumbs (путь
 * к разделу) и этапы раздела можно взять прямо из него, без отдельных запросов
 * (`fetchBreadcrumbs`, `fetchDecompositionStages`) — когда дерево уже прогрето
 * префетчем (usePrefetchProjectTrees) или открытием другого проекта.
 *
 * Если подходящего дерева в кэше нет — функции возвращают null, и вызывающий хук
 * делает обычный сетевой запрос (фолбэк, поведение не меняется).
 */

import type { QueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/modules/cache'
import type { ProjectTreeNodeWithChildren } from './useProjectTree'
import type { DecompositionStage } from './useDecompositionStages'
import type { BreadcrumbItem } from '../actions/projects-tree'

/** Все закэшированные деревья проектов (ключ оканчивается на 'tree') */
function getCachedTrees(queryClient: QueryClient): ProjectTreeNodeWithChildren[][] {
  const entries = queryClient.getQueriesData<ProjectTreeNodeWithChildren[]>({
    queryKey: queryKeys.projects.details(),
  })
  return entries
    .filter(
      ([key, data]) =>
        Array.isArray(key) &&
        key[key.length - 1] === 'tree' &&
        Array.isArray(data) &&
        data.length > 0
    )
    .map(([, data]) => data as ProjectTreeNodeWithChildren[])
}

/**
 * Поиск узла в дереве по предикату (DFS pre-order — родитель проверяется раньше детей).
 * Возвращает узел и путь от корня до него (включительно).
 */
function findNodeWithPath(
  roots: ProjectTreeNodeWithChildren[],
  predicate: (n: ProjectTreeNodeWithChildren) => boolean,
  path: ProjectTreeNodeWithChildren[] = []
): { node: ProjectTreeNodeWithChildren; path: ProjectTreeNodeWithChildren[] } | null {
  for (const node of roots) {
    const nextPath = [...path, node]
    if (predicate(node)) return { node, path: nextPath }
    if (node.children?.length) {
      const found = findNodeWithPath(node.children, predicate, nextPath)
      if (found) return found
    }
  }
  return null
}

/**
 * Этапы декомпозиции раздела из закэшированного дерева.
 * - `DecompositionStage[]` — раздел найден (этапы в порядке дерева = decomposition_stage_order);
 *   пустой массив = у раздела нет этапов.
 * - `null` — раздела нет ни в одном закэшированном дереве → нужен сетевой запрос.
 */
export function findSectionStagesInCache(
  queryClient: QueryClient,
  sectionId: string
): DecompositionStage[] | null {
  for (const tree of getCachedTrees(queryClient)) {
    const found = findNodeWithPath(
      tree,
      (n) => n.type === 'section' && (n.id === sectionId || n.sectionId === sectionId)
    )
    if (found) {
      return (found.node.children ?? [])
        .filter((c) => c.type === 'decomposition_stage')
        .map((c) => ({
          id: c.decompositionStageId ?? c.id,
          name: c.name,
          description: c.description,
          startDate: c.startDate,
          endDate: c.endDate,
          order: null,
        }))
    }
  }
  return null
}

/**
 * Breadcrumbs (путь от проекта до узла) из закэшированного дерева.
 * Возвращает null, если узла нет в кэше → нужен сетевой запрос.
 */
export function findBreadcrumbsInCache(
  queryClient: QueryClient,
  nodeId: string
): { breadcrumbs: BreadcrumbItem[]; projectId: string } | null {
  for (const tree of getCachedTrees(queryClient)) {
    const found = findNodeWithPath(
      tree,
      (n) => n.id === nodeId || n.decompositionStageId === nodeId
    )
    if (found) {
      const projectId = found.path[0]?.projectId ?? found.path[0]?.id ?? null
      if (!projectId) return null
      const breadcrumbs: BreadcrumbItem[] = found.path.map((n) => ({
        id: n.id,
        name: n.name,
        type: n.type,
      }))
      return { breadcrumbs, projectId }
    }
  }
  return null
}
