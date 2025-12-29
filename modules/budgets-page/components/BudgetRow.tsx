/**
 * Budget Row Component
 *
 * Строка иерархии с информацией о бюджетах.
 * Excel-style: плоская структура без отступов, с текстовыми метками типов.
 */

'use client'

import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BudgetCell } from './BudgetCell'
import type { HierarchyNode, HierarchyNodeType, ExpandedState } from '../types'

// ============================================================================
// Types
// ============================================================================

interface BudgetRowProps {
  /** Узел иерархии */
  node: HierarchyNode
  /** Уровень вложенности (0 = корень) */
  level: number
  /** Развёрнутые узлы */
  expanded: ExpandedState
  /** Callback для toggle узла */
  onToggle: (nodeId: string) => void
}

// ============================================================================
// Helpers
// ============================================================================

/** Текстовые метки для типов узлов */
const NODE_LABELS: Record<HierarchyNodeType, string> = {
  project: 'Проект',
  stage: 'Стадия',
  object: 'Объект',
  section: 'Раздел',
  decomposition_stage: 'Этап',
}

/** Цвета фона для меток */
const NODE_LABEL_COLORS: Record<HierarchyNodeType, string> = {
  project: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  stage: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  object: 'bg-violet-500/15 text-violet-600 dark:text-violet-400',
  section: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  decomposition_stage: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400',
}

/** Фон строки по уровню */
const ROW_BG: Record<number, string> = {
  0: 'bg-muted/30',
  1: 'bg-muted/20',
  2: 'bg-muted/10',
  3: '',
  4: '',
}

/**
 * Вычисляет процент распределённого бюджета среди детей
 */
function calculateDistributedPercentage(node: HierarchyNode): number | null {
  if (node.children.length === 0) return null

  // Собираем общий planned_amount узла
  const nodePlanned = node.budgets.reduce((sum, b) => sum + b.planned_amount, 0)
  if (nodePlanned <= 0) return null

  // Собираем сумму planned_amount всех детей (только их собственные бюджеты, не агрегированные)
  const childrenPlanned = node.children.reduce((sum, child) => {
    return sum + child.budgets.reduce((s, b) => s + b.planned_amount, 0)
  }, 0)

  return Math.round((childrenPlanned / nodePlanned) * 100)
}

// ============================================================================
// Main Component
// ============================================================================

export function BudgetRow({ node, level, expanded, onToggle }: BudgetRowProps) {
  const hasChildren = node.children.length > 0
  const isExpanded = expanded[node.id] ?? false
  const label = NODE_LABELS[node.type]
  const labelColor = NODE_LABEL_COLORS[node.type]
  const rowBg = ROW_BG[level] || ''
  const distributedPct = calculateDistributedPercentage(node)

  return (
    <>
      {/* Main row */}
      <div
        className={cn(
          'group flex items-center gap-2 px-3 py-1.5 border-b border-border/50',
          'hover:bg-muted/40 transition-colors',
          rowBg
        )}
      >
        {/* Expand/collapse button */}
        <button
          onClick={() => hasChildren && onToggle(node.id)}
          className={cn(
            'w-5 h-5 flex items-center justify-center rounded transition-colors shrink-0',
            hasChildren
              ? 'hover:bg-muted cursor-pointer'
              : 'cursor-default opacity-0'
          )}
          disabled={!hasChildren}
        >
          {hasChildren && (
            <ChevronRight
              className={cn(
                'h-3.5 w-3.5 text-muted-foreground transition-transform duration-200',
                isExpanded && 'rotate-90'
              )}
            />
          )}
        </button>

        {/* Type label */}
        <span
          className={cn(
            'shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium w-14 text-center',
            labelColor
          )}
        >
          {label}
        </span>

        {/* Name */}
        <span
          className={cn(
            'flex-1 truncate text-sm',
            level === 0 ? 'font-medium' : ''
          )}
          title={node.name}
        >
          {node.name}
        </span>

        {/* Distributed percentage (how much of parent is distributed to children) */}
        <div className="w-20 shrink-0 text-center">
          {distributedPct !== null && (
            <span
              className={cn(
                'inline-block text-[10px] tabular-nums px-1.5 py-0.5 rounded',
                distributedPct >= 100
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                  : distributedPct >= 50
                    ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                    : 'bg-red-500/15 text-red-600 dark:text-red-400'
              )}
              title="Процент бюджета, распределённый дочерним элементам"
            >
              {distributedPct}%
            </span>
          )}
        </div>

        {/* Planned hours */}
        <div className="w-14 shrink-0 text-right">
          {node.plannedHours !== undefined && node.plannedHours > 0 && (
            <span className="text-[10px] text-muted-foreground tabular-nums">
              {node.plannedHours.toLocaleString('ru-RU')} ч
            </span>
          )}
        </div>

        {/* Budget cell with edit/create */}
        <div className="w-56 shrink-0">
          <BudgetCell
            budgets={node.budgets}
            entityType={node.entityType}
            entityId={node.id}
            entityName={node.name}
            compact
          />
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
          />
        ))}
    </>
  )
}
