/**
 * BudgetsDataContext — доступ к budgetsMap для ленивых детей раздела.
 *
 * База дерева (Проект→Объект→Раздел) строится один раз в useBudgetsHierarchy.
 * Ленивые этапы/задачи раздела (SectionLazyChildren) берут записи бюджетов из
 * этого контекста, не пробрасывая budgetsMap пропами через всё дерево.
 */

'use client'

import { createContext, useContext, useMemo, type ReactNode } from 'react'
import type { BudgetInfo } from '../types'

interface BudgetsDataContextValue {
  budgetsMap: Map<string, BudgetInfo[]>
}

const BudgetsDataContext = createContext<BudgetsDataContextValue | null>(null)

export function BudgetsDataProvider({
  budgetsMap,
  children,
}: {
  budgetsMap: Map<string, BudgetInfo[]>
  children: ReactNode
}) {
  const value = useMemo(() => ({ budgetsMap }), [budgetsMap])
  return <BudgetsDataContext.Provider value={value}>{children}</BudgetsDataContext.Provider>
}

export function useBudgetsData(): BudgetsDataContextValue {
  const ctx = useContext(BudgetsDataContext)
  if (!ctx) throw new Error('useBudgetsData must be used within BudgetsDataProvider')
  return ctx
}
