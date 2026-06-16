'use client'

/**
 * useTasksPrefetch — сбалансированный фоновый префетч для страницы /tasks.
 *
 * A) Дешёвые общие запросы (без параметров) — греем сразу в idle:
 *    company-calendar events, departments freshness, budgets calc.
 * B) Тяжёлые запросы (зависят от фильтров вкладки) — НЕ греем все:
 *    - по hover/focus карточки вкладки (prefetchTab)
 *    - один раз для последней активной вкладки (activeTabId)
 *
 * Ключи и параметры префетча ТОЧНО совпадают с тем, что запрашивают сами
 * view-компоненты (иначе прогреется не тот ключ). См. соответствие ниже.
 *
 * Аккуратность: дедуп через getQueryData; prefetchQuery уважает staleTime;
 * при размонтировании прекращаем планирование (cancelled + cancelIdle).
 * In-flight запросы намеренно НЕ отменяем: если юзер кликнул вкладку, её
 * данные как раз догрузятся; gcTime уберёт неиспользованное.
 */

import { useCallback, useEffect, useRef } from 'react'
import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/modules/cache'
import { parseFilterString, tokensToQueryParams } from '@/modules/inline-filter'
import { TASKS_FILTER_CONFIG, type TaskTab, type TasksViewMode } from '../stores'

// Server Actions (queryFn источники)
import { getKanbanSectionsPaginated } from '@/modules/kanban/actions'
import { getDepartmentsData, getTeamsFreshness } from '@/modules/departments-timeline/actions'
import { getSectionsHierarchy } from '@/modules/sections-page/actions'
import { getResourceGraphData } from '@/modules/resource-graph'
import { getCompanyCalendarEvents } from '@/modules/resource-graph/actions'
import { getSectionCalcBudgets } from '@/modules/budgets-page/actions'

const KANBAN_PAGE_SIZE = 15

// staleTime значения — те же, что в соответствующих cache-хуках
const STALE = {
  infinity: Infinity,
  freshness: 5 * 60 * 1000, // useTeamsFreshness
  calc: 3 * 60 * 1000,      // useSectionCalcBudgets (medium)
  kanban: 2 * 60 * 1000,    // useKanbanSectionsInfinite (fast)
} as const

// idle helpers (по образцу reference-prefetch.tsx)
function scheduleIdle(cb: () => void): number {
  if (typeof requestIdleCallback !== 'undefined') return requestIdleCallback(cb)
  return window.setTimeout(cb, 2000) as unknown as number
}
function cancelIdle(id: number): void {
  if (typeof cancelIdleCallback !== 'undefined') cancelIdleCallback(id)
  else clearTimeout(id)
}
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Вычислить queryParams вкладки и решить, есть ли что грузить.
 * Зеркалит логику TasksView: filtersApplied = есть хотя бы один параметр.
 */
function getTabFetchPlan(tab: TaskTab) {
  const parsed = parseFilterString(tab.filterString, TASKS_FILTER_CONFIG)
  const queryParams = tokensToQueryParams(parsed.tokens, TASKS_FILTER_CONFIG)
  const filtersApplied = Object.keys(queryParams).length > 0
  const shouldFetch = filtersApplied || !!tab.loadAllEnabled
  return { queryParams, filtersApplied, shouldFetch }
}

/**
 * Запустить тяжёлый префетч для вкладки. Дедуп и проверку staleTime делает
 * сам prefetchQuery/prefetchInfiniteQuery (no-op для свежих данных, join для
 * in-flight) — отдельный getQueryData-guard не нужен и игнорировал бы staleTime.
 * Ключи/параметры совпадают с view:
 *  kanban      → useKanbanSectionsInfinite(filtersApplied ? params : undefined)
 *  departments → useDepartmentsData(filtersApplied ? params : {})
 *  sections    → useSectionsHierarchy(filtersApplied ? params : {})
 *  budgets     → useResourceGraphData(filtersApplied ? params : {})  (внутри useBudgetsHierarchy)
 */
