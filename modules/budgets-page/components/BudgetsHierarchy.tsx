/**
 * Budgets Hierarchy Component
 *
 * Отображает полную иерархию проектов с бюджетами.
 * Управляет состоянием развёрнутости узлов.
 */

'use client'

import { useCallback, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { TooltipProvider } from '@/components/ui/tooltip'
import { BudgetRow } from './BudgetRow'
import type { HierarchyNode, ExpandedState } from '../types'

// ============================================================================
// Types
// ============================================================================

interface BudgetsHierarchyProps {
  /** Узлы иерархии (корневые проекты) */
  nodes: HierarchyNode[]
  /** CSS класс контейнера */
  className?: string
}

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

// ============================================================================
// Main Component
// ============================================================================

export function BudgetsHierarchy({ nodes, className }: BudgetsHierarchyProps) {
  // По умолчанию разворачиваем первый уровень (проекты)
  const [expanded, setExpanded] = useState<ExpandedState>(() => {
    const initial: ExpandedState = {}
    for (const node of nodes) {
      initial[node.id] = true
    }
    return initial
  })

  // Toggle узла
  const handleToggle = useCallback((nodeId: string) => {
    setExpanded((prev) => ({
      ...prev,
      [nodeId]: !prev[nodeId],
    }))
  }, [])

  // Развернуть все
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

  if (nodes.length === 0) {
    return (
      <div className={cn('flex items-center justify-center h-40', className)}>
        <p className="text-muted-foreground">Нет данных для отображения</p>
      </div>
    )
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className={cn('flex flex-col h-full', className)}>
        {/* Header with controls */}
        <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
          <div className="flex items-center gap-4">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Иерархия проектов
            </span>
            <span className="text-xs text-muted-foreground">
              {nodes.length} {nodes.length === 1 ? 'проект' : 'проекта'}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={expandAll}
              className="h-7 px-2 text-xs"
            >
              <ChevronDown className="h-3 w-3 mr-1" />
              Развернуть
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={collapseAll}
              className="h-7 px-2 text-xs"
            >
              <ChevronRight className="h-3 w-3 mr-1" />
              Свернуть
            </Button>
          </div>
        </div>

        {/* Column headers */}
        <div className="flex items-center gap-2 px-3 py-1.5 border-b bg-muted/20 text-xs font-medium text-muted-foreground">
          <div className="w-5 shrink-0" /> {/* Expand button space */}
          <div className="w-14 shrink-0 text-center">Тип</div>
          <div className="flex-1">Название</div>
          <div className="w-20 shrink-0 text-center">Распред.</div>
          <div className="w-14 shrink-0 text-right">Часы</div>
          <div className="w-56 shrink-0">Бюджеты</div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          {nodes.map((node) => (
            <BudgetRow
              key={node.id}
              node={node}
              level={0}
              expanded={expanded}
              onToggle={handleToggle}
            />
          ))}
        </div>
      </div>
    </TooltipProvider>
  )
}
