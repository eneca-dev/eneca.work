/**
 * Budgets Hierarchy Component
 *
 * Отображает иерархию проектов с бюджетами.
 * Колонки: Наименование / Расчётный / Распред. / Израсх. / Выделенный.
 * Состояние раскрытости сохраняется в localStorage.
 *
 * Виртуализация (bug-VT-15): дерево «расплющивается» в плоский список видимых строк и
 * рендерится через общий VirtualList — в DOM только видимые строки (+overscan), а не все ~37k узлов.
 * Ленивые этапы/задачи (SectionLazyChildren) и HR-блок (DepartmentBlock) остаются escape-hatch
 * строками (десятки/~8 строк внутри одного измеряемого элемента) — запросы и логика 1:1 как были.
 */

'use client'

import { useCallback, useRef, useEffect, useState, useMemo } from 'react'
import type { UIEvent } from 'react'
import { cn } from '@/lib/utils'
import { TooltipProvider } from '@/components/ui/tooltip'
import { BudgetRowContent, SectionLazyChildren, sumAllocatedBudget } from './BudgetRow'
import { DepartmentBlock } from './DepartmentBlock'
import { VirtualList, type VirtualListHandle } from '@/modules/shared/virtualized-tree'
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

/** Плоская строка для виртуализатора. */
type FlatRow =
  | { kind: 'row'; key: string; node: HierarchyNode; insideSection: boolean }
  | { kind: 'lazy'; key: string; node: HierarchyNode }
  | { kind: 'hr'; key: string; node: HierarchyNode }

/** Минимальная ширина строки = «Наименование» (400) + блок бюджетов (480). Совпадает со sticky-шапкой. */
const ROW_MIN_WIDTH = 880

// ============================================================================
// Flatten
// ============================================================================

/**
 * Разворачивает дерево (проект→объект→раздел) в плоский список ВИДИМЫХ строк по состоянию
 * раскрытия. Порядок 1:1 с прежним рекурсивным рендером BudgetRow:
 * строка → дети (или ленивый раздел) → HR-блок (для проектов).
 */
function flattenBudgetTree(nodes: HierarchyNode[], isExpanded: (id: string) => boolean): FlatRow[] {
  const out: FlatRow[] = []
  const walk = (list: HierarchyNode[], insideSection: boolean) => {
    for (const node of list) {
      out.push({ kind: 'row', key: node.id, node, insideSection })
      if (!isExpanded(node.id)) continue

      if (node.type === 'section' && node.hasLazyChildren) {
        // Этапы/задачи — escape-hatch (ленивая загрузка как была)
        out.push({ kind: 'lazy', key: `lazy:${node.id}`, node })
      } else {
        walk(node.children, node.type === 'section' || insideSection)
      }

      if (node.type === 'project') {
        // HR-блок после детей проекта (как в прежнем BudgetRow)
        out.push({ kind: 'hr', key: `hr:${node.id}`, node })
      }
    }
  }
  walk(nodes, false)
  return out
}

// ============================================================================
// Main Component
// ============================================================================

export function BudgetsHierarchy({ nodes, className, highlightSectionId }: BudgetsHierarchyProps) {
  const listRef = useRef<VirtualListHandle>(null)
  const headerRef = useRef<HTMLDivElement>(null)
  const [hasAutoExpanded, setHasAutoExpanded] = useState(false)
  // К какому highlightSectionId уже проскроллили — чтобы скроллить ОДИН раз,
  // а не на каждый toggle (flatRows меняется при любом раскрытии).
  const scrolledForRef = useRef<string | null>(null)

  // Раскрытие живёт в UI-сторе; flatten читает его, строки подписываются на свой узел сами.
  const expandWithParents = useBudgetsPageUIStore((s) => s.expandWithParents)
  const seedIfEmpty = useBudgetsPageUIStore((s) => s.seedIfEmpty)
  const expanded = useBudgetsPageUIStore((s) => s.expanded)

  // Дефолт: раскрываем проекты верхнего уровня (только если состояние пустое).
  useEffect(() => {
    if (nodes.length > 0) seedIfEmpty(nodes.map((n) => n.id))
  }, [nodes, seedIfEmpty])

  // Плоский список видимых строк — пересчитывается при изменении дерева или раскрытия.
  const flatRows = useMemo(
    () => flattenBudgetTree(nodes, (id) => expanded[id] ?? false),
    [nodes, expanded]
  )

  // Синхронизация горизонтального скролла тела со sticky-шапкой
  const handleScroll = useCallback((e: UIEvent<HTMLDivElement>) => {
    if (headerRef.current) headerRef.current.scrollLeft = e.currentTarget.scrollLeft
  }, [])

  // Поиск узла и его родителей в дереве
  const findNodePath = useCallback(
    (targetId: string, currentNodes: HierarchyNode[], path: string[] = []): string[] | null => {
      for (const node of currentNodes) {
        if (node.id === targetId) return path
        if (node.children && node.children.length > 0) {
          const result = findNodePath(targetId, node.children, [...path, node.id])
          if (result) return result
        }
      }
      return null
    },
    []
  )

  // Авто-раскрытие пути до подсвеченного раздела
  useEffect(() => {
    if (highlightSectionId && !hasAutoExpanded && nodes.length > 0) {
      const parentIds = findNodePath(highlightSectionId, nodes)
      if (parentIds) {
        expandWithParents(highlightSectionId, parentIds)
        setHasAutoExpanded(true)
      }
    }
  }, [highlightSectionId, hasAutoExpanded, nodes, findNodePath, expandWithParents])

  // Прокрутка к подсвеченному разделу — scrollToIndex (scrollIntoView не работает на
  // не-смонтированных виртуализированных строках). Один раз на каждый highlightSectionId:
  // как только раздел появился в flatRows, скроллим и больше не дёргаем при toggle.
  useEffect(() => {
    if (!highlightSectionId) {
      scrolledForRef.current = null
      return
    }
    if (scrolledForRef.current === highlightSectionId) return
    const idx = flatRows.findIndex((r) => r.kind === 'row' && r.node.id === highlightSectionId)
    if (idx < 0) return
    scrolledForRef.current = highlightSectionId
    const t = window.setTimeout(() => listRef.current?.scrollToIndex(idx, { align: 'center' }), 50)
    return () => window.clearTimeout(t)
  }, [highlightSectionId, flatRows])

  const renderItem = useCallback(
    (row: FlatRow) => {
      if (row.kind === 'row') {
        return (
          <BudgetRowContent
            node={row.node}
            insideSection={row.insideSection}
            highlightSectionId={highlightSectionId}
          />
        )
      }
      if (row.kind === 'lazy') {
        return <SectionLazyChildren sectionId={row.node.id} highlightSectionId={highlightSectionId} />
      }
      return (
        <DepartmentBlock
          projectId={row.node.id}
          projectAllocatedBudget={sumAllocatedBudget(row.node)}
        />
      )
    },
    [highlightSectionId]
  )

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

        {/* Прокручиваемый виртуализированный контент */}
        <VirtualList
          ref={listRef}
          items={flatRows}
          getKey={(r) => r.key}
          renderItem={renderItem}
          estimateSize={33}
          overscan={10}
          minContentWidth={ROW_MIN_WIDTH}
          className="flex-1"
          onScroll={handleScroll}
        />
      </div>
    </TooltipProvider>
  )
}
