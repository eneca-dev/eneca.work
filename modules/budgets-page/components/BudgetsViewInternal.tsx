'use client'

import { useSearchParams } from 'next/navigation'
import { useMemo, useCallback } from 'react'
import { Database, Lock } from 'lucide-react'
import { BudgetsHierarchy } from './BudgetsHierarchy'
import { useBudgetsHierarchy } from '../hooks'
import { useHasPermission } from '@/modules/permissions'
import type { BudgetsViewInternalProps } from '../types'

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

export function BudgetsViewInternal({ queryParams, loadAllEnabled = false, onLoadAll }: BudgetsViewInternalProps) {
  const canView = useHasPermission('budgets.view.all')
  const searchParams = useSearchParams()

  if (!canView) {
    return (
      <div className="flex items-center justify-center h-full bg-background">
        <div className="text-center">
          <Lock className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
          <p className="text-sm font-medium text-muted-foreground">Нет доступа к бюджетам</p>
        </div>
      </div>
    )
  }

  const filtersApplied = useMemo(
    () => Object.keys(queryParams).length > 0,
    [queryParams]
  )

  const shouldFetchData = filtersApplied || loadAllEnabled

  const handleLoadAll = useCallback(() => onLoadAll?.(), [onLoadAll])

  const { nodes, isLoading, error } = useBudgetsHierarchy(
    filtersApplied ? queryParams : undefined,
    { enabled: shouldFetchData }
  )

  if (!shouldFetchData) {
    return (
      <div className="flex items-center justify-center h-full bg-background">
        <div className="text-center max-w-md">
          <Database className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" />
          <h2 className="text-lg font-medium mb-2">
            Выберите данные для отображения
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Используйте фильтр выше для поиска проектов с бюджетами.
          </p>
          <p className="text-xs text-muted-foreground mb-6 font-mono bg-muted/50 px-3 py-2 rounded">
            отдел:"ОВ" проект:"Название"
          </p>
          <button
            onClick={handleLoadAll}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Database size={16} />
            Загрузить всё
          </button>
        </div>
      </div>
    )
  }

  const sectionId = searchParams.get('sectionId')
  const highlightSectionId = searchParams.get('highlight') === 'true' && sectionId ? sectionId : null

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
      {isLoading && nodes.length === 0 ? (
        <LoadingSkeleton />
      ) : (
        <BudgetsHierarchy
          nodes={nodes}
          className="flex-1 min-h-0"
          highlightSectionId={highlightSectionId}
        />
      )}
    </div>
  )
}
