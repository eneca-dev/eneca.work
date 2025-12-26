/**
 * Budgets View Internal Component
 *
 * Главный компонент модуля - отображает иерархию с бюджетами.
 * Используется внутри TasksView как одна из вкладок.
 */

'use client'

import { Loader2 } from 'lucide-react'
import { BudgetsHierarchy } from './BudgetsHierarchy'
import { useBudgetsHierarchy } from '../hooks'
import { formatAmount } from '../utils'
import type { BudgetsViewInternalProps } from '../types'

// ============================================================================
// Loading Skeleton
// ============================================================================

function LoadingSkeleton() {
  return (
    <div className="flex-1 overflow-auto">
      <div className="p-4 space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-2">
            <div className="h-10 bg-muted/50 rounded animate-pulse" />
            <div className="ml-6 h-10 bg-muted/30 rounded animate-pulse" />
            <div className="ml-12 h-10 bg-muted/20 rounded animate-pulse" />
            <div className="ml-16 space-y-1">
              <div className="h-8 bg-muted/10 rounded animate-pulse" />
              <div className="h-8 bg-muted/10 rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ============================================================================
// Analytics Skeleton (TODO: Этап 5)
// ============================================================================

function AnalyticsSkeleton() {
  return (
    <div className="shrink-0 border-t bg-card px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="h-4 w-32 bg-muted/50 rounded animate-pulse" />
          <div className="h-4 w-32 bg-muted/50 rounded animate-pulse" />
          <div className="h-4 w-32 bg-muted/50 rounded animate-pulse" />
        </div>
        <div className="flex items-center gap-6">
          <div className="h-4 w-24 bg-muted/50 rounded animate-pulse" />
          <div className="h-4 w-24 bg-muted/50 rounded animate-pulse" />
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// Simple Analytics Panel (temporary until Stage 5)
// ============================================================================

interface SimpleAnalyticsProps {
  totalPlanned: number
  totalSpent: number
  projectsCount: number
  budgetsCount: number
}

function SimpleAnalytics({ totalPlanned, totalSpent, projectsCount, budgetsCount }: SimpleAnalyticsProps) {
  const percentage = totalPlanned > 0 ? Math.round((totalSpent / totalPlanned) * 100) : 0

  return (
    <div className="shrink-0 border-t bg-card px-4 py-3">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-6">
          <div>
            <span className="text-muted-foreground">Проекты: </span>
            <span className="font-medium">{projectsCount}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Бюджетов: </span>
            <span className="font-medium">{budgetsCount}</span>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div>
            <span className="text-muted-foreground">План: </span>
            <span className="font-medium">{formatAmount(totalPlanned)} BYN</span>
          </div>
          <div>
            <span className="text-muted-foreground">Факт: </span>
            <span className="font-medium">{formatAmount(totalSpent)} BYN</span>
          </div>
          <div>
            <span className="text-muted-foreground">Освоено: </span>
            <span className={percentage > 100 ? 'text-destructive font-medium' : 'font-medium'}>
              {percentage}%
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// Main Component
// ============================================================================

export function BudgetsViewInternal({
  queryParams,
}: BudgetsViewInternalProps) {
  const { nodes, analytics, isLoading, error } = useBudgetsHierarchy(queryParams)

  // Error state
  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-destructive font-medium">Ошибка загрузки данных</p>
          <p className="text-sm text-muted-foreground">{error.message}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Loading overlay (for initial load only) */}
      {isLoading && nodes.length === 0 ? (
        <>
          {/* Header placeholder */}
          <div className="shrink-0 flex items-center justify-center py-2 border-b bg-muted/20">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Загрузка иерархии...</span>
            </div>
          </div>

          <LoadingSkeleton />
          <AnalyticsSkeleton />
        </>
      ) : (
        <>
          {/* Hierarchy content */}
          <BudgetsHierarchy nodes={nodes} className="flex-1 min-h-0" />

          {/* Analytics panel */}
          <SimpleAnalytics
            totalPlanned={analytics.totalPlanned}
            totalSpent={analytics.totalSpent}
            projectsCount={analytics.projectsCount}
            budgetsCount={analytics.budgetsCount}
          />
        </>
      )}
    </div>
  )
}
