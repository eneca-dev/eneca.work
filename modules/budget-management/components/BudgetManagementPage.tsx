/**
 * Budget Management Page Component
 *
 * Страница управления бюджетами с тремя режимами:
 * - Обзор всех бюджетов (таблица + карта)
 * - Иерархия бюджетов (по проектам/стадиям/объектам/разделам)
 * - Таблица трудозатрат (декомпозиция)
 */

'use client'

import { useState } from 'react'
import { BarChart3, FolderTree, Table2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BudgetOverview } from './BudgetOverview'
import { BudgetHierarchy } from './BudgetHierarchy'
import { BudgetTable } from './BudgetTable'

// ============================================================================
// Types
// ============================================================================

type ViewMode = 'overview' | 'hierarchy' | 'decomposition'

// ============================================================================
// Main Component
// ============================================================================

export function BudgetManagementPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('overview')

  return (
    <div className="h-full flex flex-col bg-zinc-950">
      {/* Tab Bar */}
      <div className="shrink-0 flex items-center gap-1 px-4 py-2 border-b border-white/10 bg-zinc-900/80">
        <button
          onClick={() => setViewMode('overview')}
          className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium transition-colors',
            viewMode === 'overview'
              ? 'bg-primary/20 text-primary'
              : 'text-white/50 hover:text-white/70 hover:bg-white/5'
          )}
        >
          <BarChart3 size={14} />
          Обзор бюджетов
        </button>
        <button
          onClick={() => setViewMode('hierarchy')}
          className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium transition-colors',
            viewMode === 'hierarchy'
              ? 'bg-primary/20 text-primary'
              : 'text-white/50 hover:text-white/70 hover:bg-white/5'
          )}
        >
          <FolderTree size={14} />
          По иерархии
        </button>
        <button
          onClick={() => setViewMode('decomposition')}
          className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium transition-colors',
            viewMode === 'decomposition'
              ? 'bg-primary/20 text-primary'
              : 'text-white/50 hover:text-white/70 hover:bg-white/5'
          )}
        >
          <Table2 size={14} />
          Декомпозиция
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0">
        {viewMode === 'overview' && <BudgetOverview />}
        {viewMode === 'hierarchy' && <BudgetHierarchy />}
        {viewMode === 'decomposition' && <BudgetTable />}
      </div>
    </div>
  )
}

export default BudgetManagementPage