function prefetchHeavy(queryClient: QueryClient, tab: TaskTab): void {
  const { queryParams, filtersApplied, shouldFetch } = getTabFetchPlan(tab)
  if (!shouldFetch) return

  const viewMode: TasksViewMode = tab.viewMode

  if (viewMode === 'kanban') {
    const filters = filtersApplied ? queryParams : undefined
    const key = queryKeys.kanban.infinite(filters)
    void queryClient
      .prefetchInfiniteQuery({
        queryKey: key,
        queryFn: async ({ pageParam }) => {
          const r = await getKanbanSectionsPaginated({
            filters,
            page: pageParam as number,
            pageSize: KANBAN_PAGE_SIZE,
          })
          if (!r.success) throw new Error(r.error)
          return r.data
        },
        initialPageParam: 1,
        pages: 1,
        staleTime: STALE.kanban,
      })
      .catch(() => {})
    return
  }

  if (viewMode === 'departments') {
    const filters = filtersApplied ? queryParams : {}
    const key = queryKeys.departmentsTimeline.list(filters)
    void queryClient
      .prefetchQuery({
        queryKey: key,
        queryFn: async () => {
          const r = await getDepartmentsData(filters)
          if (!r.success) throw new Error(r.error)
          return r.data
        },
        staleTime: STALE.infinity,
      })
      .catch(() => {})
    return
  }

  if (viewMode === 'sections') {
    const filters = filtersApplied ? queryParams : {}
    const key = queryKeys.sectionsPage.list(filters)
    void queryClient
      .prefetchQuery({
        queryKey: key,
        queryFn: async () => {
          const r = await getSectionsHierarchy(filters)
          if (!r.success) throw new Error(r.error)
          return r.data
        },
        staleTime: STALE.infinity,
      })
      .catch(() => {})
    return
  }

  if (viewMode === 'budgets') {
    const filters = filtersApplied ? queryParams : {}
    const key = queryKeys.resourceGraph.list(filters)
    void queryClient
      .prefetchQuery({
        queryKey: key,
        queryFn: async () => {
          const r = await getResourceGraphData(filters)
          if (!r.success) throw new Error(r.error)
          return r.data
        },
        staleTime: STALE.infinity,
      })
      .catch(() => {})
    return
  }

  // viewMode 'timeline' — легаси, не используется на /tasks: ничего не префетчим.
}

/**
 * Дескриптор дешёвого общего запроса. fn типизирован единообразно
 * (ActionResult с data: unknown), чтобы избежать union-of-functions при
 * выводе типа массива.
 */
type SharedPrefetchRef = {
  key: readonly unknown[]
  fn: () => Promise<{ success: true; data: unknown } | { success: false; error: string }>
  staleTime: number
}

interface UseTasksPrefetchArgs {
  tabs: TaskTab[]
  /** Последняя активная вкладка (persisted) — приоритетный тяжёлый префетч. */
  activeTabId: string | null
  /** Греть только когда показан пикер. */
  enabled: boolean
}

export function useTasksPrefetch({ tabs, activeTabId, enabled }: UseTasksPrefetchArgs) {
  const queryClient = useQueryClient()

  // Стабильная ссылка на tabs для prefetchTab без лишних пересозданий эффекта
  const tabsRef = useRef(tabs)
  tabsRef.current = tabs

  /** Hover/намерение: прогреть тяжёлый запрос конкретной вкладки. */
  const prefetchTab = useCallback(
    (tabId: string) => {
      const tab = tabsRef.current.find((t) => t.id === tabId)
      if (!tab) return
      prefetchHeavy(queryClient, tab)
    },
    [queryClient]
  )

  // A) дешёвые общие + B) последняя активная — в idle при показе пикера
  useEffect(() => {
    if (!enabled) return
    let cancelled = false

    const shared: SharedPrefetchRef[] = [
      { key: queryKeys.companyCalendar.events(), fn: getCompanyCalendarEvents, staleTime: STALE.infinity },
      { key: queryKeys.departmentsTimeline.freshness(), fn: getTeamsFreshness, staleTime: STALE.freshness },
      { key: queryKeys.budgets.calc(), fn: getSectionCalcBudgets, staleTime: STALE.calc },
    ]

    const run = async () => {
      for (const ref of shared) {
        if (cancelled) return
        // staleTime + дедуп in-flight делает сам prefetchQuery (no-op для свежих)
        await queryClient
          .prefetchQuery({
            queryKey: ref.key,
            queryFn: async () => {
              const r = await ref.fn()
              if (!r.success) throw new Error(r.error)
              return r.data
            },
            staleTime: ref.staleTime,
          })
          .catch(() => {})
        if (!cancelled) await delay(200)
      }
      if (cancelled) return
      if (activeTabId) prefetchTab(activeTabId)
    }

    const idleId = scheduleIdle(() => {
      if (!cancelled) void run()
    })

    return () => {
      cancelled = true
      cancelIdle(idleId)
    }
  }, [enabled, activeTabId, prefetchTab, queryClient])

  return { prefetchTab }
}
