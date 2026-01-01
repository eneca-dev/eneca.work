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
        {/* Column headers - sticky with horizontal scroll sync */}
        <div
          ref={headerRef}
          className="overflow-x-hidden border-b border-slate-700 bg-slate-900 sticky top-0 z-10"
        >
          {/* Group headers row */}
          <div className="flex items-center min-w-max border-b border-slate-800">
            {/* Наименование + Категория */}
            <div className="min-w-[400px] w-[400px] shrink-0" />
            <div className="w-10 shrink-0" />

            {/* ТРУДОЗАТРАТЫ */}
            <div className="flex items-center shrink-0 border-l border-slate-700/30">
              <div className="w-[196px] py-1.5 text-center">
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                  Трудозатраты
                </span>
              </div>
            </div>

            {/* СТАВКА */}
            <div className="flex items-center shrink-0 border-l border-slate-700/30">
              <div className="w-[72px] py-1.5 text-center">
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                  Ставка
                </span>
              </div>
            </div>

            {/* БЮДЖЕТЫ */}
            <div className="flex items-center flex-1 min-w-[340px] shrink-0 border-l border-slate-700/30">
              <div className="w-full py-1.5 text-center">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  Расчётный / Распределено / Выделенный
                </span>
              </div>
            </div>
          </div>

          {/* Subheaders row */}
          <div className="flex items-center min-w-max">
            {/* Наименование + кнопки */}
            <div className="min-w-[400px] w-[400px] px-2 py-1 shrink-0 flex items-center justify-between">
              <span className="text-[10px] text-slate-500">
                Наименование
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={expandAll}
                  className="h-5 px-1.5 text-[10px] text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded flex items-center gap-0.5"
                >
                  <ChevronDown className="h-3 w-3" />
                  Все
                </button>
                <button
                  onClick={collapseAll}
                  className="h-5 px-1.5 text-[10px] text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded flex items-center gap-0.5"
                >
                  <ChevronRight className="h-3 w-3" />
                  Скрыть
                </button>
              </div>
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
                  План, ч
                </span>
              </div>
              <div className="w-[72px] py-1.5 px-2 text-right">
                <span className="text-[10px] text-slate-500">
                  С К, ч
                </span>
              </div>
              <div className="w-[52px] py-1.5 px-1 text-right">
                <span className="text-[10px] text-slate-500">
                  %
                </span>
              </div>
            </div>

            {/* СТАВКА subheaders */}
            <div className="flex items-center shrink-0 border-l border-slate-700/30">
              <div className="w-[72px] py-1.5 px-2 text-right">
                <span className="text-[10px] text-slate-500">
                  BYN/ч
                </span>
              </div>
            </div>

            {/* БЮДЖЕТЫ subheaders */}
            <div className="flex items-center flex-1 min-w-[340px] shrink-0 border-l border-slate-700/30">
              <div className="w-[80px] py-1.5 px-1 text-right">
                <span className="text-[10px] text-cyan-500/70">Расчётн.</span>
              </div>
              <div className="w-[10px]" />
              <div className="w-[80px] py-1.5 px-1 text-center">
                <span className="text-[10px] text-slate-500">Распред.</span>
              </div>
              <div className="w-[10px]" />
              <div className="flex-1 py-1.5 px-1 text-left">
                <span className="text-[10px] text-emerald-500/70">Выделенный (сумма / %)</span>
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
