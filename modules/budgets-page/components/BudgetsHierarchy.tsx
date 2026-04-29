/**
 * Budgets Hierarchy Component
 *
 * Отображает иерархию проектов с бюджетами.
 * Колонки: Наименование / Расчётный / Распред. / Израсх. / Выделенный.
 * Состояние раскрытости сохраняется в localStorage.
 */

'use client'

import { useCallback, useRef, useEffect, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TooltipProvider } from '@/components/ui/tooltip'
import { BudgetRow } from './BudgetRow'
import { useExpandedState } from '../hooks/use-expanded-state'
import type { HierarchyNode } from '../types'

// ============================================================================
// Types
// ============================================================================

interface BudgetsHierarchyProps {
  nodes: HierarchyNode[]
  className?: string
  onRefresh?: () => void
  highlightSectionId?: string | null
}

// ============================================================================
// Main Component
// ============================================================================

export function BudgetsHierarchy({ nodes, className, onRefresh, highlightSectionId }: BudgetsHierarchyProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)
  const [hasAutoExpanded, setHasAutoExpanded] = useState(false)

  const {
    expanded,
    toggle: handleToggle,
    expandMultiple: handleExpandAll,
    expandWithParents,
    expandAll,
    collapseAll,
  } = useExpandedState({ nodes })

  // Синхронизация горизонтального скролла
  const handleScroll = useCallback(() => {
    if (scrollContainerRef.current && headerRef.current) {
      headerRef.current.scrollLeft = scrollContainerRef.current.scrollLeft
    }
  }, [])

  // Поиск узла и его родителей в дереве
  const findNodePath = useCallback((targetId: string, currentNodes: HierarchyNode[], path: string[] = []): string[] | null => {
    for (const node of currentNodes) {
      if (node.id === targetId) return path
      if (node.children && node.children.length > 0) {
        const result = findNodePath(targetId, node.children, [...path, node.id])
        if (result) return result
      }
    }
    return null
  }, [])

  // Авто-раскрытие и прокрутка к подсвеченному разделу
  useEffect(() => {
    if (highlightSectionId && !hasAutoExpanded && nodes.length > 0) {
      const parentIds = findNodePath(highlightSectionId, nodes)
      if (parentIds) {
        expandWithParents(highlightSectionId, parentIds)
        setHasAutoExpanded(true)
        setTimeout(() => {
          document.getElementById(`section-${highlightSectionId}`)
            ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }, 300)
      }
    }
  }, [highlightSectionId, hasAutoExpanded, nodes, findNodePath, expandWithParents])

  if (nodes.length === 0) {
    return (
      <div className={cn('flex items-center justify-center h-40', className)}>
        <p className="text-muted-foreground">Нет данных для отображения</p>
      </div>
    )
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className={cn('flex flex-col h-full bg-background', className)}>
        {/* Sticky заголовки */}
        <div
          ref={headerRef}
          className="overflow-x-hidden border-b bg-card sticky top-0 z-10"
        >
          {/* Группы колонок */}
          <div className="flex items-center min-w-max border-b">
            <div className="min-w-[400px] w-[400px] shrink-0" />

            {/* БЮДЖЕТЫ */}
            <div className="flex items-center flex-1 min-w-[430px] shrink-0 border-l border-border/30">
              <div className="w-full py-1.5 text-center">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Расчётный / Распред. / Израсх. / Выделенный
                </span>
              </div>
            </div>
          </div>

          {/* Подзаголовки */}
          <div className="flex items-center min-w-max">
            {/* Наименование */}
            <div className="min-w-[400px] w-[400px] px-2 py-1 shrink-0 flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">
                Наименование
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={expandAll}
                  className="h-5 px-1.5 text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted rounded flex items-center gap-0.5"
                >
                  <ChevronDown className="h-3 w-3" />
                  Все
                </button>
                <button
                  onClick={collapseAll}
                  className="h-5 px-1.5 text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted rounded flex items-center gap-0.5"
                >
                  <ChevronRight className="h-3 w-3" />
                  Скрыть
                </button>
              </div>
            </div>

            {/* БЮДЖЕТЫ subheaders */}
            <div className="flex items-center flex-1 min-w-[430px] shrink-0 border-l border-border/30">
              <div className="w-[80px] py-1.5 px-1 text-right">
                <span className="text-[10px] text-primary">Расчётн.</span>
              </div>
              <div className="w-[10px]" />
              <div className="w-[80px] py-1.5 px-1 text-center">
                <span className="text-[10px] text-muted-foreground">Распред.</span>
              </div>
              <div className="w-[10px]" />
              <div className="w-[80px] py-1.5 px-1 text-center">
                <span className="text-[10px] text-muted-foreground">Израсх.</span>
              </div>
              <div className="w-[10px]" />
              <div className="flex-1 py-1.5 px-1 text-left">
                <span className="text-[10px] text-primary">Выделенный (сумма / %)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Прокручиваемый контент */}
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
                onRefresh={onRefresh}
                highlightSectionId={highlightSectionId}
              />
            ))}
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}
