/**
 * Budget Row Component
 *
 * Строка иерархии с информацией о бюджетах.
 * Поддерживает разворачивание/сворачивание дочерних элементов.
 */

'use client'

import { ChevronRight, FolderKanban, Layers, Box, FileText, ListTree } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BudgetBars } from './BudgetBars'
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

const NODE_ICONS: Record<HierarchyNodeType, typeof FolderKanban> = {
  project: FolderKanban,
  stage: Layers,
  object: Box,
  section: FileText,
  decomposition_stage: ListTree,
}

const NODE_COLORS: Record<HierarchyNodeType, string> = {
  project: 'text-amber-500',
  stage: 'text-blue-500',
  object: 'text-violet-500',
  section: 'text-emerald-500',
  decomposition_stage: 'text-cyan-500',
}

// Отступы для уровней вложенности
const INDENT_PX = 20

// ============================================================================
// Main Component
// ============================================================================

export function BudgetRow({ node, level, expanded, onToggle }: BudgetRowProps) {
  const hasChildren = node.children.length > 0
  const isExpanded = expanded[node.id] ?? false
  const Icon = NODE_ICONS[node.type]
  const iconColor = NODE_COLORS[node.type]

  return (
    <>
      {/* Main row */}
      <div
        className={cn(
          'flex items-center gap-3 px-3 py-2 border-b border-border/50',
          'hover:bg-muted/30 transition-colors',
          level === 0 && 'bg-muted/20'
        )}
        style={{ paddingLeft: `${12 + level * INDENT_PX}px` }}
      >
        {/* Expand/collapse button */}
        <button
          onClick={() => hasChildren && onToggle(node.id)}
          className={cn(
            'w-5 h-5 flex items-center justify-center rounded transition-colors',
            hasChildren
              ? 'hover:bg-muted cursor-pointer'
              : 'cursor-default opacity-0'
          )}
          disabled={!hasChildren}
        >
          {hasChildren && (
            <ChevronRight
              className={cn(
                'h-4 w-4 text-muted-foreground transition-transform duration-200',
                isExpanded && 'rotate-90'
              )}
            />
          )}
        </button>

        {/* Icon */}
        <Icon className={cn('h-4 w-4 shrink-0', iconColor)} />

        {/* Name */}
        <span
          className={cn(
            'flex-1 truncate text-sm',
            level === 0 ? 'font-medium' : 'text-muted-foreground'
          )}
          title={node.name}
        >
          {node.name}
        </span>

        {/* Planned hours (if available) */}
        {node.plannedHours !== undefined && node.plannedHours > 0 && (
          <span className="text-xs text-muted-foreground tabular-nums shrink-0 w-16 text-right">
            {node.plannedHours.toLocaleString('ru-RU')} ч
          </span>
        )}

        {/* Budget bars */}
        <div className="w-48 shrink-0">
          <BudgetBars budgets={node.aggregatedBudgets} compact />
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
