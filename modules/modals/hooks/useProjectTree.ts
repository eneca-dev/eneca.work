'use client'

/**
 * Loading Modal New - Hook для загрузки дерева проекта
 *
 * Возвращает иерархию: project (со stage_type) -> object -> section -> decomposition_stage
 * Используется в левой панели для навигации по структуре проекта
 */

import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/modules/cache'
import { fetchProjectTree } from '../actions/projects-tree'
import type { ProjectTreeNode, FetchProjectTreeInput } from '../actions/projects-tree'

export interface ProjectTreeNodeWithChildren extends ProjectTreeNode {
  children?: ProjectTreeNodeWithChildren[]
}

/**
 * Построение иерархического дерева из плоского списка
 */
function buildTree(nodes: ProjectTreeNode[]): ProjectTreeNodeWithChildren[] {
  if (nodes.length === 0) {
    return []
  }

  // Группируем узлы по уровням
  const byLevel: Record<number, ProjectTreeNode[]> = {}
  const minLevel = Math.min(...nodes.map(n => n.level))
  const maxLevel = Math.max(...nodes.map(n => n.level))

  for (const node of nodes) {
    if (!byLevel[node.level]) {
      byLevel[node.level] = []
    }
    byLevel[node.level].push(node)
  }

  // Строим дерево снизу вверх
  const nodeMap = new Map<string, ProjectTreeNodeWithChildren>()

  // Сначала создаем все узлы
  for (const node of nodes) {
    nodeMap.set(node.id, { ...node, children: [] })
  }

  // Связываем родителей с детьми (от низа к верху)
  for (let level = maxLevel; level > minLevel; level--) {
    const currentLevelNodes = byLevel[level] || []

    for (const node of currentLevelNodes) {
      const nodeWithChildren = nodeMap.get(node.id)!

      // Находим родителя по уровню выше
      const parent = findParent(node, byLevel[level - 1] || [])

      if (parent) {
        const parentWithChildren = nodeMap.get(parent.id)
        if (parentWithChildren && !parentWithChildren.children!.find(c => c.id === node.id)) {
          parentWithChildren.children!.push(nodeWithChildren)
        }
      }
    }
  }

  // Возвращаем узлы минимального уровня (корневые)
  const roots = (byLevel[minLevel] || []).map(node => nodeMap.get(node.id)!).filter(Boolean)

  // Возвращаем корневые узлы
  // Корни могут быть любого типа (project, stage, object, section) в зависимости от того,
  // какие данные есть в БД для этого проекта
  return roots
}

/**
 * Находит родителя узла на основе связей через ID
 */
function findParent(node: ProjectTreeNode, potentialParents: ProjectTreeNode[]): ProjectTreeNode | null {
  // Поиск по типу узла
  if (node.type === 'decomposition_stage') {
    // Родитель - section
    return potentialParents.find(p => p.sectionId === node.sectionId && p.type === 'section') || null
  }
  if (node.type === 'section') {
    // Родитель - object
    return potentialParents.find(p => p.objectId === node.objectId && p.type === 'object') || null
  }
  if (node.type === 'object') {
    // Родитель - project (stage убран из иерархии)
    return potentialParents.find(p => p.projectId === node.projectId && p.type === 'project') || null
  }
  return null
}

export interface UseProjectTreeOptions {
  /** ID проекта */
  projectId: string | null
  /** Включить/отключить запрос */
  enabled?: boolean
}

export function useProjectTree(options: UseProjectTreeOptions) {
  const { projectId, enabled = true } = options

  return useQuery({
    queryKey: queryKeys.projects.tree(projectId || ''),
    queryFn: async () => {
      if (!projectId) {
        return []
      }

      const input: FetchProjectTreeInput = { projectId }
      const result = await fetchProjectTree(input)

      if (!result.success) {
        throw new Error(result.error)
      }

      // Строим иерархическое дерево из плоского списка
      const tree = buildTree(result.data)

      return tree
    },
    enabled: enabled && Boolean(projectId?.trim()),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  })
}

export type { ProjectTreeNode }
