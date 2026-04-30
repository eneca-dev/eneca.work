/**
 * Budget Row Component
 *
 * Строка иерархии с информацией о бюджетах.
 * Показывает: Расчётный / Распределено / Израсходовано / Выделенный.
 * Создание и удаление структуры скрыты — только редактирование бюджета.
 */

'use client'

import React from 'react'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { BudgetInlineEdit } from './BudgetInlineEdit'
import { BudgetRowExpander } from './BudgetRowExpander'
import { BudgetRowBadges } from './BudgetRowBadges'
import { formatNumber } from '../utils'
import type { HierarchyNode, HierarchyNodeType, ExpandedState } from '../types'

// ============================================================================
// Types
// ============================================================================

interface BudgetRowProps {
  node: HierarchyNode
  level: number
  expanded: ExpandedState
  onToggle: (nodeId: string) => void
  onExpandAll?: (nodeIds: string[]) => void
  insideSection?: boolean
  parentAllocatedBudget?: number
  highlightSectionId?: string | null
}

// ============================================================================
// Helpers
// ============================================================================

function collectChildIds(node: HierarchyNode): string[] {
  const ids: string[] = []
  for (const child of node.children) {
    ids.push(child.id)
    ids.push(...collectChildIds(child))
  }
  return ids
}

// ============================================================================
// Main Component
// ============================================================================

export const BudgetRow = React.memo(function BudgetRow({
  node,
  level,
  expanded,
  onToggle,
  onExpandAll,
  insideSection = false,
  parentAllocatedBudget = 0,
  highlightSectionId,
}: BudgetRowProps) {
  const hasChildren = node.children.length > 0
  const isExpanded = expanded[node.id] ?? false

  const isSection = node.type === 'section'
  const isDecompStage = node.type === 'decomposition_stage'
  const isItem = node.type === 'decomposition_item'
  const isTopLevel = node.type === 'project' || node.type === 'object'
  const isProject = node.type === 'project'
  const isObject = node.type === 'object'

  // Расчётный бюджет из loadings × ставка отдела
  const calcBudget = node.calcBudgetFromLoadings && node.calcBudgetFromLoadings > 0
    ? node.calcBudgetFromLoadings
    : null
  const loadingHours = node.loadingHours ?? 0
  const loadingCount = node.loadingCount ?? 0
  const loadingErrorsCount = node.loadingErrorsCount ?? 0

  // Выделенный бюджет
  const allocatedBudget = node.budgets.reduce((sum, b) => sum + b.planned_amount, 0)

  // Распределено (сумма выделенных бюджетов прямых детей)
  const distributedBudget = node.children.length > 0
    ? node.children.reduce((sum, child) => sum + child.budgets.reduce((s, b) => s + b.planned_amount, 0), 0)
    : allocatedBudget

  const isOverBudget = calcBudget !== null && allocatedBudget < calcBudget
  const isOverDistributed = distributedBudget > allocatedBudget

  const INDENT_MAP: Record<HierarchyNodeType, number> = {
    project: 0,
    object: 16,
    section: 32,
    decomposition_stage: 48,
    decomposition_item: 64,
  }
  const indent = INDENT_MAP[node.type]

  const isHighlighted = isSection && highlightSectionId === node.id

  const rowStyles = cn(
    'group flex items-center border-b transition-colors',
    isProject && 'bg-muted/40 hover:bg-muted/60',
    isObject && 'bg-muted/40 hover:bg-muted/60',
    isSection && 'bg-muted/35 hover:bg-muted/55',
    isHighlighted && 'ring-1 ring-inset ring-primary/40',
    isDecompStage && insideSection && 'bg-background hover:bg-muted/30',
    isItem && insideSection && 'bg-background hover:bg-muted/30',
    'min-h-[32px]'
  )

  const handleToggle = () => {
    if (!hasChildren) return
    if (isSection && !isExpanded && onExpandAll) {
      const allChildIds = collectChildIds(node)
      onExpandAll([node.id, ...allChildIds])
    } else {
      onToggle(node.id)
    }
  }

  return (
    <>
      {/* Main row */}
      <div
        id={isSection ? `section-${node.id}` : undefined}
        className={rowStyles}
      >
        {/* ===== НАИМЕНОВАНИЕ ===== */}
        <div
          className="flex items-center gap-2 min-w-[400px] w-[400px] px-2 shrink-0"
          style={{ paddingLeft: `${8 + indent}px` }}
        >
          <BudgetRowExpander
            indent={indent}
            hasChildren={hasChildren}
            isExpanded={isExpanded}
            onToggle={handleToggle}
          />

          <BudgetRowBadges
            nodeType={node.type}
            stageName={node.stageName}
          />

          <span
            className={cn(
              'truncate text-[12px]',
              isSection && 'font-medium text-foreground',
              isDecompStage && 'text-foreground/80',
              isItem && 'text-muted-foreground',
              isTopLevel && 'font-medium text-foreground'
            )}
            title={node.stageName ? `${node.stageName}: ${node.name}` : node.name}
          >
            {node.name}
          </span>
        </div>

        {/* ===== БЮДЖЕТЫ: Расчётный / Распределено / Выделенный ===== */}
        <div className="flex items-center flex-1 min-w-[340px] shrink-0 border-l border-border/30">
          <div className="w-full flex items-center">
            {/* Расчётный */}
            <div className="w-[80px] px-1 text-right">
              {calcBudget !== null && calcBudget > 0 ? (
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className={cn(
                        'text-[12px] tabular-nums text-primary cursor-help',
                        (isSection || isTopLevel) && 'font-medium',
                        loadingErrorsCount > 0 && 'underline decoration-dotted decoration-amber-500'
                      )}>
                        {formatNumber(calcBudget)}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">
                      <div className="space-y-0.5">
                        <div>{formatNumber(loadingHours)} ч / {loadingCount} загрузок</div>
                        {loadingErrorsCount > 0 && (
                          <div className="text-amber-500">
                            ⚠ {loadingErrorsCount} без отдела или ставки
                          </div>
                        )}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                <span className="text-[12px] text-muted-foreground/50 tabular-nums">—</span>
              )}
            </div>
            <div className="w-[10px] text-center">
              <span className="text-[11px] text-muted-foreground/30">/</span>
            </div>
            {/* Распределено */}
            <div className="w-[80px] px-1 text-center">
              {distributedBudget > 0 ? (
                <span className={cn(
                  'text-[12px] tabular-nums',
                  isOverDistributed ? 'text-destructive' : 'text-foreground/80',
                  (isSection || isTopLevel) && 'font-medium'
                )}>
                  {formatNumber(distributedBudget)}
                </span>
              ) : (
                <span className="text-[12px] text-muted-foreground/50 tabular-nums">—</span>
              )}
            </div>
            <div className="w-[10px] text-center">
              <span className="text-[11px] text-muted-foreground/30">/</span>
            </div>
            {/* Выделенный - inline редактирование */}
            <div className="flex-1 px-1">
              <BudgetInlineEdit
                budgets={node.budgets}
                entityType={node.entityType}
                entityId={node.id}
                entityName={node.name}
                isOverBudget={isOverBudget}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Children (if expanded) */}
      {isExpanded &&
        node.children.map((child) => (
          <BudgetRow
            key={child.id}
            node={child}
            level={level + 1}
            expanded={expanded}
            onToggle={onToggle}
            onExpandAll={onExpandAll}
            insideSection={isSection || insideSection}
            parentAllocatedBudget={allocatedBudget}
            highlightSectionId={highlightSectionId}
          />
        ))}
    </>
  )
})
