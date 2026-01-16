/**
 * Budget Row Expander Component
 *
 * Иконка expand/collapse с отступом для узла иерархии.
 */

'use client'

import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BudgetRowExpanderProps {
  /** Отступ слева (px) */
  indent: number
  /** Есть ли дочерние узлы */
  hasChildren: boolean
  /** Развёрнут ли узел */
  isExpanded: boolean
  /** Callback для toggle */
  onToggle: () => void
}

export function BudgetRowExpander({
  indent,
  hasChildren,
  isExpanded,
  onToggle,
}: BudgetRowExpanderProps) {
  return (
    <button
      onClick={onToggle}
      className={cn(
        'w-4 h-4 flex items-center justify-center rounded transition-colors shrink-0',
        hasChildren ? 'hover:bg-slate-700 cursor-pointer' : 'opacity-0'
      )}
      disabled={!hasChildren}
    >
      {hasChildren && (
        <ChevronRight
          className={cn(
            'h-3 w-3 text-slate-500 transition-transform duration-200',
            isExpanded && 'rotate-90'
          )}
        />
      )}
    </button>
  )
}
