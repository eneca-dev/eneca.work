/**
 * Budgets Hierarchy Component
 *
 * Отображает полную иерархию проектов с бюджетами.
 * Табличный вид с группами колонок и sticky заголовками.
 * Состояние раскрытости сохраняется в localStorage.
 */

'use client'

import { useCallback, useRef } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TooltipProvider } from '@/components/ui/tooltip'
import { BudgetRow } from './BudgetRow'
import { useExpandedState } from '../hooks/use-expanded-state'
import { useWorkToWsSync } from '../hooks/use-work-to-ws-sync'
import type { HierarchyNode } from '../types'

// ============================================================================
// Types
// ============================================================================

interface BudgetsHierarchyProps {
  /** Узлы иерархии (корневые проекты) */
  nodes: HierarchyNode[]
  /** CSS класс контейнера */
  className?: string
  /** Callback для обновления данных после удаления */
  onRefresh?: () => void
}

// ============================================================================
// Main Component
// ============================================================================

export function BudgetsHierarchy({ nodes, className, onRefresh }: BudgetsHierarchyProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)

  // Состояние раскрытости с persistence в localStorage
  const {
    expanded,
    toggle: handleToggle,
    expandMultiple: handleExpandAll,
    expandMultiple: handleAutoExpand,
    expandAll,
    collapseAll,
  } = useExpandedState({ nodes })

  // Хук синхронизации с Worksection
  const { sync, status: syncStatus, syncingProjectId } = useWorkToWsSync()

  // Callback для автоматического раскрытия узла при создании дочернего элемента
  const handleAutoExpandNode = useCallback((nodeId: string) => {
    handleAutoExpand([nodeId])
  }, [handleAutoExpand])

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
      <div className={cn('flex flex-col h-full bg-background', className)}>
        {/* Column headers - sticky with horizontal scroll sync */}
        <div
          ref={headerRef}
          className="overflow-x-hidden border-b bg-card sticky top-0 z-10"
        >
          {/* Group headers row */}
          <div className="flex items-center min-w-max border-b">
            {/* Наименование + Категория */}
            <div className="min-w-[400px] w-[400px] shrink-0" />
            <div className="w-10 shrink-0" />

            {/* ТРУДОЗАТРАТЫ */}
            <div className="flex items-center shrink-0 border-l border-border/30">
              <div className="w-[196px] py-1.5 text-center">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Трудозатраты
                </span>
              </div>
            </div>

            {/* СТАВКА */}
            <div className="flex items-center shrink-0 border-l border-border/30">
              <div className="w-[72px] py-1.5 text-center">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Ставка
                </span>
              </div>
            </div>

            {/* БЮДЖЕТЫ */}
            <div className="flex items-center flex-1 min-w-[430px] shrink-0 border-l border-border/30">
              <div className="w-full py-1.5 text-center">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Расчётный / Распред. / Израсх. / Выделенный
                </span>
              </div>
            </div>
          </div>

          {/* Subheaders row */}
          <div className="flex items-center min-w-max">
            {/* Наименование + кнопки */}
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

            {/* Категория */}
            <div className="w-10 py-1.5 text-center shrink-0">
              <span className="text-[10px] text-muted-foreground">
                Кат.
              </span>
            </div>

            {/* ТРУДОЗАТРАТЫ subheaders */}
            <div className="flex items-center shrink-0 border-l border-border/30">
              <div className="w-[72px] py-1.5 px-2 text-right">
                <span className="text-[10px] text-muted-foreground">
                  План, ч
                </span>
              </div>
              <div className="w-[72px] py-1.5 px-2 text-right">
                <span className="text-[10px] text-muted-foreground">
                  С К, ч
                </span>
              </div>
              <div className="w-[52px] py-1.5 px-1 text-right">
                <span className="text-[10px] text-muted-foreground" title="% от родителя">
                  % род.
                </span>
              </div>
            </div>

            {/* СТАВКА subheaders */}
            <div className="flex items-center shrink-0 border-l border-border/30">
              <div className="w-[72px] py-1.5 px-2 text-right">
                <span className="text-[10px] text-muted-foreground">
                  BYN/ч
                </span>
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
                onRefresh={onRefresh}
                onAutoExpand={handleAutoExpandNode}
                onProjectSync={sync}
                syncStatus={syncStatus}
                syncingProjectId={syncingProjectId}
              />
            ))}
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}
