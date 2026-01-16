/**
 * Budgets View Internal Component
 *
 * Главный компонент модуля - отображает иерархию с бюджетами.
 * Используется внутри TasksView как одна из вкладок.
 */

'use client'

import { Loader2, Wallet, TrendingUp, FolderKanban, BarChart3 } from 'lucide-react'
import { BudgetsHierarchy } from './BudgetsHierarchy'
import { useBudgetsHierarchy } from '../hooks'
import { formatAmount } from '../utils'
import type { BudgetsViewInternalProps } from '../types'
import { cn } from '@/lib/utils'

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
// Analytics Skeleton
// ============================================================================

function AnalyticsSkeleton() {
  return (
    <div className="shrink-0 border-b bg-card px-4 py-2.5">
      <div className="flex items-center gap-6">
        <div className="h-4 w-24 bg-muted/50 rounded animate-pulse" />
        <div className="h-4 w-24 bg-muted/50 rounded animate-pulse" />
        <div className="flex-1" />
        <div className="h-4 w-28 bg-muted/50 rounded animate-pulse" />
        <div className="h-4 w-28 bg-muted/50 rounded animate-pulse" />
        <div className="h-4 w-20 bg-muted/50 rounded animate-pulse" />
      </div>
    </div>
  )
}

// ============================================================================
// Analytics Panel (top position)
// ============================================================================

interface AnalyticsPanelProps {
  totalPlanned: number
  totalSpent: number
  projectsCount: number
  budgetsCount: number
}

function AnalyticsPanel({ totalPlanned, totalSpent, projectsCount, budgetsCount }: AnalyticsPanelProps) {
  const percentage = totalPlanned > 0 ? Math.round((totalSpent / totalPlanned) * 100) : 0
  const isOverBudget = percentage > 100

  return (
    <div className="shrink-0 border-b bg-muted/20 px-4 py-2">
      <div className="flex items-center gap-4 text-xs">
        {/* Stats */}
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <FolderKanban className="h-3.5 w-3.5" />
          <span>{projectsCount}</span>
          <span className="text-muted-foreground/50">проекта</span>
        </div>

        <div className="w-px h-4 bg-border" />

        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Wallet className="h-3.5 w-3.5" />
          <span>{budgetsCount}</span>
          <span className="text-muted-foreground/50">бюджетов</span>
        </div>

        <div className="flex-1" />

        {/* Totals */}
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">План:</span>
          <span className="font-medium tabular-nums">{formatAmount(totalPlanned)} BYN</span>
        </div>

        <div className="w-px h-4 bg-border" />

        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">Факт:</span>
          <span className="font-medium tabular-nums">{formatAmount(totalSpent)} BYN</span>
        </div>

        <div className="w-px h-4 bg-border" />

        <div className="flex items-center gap-1.5">
          <TrendingUp className={cn(
            'h-3.5 w-3.5',
            isOverBudget ? 'text-destructive' : 'text-muted-foreground'
          )} />
          <span className={cn(
            'font-medium tabular-nums',
            isOverBudget && 'text-destructive'
          )}>
            {percentage}%
          </span>
          <span className="text-muted-foreground/50">освоено</span>
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
  const { nodes, analytics, isLoading, error, refetch } = useBudgetsHierarchy(queryParams)

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
          <AnalyticsSkeleton />
          <LoadingSkeleton />
        </>
      ) : (
        <>
          {/* Analytics panel - TOP */}
          <AnalyticsPanel
            totalPlanned={analytics.totalPlanned}
            totalSpent={analytics.totalSpent}
            projectsCount={analytics.projectsCount}
            budgetsCount={analytics.budgetsCount}
          />

          {/* Hierarchy content */}
          <BudgetsHierarchy nodes={nodes} className="flex-1 min-h-0" onRefresh={refetch} />
        </>
      )}
    </div>
  )
}
