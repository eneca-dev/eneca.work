/**
 * Budgets Hierarchy Component
 *
 * Отображает полную иерархию проектов с бюджетами.
 * Табличный вид с группами колонок и sticky заголовками.
 */

'use client'

import { useCallback, useState, useRef } from 'react'
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
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)

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

  // Раскрыть несколько узлов сразу (для раскрытия раздела с содержимым)
  const handleExpandAll = useCallback((nodeIds: string[]) => {
    setExpanded((prev) => {
      const newExpanded = { ...prev }
      for (const id of nodeIds) {
        newExpanded[id] = true
      }
      return newExpanded
    })
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

  // Синхронизация горизонтального скролла
  const handleScroll = useCallback(() => {
    if (scrollContainerRef.current && headerRef.current) {
      headerRef.current.scrollLeft = scrollContainerRef.current.scrollLeft
    }
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
      <div className={cn('flex flex-col h-full bg-slate-950', className)}>
        {/* Top controls */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-slate-300">
              Иерархия проектов
            </span>
            <span className="text-xs text-slate-500">
              {nodes.length} {nodes.length === 1 ? 'проект' : 'проекта'}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={expandAll}
              className="h-7 px-2 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            >
              <ChevronDown className="h-3 w-3 mr-1" />
              Развернуть
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={collapseAll}
              className="h-7 px-2 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            >
              <ChevronRight className="h-3 w-3 mr-1" />
              Свернуть
            </Button>
          </div>
        </div>

        {/* Column headers - sticky with horizontal scroll sync */}
        <div
          ref={headerRef}
          className="overflow-x-hidden border-b border-slate-700 bg-slate-900 sticky top-0 z-10"
        >
          {/* Group headers row */}
          <div className="flex items-center min-w-max border-b border-slate-800">
            {/* Наименование + Категория */}
            <div className="min-w-[300px] w-[300px] shrink-0" />
            <div className="w-10 shrink-0" />

            {/* ТРУДОЗАТРАТЫ */}
            <div className="flex items-center shrink-0 border-l border-slate-700/30">
              <div className="w-[196px] py-1.5 text-center">
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                  Трудозатраты
                </span>
              </div>
            </div>

            {/* БЮДЖЕТ */}
            <div className="flex items-center shrink-0 border-l border-slate-700/30">
              <div className="w-[92px] py-1.5 text-center">
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                  Ставка
                </span>
              </div>
            </div>

            {/* СРАВНЕНИЕ БЮДЖЕТОВ */}
            <div className="flex items-center shrink-0 border-l border-slate-700/30">
              <div className="w-[180px] py-1.5 text-center">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  Расчётный / Выделенный
                </span>
              </div>
            </div>

            {/* ВЫДЕЛЕННЫЙ БЮДЖЕТ - детали */}
            <div className="flex-1 min-w-[280px] shrink-0 border-l border-slate-700/30">
              <div className="py-1.5 px-2">
                <span className="text-[10px] font-semibold text-amber-500/70 uppercase tracking-wider">
                  Распределение бюджета
                </span>
              </div>
            </div>
          </div>

          {/* Subheaders row */}
          <div className="flex items-center min-w-max">
            {/* Наименование */}
            <div className="min-w-[300px] w-[300px] px-2 py-1.5 shrink-0">
              <span className="text-[10px] text-slate-500">
                Наименование
              </span>
            </div>

            {/* Категория */}
            <div className="w-10 py-1.5 text-center shrink-0">
              <span className="text-[10px] text-slate-500">
                Кат.
              </span>
            </div>

            {/* ТРУДОЗАТРАТЫ subheaders */}
            <div className="flex items-center shrink-0 border-l border-slate-700/30">
              <div className="w-[72px] py-1.5 px-2 text-right">
                <span className="text-[10px] text-slate-500">
                  Плановые
                </span>
              </div>
              <div className="w-[72px] py-1.5 px-2 text-right">
                <span className="text-[10px] text-slate-500">
                  С коэфф.
                </span>
              </div>
              <div className="w-[52px] py-1.5 px-1 text-right">
                <span className="text-[10px] text-slate-500">
                  % общ.
                </span>
              </div>
            </div>

            {/* СТАВКА subheaders */}
            <div className="flex items-center shrink-0 border-l border-slate-700/30">
              <div className="w-[92px] py-1.5 px-2 text-right">
                <span className="text-[10px] text-slate-500">
                  BYN/час
                </span>
              </div>
            </div>

            {/* СРАВНЕНИЕ subheaders */}
            <div className="flex items-center shrink-0 border-l border-slate-700/30">
              <div className="w-[90px] py-1.5 px-2 text-right">
                <span className="text-[10px] text-cyan-500/70">
                  Расчётный
                </span>
              </div>
              <div className="w-[90px] py-1.5 px-2 text-right">
                <span className="text-[10px] text-amber-500/70">
                  Выделенный
                </span>
              </div>
            </div>

            {/* РАСПРЕДЕЛЕНИЕ subheaders */}
            <div className="flex items-center flex-1 min-w-[280px] shrink-0 border-l border-slate-700/30 px-2 py-1.5">
              <div className="w-14 text-right">
                <span className="text-[10px] text-slate-500">
                  % распр.
                </span>
              </div>
              <div className="flex-1 pl-3">
                <span className="text-[10px] text-slate-500">
                  По типам бюджета
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable content */}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-auto"
        >
          <div className="min-w-max">
            {nodes.map((node) => (
              <BudgetRow
                key={node.id}
                node={node}
                level={0}
                expanded={expanded}
                onToggle={handleToggle}
                onExpandAll={handleExpandAll}
              />
            ))}
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}
