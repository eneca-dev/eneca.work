/**
 * Budgets Hierarchy Component
 *
 * Отображает иерархию проектов с бюджетами.
 * Колонки: Наименование / Расчётный / Распред. / Израсх. / Выделенный.
 * Состояние раскрытости сохраняется в localStorage.
 */

'use client'

import { useCallback, useRef, useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { TooltipProvider } from '@/components/ui/tooltip'
import { BudgetRow } from './BudgetRow'
import { useBudgetsPageUIStore } from '../stores/useBudgetsPageUIStore'
import type { HierarchyNode } from '../types'

// ============================================================================
// Types
// ============================================================================

interface BudgetsHierarchyProps {
  nodes: HierarchyNode[]
  className?: string
  highlightSectionId?: string | null
}

// ============================================================================
// Main Component
// ============================================================================

export function BudgetsHierarchy({ nodes, className, highlightSectionId }: BudgetsHierarchyProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)
  const [hasAutoExpanded, setHasAutoExpanded] = useState(false)

  // Раскрытие живёт в UI-сторе; строки подписываются на свой узел сами
  // (useBudgetRowExpanded). Здесь нужны только операции для авто-перехода и сидинга.
  const expandWithParents = useBudgetsPageUIStore((s) => s.expandWithParents)
  const seedIfEmpty = useBudgetsPageUIStore((s) => s.seedIfEmpty)

  // Дефолт: раскрываем проекты верхнего уровня (только если состояние пустое) —
  // поведение как было в useExpandedState.
  useEffect(() => {
    if (nodes.length > 0) seedIfEmpty(nodes.map((n) => n.id))
  }, [nodes, seedIfEmpty])

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
          {/* Подзаголовки */}
          <div className="flex items-center min-w-max">
            {/* Наименование */}
            {/* Кнопки «Развернуть всё / Свернуть всё» скрыты — как на вкладках
                «Отделы»/«Разделы». Массовое раскрытие монтирует тысячи строк за раз
                и подвешивает UI (bug-VT-15); узлы раскрываются по мере надобности. */}
            <div className="min-w-[400px] w-[400px] px-2 py-1 shrink-0 flex items-center">
              <span className="text-[10px] text-muted-foreground">
                Наименование
              </span>
            </div>

            {/* БЮДЖЕТЫ subheaders */}
            <div className="flex items-center flex-1 min-w-[480px] shrink-0 border-l border-border/30">
              <div className="w-[80px] py-1.5 px-1 text-right">
                <span className="text-[10px] text-primary">Расчётн.</span>
              </div>
              <div className="w-[10px]" />
              <div className="w-[80px] py-1.5 px-1 text-center">
                <span className="text-[10px] text-muted-foreground">Распред.</span>
              </div>
              <div className="w-[10px]" />
              <div className="w-[140px] shrink-0 py-1.5 px-1 text-left">
                <span className="text-[10px] text-primary">Выделенный (сумма / %)</span>
              </div>
              <div className="w-[10px]" />
              <div className="w-[140px] shrink-0 py-1.5 px-1 text-left">
                <span className="text-[10px] text-muted-foreground">Отклонение</span>
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
                highlightSectionId={highlightSectionId}
              />
            ))}
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}
