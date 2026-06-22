# Tasks Tab Picker + Background Prefetch — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** На `/tasks` без `?tab` в URL показывать пикер вкладок вместо автозагрузки тяжёлого контента, а в фоне сбалансированно прогревать кэш, чтобы клик по вкладке открывал её быстро.

**Architecture:** Рендер страницы становится URL-driven: `TasksView` определяет активную вкладку из `?tab=<id>` (persisted `activeTabId` больше не управляет рендером, остаётся как «последняя активная»). Если вкладка не выбрана — рендерится новый `TabPicker`, тяжёлые view-компоненты не монтируются. `TabPicker` через новый хук `useTasksPrefetch` греет дешёвые общие запросы сразу (idle), тяжёлые — по hover карточки и один раз для последней активной вкладки. Ключи и параметры префетча точно совпадают с тем, что запрашивают сами view-компоненты.

**Tech Stack:** Next.js 15 App Router (`next/navigation`), React 19, TanStack Query (`@tanstack/react-query`), Zustand, существующий cache-модуль (`@/modules/cache`), `@/modules/inline-filter`.

---

## ⚠️ Verification model (важно — у проекта нет test runner)

В `package.json` нет тестового раннера (CLAUDE.md: "No test scripts are currently configured"). Поэтому вместо unit-тестов каждая задача проверяется так, как принято в этом проекте:

- **Typecheck/сборка:** `npm run build` (запускать только когда задача просит проверить сборку; dev-сервер у разработчика уже запущен и подхватит HMR).
- **Ручной сценарий** в браузере (конкретные шаги в каждой задаче).
- **Guardian-агенты** после кода (Cache Guardian, Clean Code Guardian, Next.js Guardian, Performance Guardian, Realtime Guardian).

Коммиты — после каждой задачи (в этом проекте коммит делает разработчик; шаг «Commit» оставлен как явный чекпоинт).

---

## File Structure

**Create:**
- `modules/tasks/hooks/useTasksPrefetch.ts` — вся логика префетча: дескрипторы тяжёлых запросов по `viewMode`, `prefetchTab(id)`, idle-прогрев дешёвых общих запросов + последней активной вкладки, отмена планирования при размонтировании.
- `modules/tasks/components/TabPicker.tsx` — экран выбора вкладки: сетка карточек + карточка «+ Новая вкладка», навигация по клику, hover/focus → `prefetchTab`.

**Modify:**
- `modules/tasks/components/TasksView.tsx` — URL-driven выбор вкладки, показ `TabPicker`, скрытие строки фильтра на пикере, синхронизация `activeTabId`.
- `modules/tasks/components/TasksTabs.tsx` — клик навигирует на `?tab=id`, подсветка активной по URL.
- `modules/tasks/hooks/index.ts` — экспорт `useTasksPrefetch`.
- `modules/tasks/components/index.ts` — экспорт `TabPicker`.
- README модуля tasks (если есть — иначе пропустить).

---

## Task 1: Хук префетча `useTasksPrefetch`

Чистая логика, без UI. Содержит дескрипторы тяжёлых запросов (ключи/параметры 1-в-1 как во view-компонентах), `prefetchTab(id)` для hover, и idle-эффект для дешёвых общих запросов + последней активной вкладки.

**Files:**
- Create: `modules/tasks/hooks/useTasksPrefetch.ts`
- Modify: `modules/tasks/hooks/index.ts`

- [ ] **Step 1: Создать файл хука**

Create `modules/tasks/hooks/useTasksPrefetch.ts`:

```tsx
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
 * Запустить тяжёлый префетч для вкладки. Ключи/параметры совпадают с view:
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
    if (queryClient.getQueryData(key) !== undefined) return
    void queryClient.prefetchInfiniteQuery({
      queryKey: key,
      queryFn: async ({ pageParam }) => {
        const r = await getKanbanSectionsPaginated({ filters, page: pageParam as number, pageSize: KANBAN_PAGE_SIZE })
        if (!r.success) throw new Error(r.error)
        return r.data
      },
      initialPageParam: 1,
      pages: 1,
      staleTime: STALE.kanban,
    }).catch(() => {})
    return
  }

  if (viewMode === 'departments') {
    const filters = filtersApplied ? queryParams : {}
    const key = queryKeys.departmentsTimeline.list(filters)
    if (queryClient.getQueryData(key) !== undefined) return
    void queryClient.prefetchQuery({
      queryKey: key,
      queryFn: async () => {
        const r = await getDepartmentsData(filters)
        if (!r.success) throw new Error(r.error)
        return r.data
      },
      staleTime: STALE.infinity,
    }).catch(() => {})
    return
  }

  if (viewMode === 'sections') {
    const filters = filtersApplied ? queryParams : {}
    const key = queryKeys.sectionsPage.list(filters)
    if (queryClient.getQueryData(key) !== undefined) return
    void queryClient.prefetchQuery({
      queryKey: key,
      queryFn: async () => {
        const r = await getSectionsHierarchy(filters)
        if (!r.success) throw new Error(r.error)
        return r.data
      },
      staleTime: STALE.infinity,
    }).catch(() => {})
    return
  }

  if (viewMode === 'budgets') {
    const filters = filtersApplied ? queryParams : {}
    const key = queryKeys.resourceGraph.list(filters)
    if (queryClient.getQueryData(key) !== undefined) return
    void queryClient.prefetchQuery({
      queryKey: key,
      queryFn: async () => {
        const r = await getResourceGraphData(filters)
        if (!r.success) throw new Error(r.error)
        return r.data
      },
      staleTime: STALE.infinity,
    }).catch(() => {})
    return
  }

  // viewMode 'timeline' — легаси, не используется на /tasks: ничего не префетчим.
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

    const shared = [
      { key: queryKeys.companyCalendar.events(), fn: getCompanyCalendarEvents, staleTime: STALE.infinity },
      { key: queryKeys.departmentsTimeline.freshness(), fn: getTeamsFreshness, staleTime: STALE.freshness },
      { key: queryKeys.budgets.calc(), fn: getSectionCalcBudgets, staleTime: STALE.calc },
    ]

    const run = async () => {
      for (const ref of shared) {
        if (cancelled) return
        if (queryClient.getQueryData(ref.key) !== undefined) continue
        await queryClient.prefetchQuery({
          queryKey: ref.key,
          queryFn: async () => {
            const r = await ref.fn()
            if (!r.success) throw new Error(r.error)
            return r.data
          },
          staleTime: ref.staleTime,
        }).catch(() => {})
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
```

- [ ] **Step 2: Экспортировать хук**

Modify `modules/tasks/hooks/index.ts` — добавить строку:

```ts
export { useTasksFilterOptions } from './useTasksFilterOptions'
export { useTasksPrefetch } from './useTasksPrefetch'
```

- [ ] **Step 3: Проверить сборку**

Run: `npm run build`
Expected: успешная компиляция; нет ошибок типов (особенно по импортам Server Actions и `queryKeys`). Если какой-то импорт не резолвится — сверить путь по `docs/superpowers/specs/2026-06-15-tasks-tab-picker-prefetch-design.md` (раздел D): `getCompanyCalendarEvents` импортируется из `@/modules/resource-graph/actions` (не из barrel), `getResourceGraphData` — из `@/modules/resource-graph`.

- [ ] **Step 4: Cache Guardian review**

Передать агенту `cache-guardian` файл `modules/tasks/hooks/useTasksPrefetch.ts`. Проверить: ключи совпадают с view-хуками, дедуп через `getQueryData`, `staleTime` корректен, нет двойных запросов.
Зафиксировать вывод: ✅ / ⚠️ + исправления.

- [ ] **Step 5: Commit**

```bash
git add modules/tasks/hooks/useTasksPrefetch.ts modules/tasks/hooks/index.ts
git commit -m "feat(tasks): add useTasksPrefetch hook for /tasks background prefetch"
```

---

## Task 2: Компонент `TabPicker`

Экран выбора вкладки: сетка карточек (иконка `viewMode` + имя), карточка «+ Новая вкладка» (через существующий `TabModal`), навигация по клику на `?tab=id`, hover/focus → `prefetchTab`.

**Files:**
- Create: `modules/tasks/components/TabPicker.tsx`
- Modify: `modules/tasks/components/index.ts`

- [ ] **Step 1: Создать компонент**

Create `modules/tasks/components/TabPicker.tsx`:

```tsx
'use client'

import { useMemo, useState, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import {
  Plus,
  LayoutGrid,
  GanttChart,
  Users,
  Wallet,
  FolderTree,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTasksTabsStore, type TaskTab, type TasksViewMode } from '../stores'
import { useTasksPrefetch } from '../hooks'
import { TabModal } from './TabModal'

const VIEW_MODE_ICON_MAP: Record<TasksViewMode, LucideIcon> = {
  kanban: LayoutGrid,
  timeline: GanttChart,
  departments: Users,
  budgets: Wallet,
  sections: FolderTree,
}

interface TabPickerCardProps {
  tab: TaskTab
  onOpen: (id: string) => void
  onPrefetch: (id: string) => void
}

function TabPickerCard({ tab, onOpen, onPrefetch }: TabPickerCardProps) {
  const Icon = VIEW_MODE_ICON_MAP[tab.viewMode]
  return (
    <button
      type="button"
      onClick={() => onOpen(tab.id)}
      onMouseEnter={() => onPrefetch(tab.id)}
      onFocus={() => onPrefetch(tab.id)}
      className={cn(
        'flex flex-col items-start gap-3 rounded-lg border border-border bg-card p-5 text-left',
        'transition-colors hover:border-primary hover:bg-accent/40',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary'
      )}
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </span>
      <span className="text-sm font-medium text-foreground">{tab.name}</span>
    </button>
  )
}

export function TabPicker() {
  const router = useRouter()
  const pathname = usePathname()

  const tabs = useTasksTabsStore((s) => s.tabs)
  const activeTabId = useTasksTabsStore((s) => s.activeTabId)

  const sortedTabs = useMemo(() => [...tabs].sort((a, b) => a.order - b.order), [tabs])

  // Префетч включён, пока показан пикер (этот компонент смонтирован)
  const { prefetchTab } = useTasksPrefetch({ tabs, activeTabId, enabled: true })

  const [modalOpen, setModalOpen] = useState(false)

  const handleOpen = useCallback(
    (id: string) => {
      router.push(`${pathname}?tab=${encodeURIComponent(id)}`)
    },
    [router, pathname]
  )

  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="w-full max-w-3xl">
        <div className="mb-6 text-center">
          <h2 className="text-lg font-semibold text-foreground">Выберите вкладку</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Содержимое загрузится после выбора — данные уже греются в фоне
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {sortedTabs.map((tab) => (
            <TabPickerCard
              key={tab.id}
              tab={tab}
              onOpen={handleOpen}
              onPrefetch={prefetchTab}
            />
          ))}

          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className={cn(
              'flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border p-5',
              'text-muted-foreground transition-colors hover:border-primary hover:text-foreground',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary'
            )}
          >
            <Plus className="h-5 w-5" />
            <span className="text-sm font-medium">Новая вкладка</span>
          </button>
        </div>
      </div>

      <TabModal open={modalOpen} onClose={() => setModalOpen(false)} editingTab={null} />
    </div>
  )
}
```

> Примечание: `VIEW_MODE_ICON_MAP` намеренно продублирован из `TasksTabs.tsx` (5 строк, презентационная деталь) — это дешевле и безопаснее, чем рефакторить `TasksTabs`. Если Clean Code Guardian настоит — вынести в `modules/tasks/components/view-mode-icons.ts` и импортировать в обоих местах.

- [ ] **Step 2: Экспортировать компонент**

Modify `modules/tasks/components/index.ts`:

```ts
export { TasksView } from './TasksView'
export { TasksTabs } from './TasksTabs'
export { TabPicker } from './TabPicker'
export { TabModal } from './TabModal'
export { PermissionsDebugPanel } from './PermissionsDebugPanel'
```

- [ ] **Step 3: Проверить сборку**

Run: `npm run build`
Expected: успешная компиляция. `TabModal` принимает `{ open, onClose, editingTab }` — сверить с текущим использованием в `TasksTabs.tsx` (props совпадают).

- [ ] **Step 4: Clean Code + Next.js Guardian review**

Передать `clean-code-guardian` и `nextjs-guardian` файл `modules/tasks/components/TabPicker.tsx`. Проверить: размер/читабельность, корректность App Router навигации (`useRouter`/`usePathname` из `next/navigation`), доступность (кнопки, focus-ring).
Зафиксировать вывод.

- [ ] **Step 5: Commit**

```bash
git add modules/tasks/components/TabPicker.tsx modules/tasks/components/index.ts
git commit -m "feat(tasks): add TabPicker screen with hover prefetch"
```

---

## Task 3: URL-driven рендер в `TasksView`

`TasksView` определяет активную вкладку из `?tab` (с легаси-фолбэком на budgets для `?sectionId&highlight=true`). Нет вкладки → `TabPicker`, тяжёлый контент и строка фильтра не монтируются. Синхронизируем `activeTabId` со стором.

**Files:**
- Modify: `modules/tasks/components/TasksView.tsx`

- [ ] **Step 1: Заменить выбор активной вкладки на URL-driven**

В `modules/tasks/components/TasksView.tsx` заменить блок выбора активной вкладки.

Было (строки ~42–57):

```tsx
  // Get active tab data from tabs store (proper selectors for reactivity)
  const tabs = useTasksTabsStore((s) => s.tabs)
  const activeTabId = useTasksTabsStore((s) => s.activeTabId)
  const updateActiveTabFilters = useTasksTabsStore((s) => s.updateActiveTabFilters)
  const setActiveTabLoadAll = useTasksTabsStore((s) => s.setActiveTabLoadAll)

  // Find active tab from tabs array
  const activeTab = useMemo(
    () => tabs.find((t) => t.id === activeTabId),
    [tabs, activeTabId]
  )

  // Current filter and view mode from active tab
  const filterString = activeTab?.filterString ?? ''
  const viewMode = activeTab?.viewMode ?? 'kanban'
  const loadAllEnabled = activeTab?.loadAllEnabled ?? false
```

Стало:

```tsx
  // Get tabs + store actions (URL — источник истины активной вкладки)
  const tabs = useTasksTabsStore((s) => s.tabs)
  const storedActiveTabId = useTasksTabsStore((s) => s.activeTabId)
  const setActiveTab = useTasksTabsStore((s) => s.setActiveTab)
  const updateActiveTabFilters = useTasksTabsStore((s) => s.updateActiveTabFilters)
  const setActiveTabLoadAll = useTasksTabsStore((s) => s.setActiveTabLoadAll)

  // Разрешаем активную вкладку из URL. Легаси deep-link
  // (?sectionId=...&highlight=true) потребляет только BudgetsView → открываем budgets.
  const tabParam = searchParams.get('tab')
  const hasLegacyHighlight =
    searchParams.get('highlight') === 'true' && !!searchParams.get('sectionId')
  const resolvedTabId = tabParam ?? (hasLegacyHighlight ? 'budgets' : null)

  const activeTab = useMemo(
    () => (resolvedTabId ? tabs.find((t) => t.id === resolvedTabId) : undefined),
    [tabs, resolvedTabId]
  )

  // Нет валидной вкладки в URL → показываем пикер, тяжёлый контент не монтируем
  const showPicker = !activeTab

  // Синхронизируем persisted activeTabId с URL (для "последней активной" и префетча)
  useEffect(() => {
    if (activeTab && activeTab.id !== storedActiveTabId) {
      setActiveTab(activeTab.id)
    }
  }, [activeTab, storedActiveTabId, setActiveTab])

  // Current filter and view mode from active tab
  const filterString = activeTab?.filterString ?? ''
  const viewMode = activeTab?.viewMode ?? 'kanban'
  const loadAllEnabled = activeTab?.loadAllEnabled ?? false
```

- [ ] **Step 2: Импортировать TabPicker**

В начале файла, в импортах компонентов рядом с `import { TasksTabs } from './TasksTabs'`, добавить:

```tsx
import { TabPicker } from './TabPicker'
```

- [ ] **Step 3: Скрыть строку фильтра на пикере и рендерить TabPicker**

Заменить условие строки фильтра: было `{tabs.length > 0 && (` (строка ~100) на `{!showPicker && (`.

Заменить блок контента (строки ~131–172). Было:

```tsx
      {/* Content - takes remaining height */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {/* Empty state when no tabs */}
        {tabs.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-muted-foreground">
              <p className="text-lg mb-2">Нет вкладок</p>
              <p className="text-sm">Нажмите + чтобы создать новую вкладку</p>
            </div>
          </div>
        )}
        {tabs.length > 0 && viewMode === 'kanban' && (
```

Стало (заменяем empty-state на пикер и заменяем `tabs.length > 0` на `!showPicker` во всех четырёх ветках):

```tsx
      {/* Content - takes remaining height */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {/* Пикер вкладок — пока вкладка не выбрана (тяжёлый контент не монтируется) */}
        {showPicker && <TabPicker />}

        {!showPicker && viewMode === 'kanban' && (
```

И ниже заменить оставшиеся три условия `tabs.length > 0 &&` на `!showPicker &&`:

```tsx
        {!showPicker && viewMode === 'departments' && (
          <DepartmentsTimelineInternal
            queryParams={queryParams}
            loadAllEnabled={loadAllEnabled}
            onLoadAll={() => setActiveTabLoadAll(true)}
          />
        )}
        {!showPicker && viewMode === 'sections' && (
          <SectionsPageInternal
            queryParams={queryParams}
            loadAllEnabled={loadAllEnabled}
            onLoadAll={() => setActiveTabLoadAll(true)}
          />
        )}
        {!showPicker && viewMode === 'budgets' && (
          <BudgetsViewInternal
            queryParams={queryParams}
            loadAllEnabled={loadAllEnabled}
            onLoadAll={() => setActiveTabLoadAll(true)}
          />
        )}
```

> `useEffect` уже импортирован в файле (строка 10). `searchParams` уже объявлен (строка 40). `tabs` остаётся используемым (header показывает вкладки всегда).

- [ ] **Step 4: Проверить сборку**

Run: `npm run build`
Expected: успешная компиляция, нет неиспользуемых переменных (`storedActiveTabId`, `setActiveTab` используются в эффекте; `activeTabId` старого имени больше нет — убедиться, что нигде ниже в файле не осталось ссылки на старое `activeTabId`; в JSX строки фильтра `key={activeTabId}` заменить на `key={activeTab?.id ?? 'none'}`).

> ⚠️ Внимание: в текущем файле `InlineFilter` использует `key={activeTabId}` (строка ~119). Так как переменная переименована, заменить на `key={activeTab?.id ?? 'none'}`.

- [ ] **Step 5: Ручной сценарий**

1. Открыть `/tasks` без query-параметров → виден пикер, тяжёлый контент НЕ грузится (в Network нет запроса `getKanbanSectionsPaginated`/`getResourceGraphData` и т.п. от активной вкладки сразу).
2. В DevTools → Network видно фоновые запросы: company-calendar events, departments freshness, budgets calc (idle), и тяжёлый запрос последней активной вкладки.
3. Клик по карточке → URL получает `?tab=<id>`, рендерится контент вкладки; refresh остаётся на вкладке; «назад» → пикер.
4. Открыть напрямую `/tasks?tab=budgets&sectionId=<id>&highlight=true` → сразу budgets, нужный раздел подсвечен (deep-link не сломан). Также проверить старую форму без `tab`: `/tasks?sectionId=<id>&highlight=true` → открывается budgets.

- [ ] **Step 6: Realtime Guardian review**

Передать `realtime-guardian`: подтвердить, что на пикере не монтируются view-компоненты → новых подписок нет, утечек нет.

- [ ] **Step 7: Commit**

```bash
git add modules/tasks/components/TasksView.tsx
git commit -m "feat(tasks): URL-driven tab rendering + tab picker on /tasks"
```

---

## Task 4: Навигация по вкладкам в `TasksTabs` через URL

Клик по вкладке в верхней панели должен навигировать на `?tab=id`, а подсветка активной — определяться URL (а не только стором). Так верхняя панель и пикер консистентны, refresh/назад работают.

**Files:**
- Modify: `modules/tasks/components/TasksTabs.tsx`

- [ ] **Step 1: Подключить роутер и URL**

В `modules/tasks/components/TasksTabs.tsx` добавить импорт в начало (рядом с другими):

```tsx
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
```

- [ ] **Step 2: Использовать URL для активной вкладки и навигации**

В `TasksTabs` заменить чтение/установку активной вкладки.

Было (строки ~112–116):

```tsx
  const tabs = useTasksTabsStore((s) => s.tabs)
  const activeTabId = useTasksTabsStore((s) => s.activeTabId)
  const setActiveTab = useTasksTabsStore((s) => s.setActiveTab)
  const deleteTab = useTasksTabsStore((s) => s.deleteTab)
```

Стало:

```tsx
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const tabs = useTasksTabsStore((s) => s.tabs)
  const deleteTab = useTasksTabsStore((s) => s.deleteTab)

  // Активная вкладка определяется URL (источник истины рендера в TasksView)
  const activeTabId = searchParams.get('tab')

  const handleSelectTab = useCallback(
    (id: string) => {
      router.push(`${pathname}?tab=${encodeURIComponent(id)}`)
    },
    [router, pathname]
  )
```

- [ ] **Step 3: Навигировать по клику вместо setActiveTab**

В JSX заменить `onClick={() => setActiveTab(tab.id)}` (строка ~152) на:

```tsx
            onClick={() => handleSelectTab(tab.id)}
```

> `activeTabId === tab.id` для подсветки теперь сравнивает с URL-значением — работает без изменений. `useCallback` уже импортирован в файле (строка 3).

- [ ] **Step 4: Проверить сборку**

Run: `npm run build`
Expected: успешная компиляция; `setActiveTab` больше не используется в этом файле (удалён из деструктуризации) — убедиться, что не осталось других ссылок.

- [ ] **Step 5: Ручной сценарий**

1. На открытой вкладке кликнуть другую вкладку в верхней панели → URL меняется на `?tab=<new>`, контент переключается, активная подсвечена корректно.
2. Удаление активной вкладки через «…» → проверить поведение: после удаления store обновит `activeTabId`, но URL ещё указывает на удалённую вкладку → `TasksView` покажет пикер (мягкий fallback). Это допустимо. (Если нужно автоматически переходить на другую вкладку — отдельная доработка вне DoD.)

- [ ] **Step 6: Clean Code Guardian review**

Передать `clean-code-guardian` `modules/tasks/components/TasksTabs.tsx`: консистентность с `TabPicker` (одинаковый способ навигации), отсутствие мёртвых импортов.

- [ ] **Step 7: Commit**

```bash
git add modules/tasks/components/TasksTabs.tsx
git commit -m "feat(tasks): navigate tabs via ?tab URL param"
```

---

## Task 5: Финальная проверка, документация, аудит

**Files:**
- Modify: README модуля tasks (если существует `modules/tasks/README.md` — иначе пропустить шаг документации)

- [ ] **Step 1: Проверить, есть ли README модуля**

Run: `ls modules/tasks/README.md`
Если файла нет — пропустить Step 2.

- [ ] **Step 2: Обновить README (если есть)**

Добавить в README модуля tasks раздел о поведении страницы:
- `/tasks` без `?tab` показывает пикер вкладок; тяжёлый контент не монтируется.
- Активная вкладка — через `?tab=<id>` (deep-link, refresh-stable). Легаси `?sectionId=...&highlight=true` открывает budgets.
- Префетч: дешёвые общие запросы (calendar/freshness/calc) греются в idle; тяжёлые — по hover карточки и для последней активной вкладки (`useTasksPrefetch`).

- [ ] **Step 3: Финальная сборка**

Run: `npm run build`
Expected: зелёная сборка без ошибок и предупреждений о неиспользуемых переменных в затронутых файлах.

- [ ] **Step 4: Финальный аудит агентами**

- `performance-guardian`: подтвердить, что не префетчим тяжёлые запросы всех вкладок (только hover + последняя), idle-планирование, нет лишних ре-рендеров.
- `cache-guardian`: финальная сверка ключей/дедупа/staleTime по всем 4 viewMode.
- `realtime-guardian`: нет новых подписок на пикере.

- [ ] **Step 5: Прогон Definition of Done (из тикета bug-DH-01)**

Проверить в браузере (Network открыт):
- [ ] Вход на `/tasks` без `?tab` → пикер, тяжёлый контент не монтируется.
- [ ] Фоновый префетч идёт, без дублирующихся запросов (один и тот же ключ не запрашивается дважды).
- [ ] Клик по вкладке открывает её ощутимо быстрее (данные из прогретого кэша; для вкладок с фильтрами/loadAll — мгновенно, для пустых — пусто как и раньше).
- [ ] Deep-link `?tab=<id>` и легаси `?sectionId&highlight=true` работают.
- [ ] Нет лишних запросов и утечек подписок.

- [ ] **Step 6: Перевести тикет в review**

Обновить `.devtool/features/bug-DH-01.md`: `status: "review"`, добавить в тело (1) как решено, (2) на что смотреть ревьюеру (корректность ключей префетча = совпадение с view-хуками; пустые вкладки без фильтров не должны ничего грузить; deep-link budgets).

- [ ] **Step 7: Commit**

```bash
git add modules/tasks/README.md .devtool/features/bug-DH-01.md
git commit -m "docs(tasks): document picker+prefetch; move bug-DH-01 to review"
```

---

## Self-Review (выполнено при написании плана)

**1. Spec coverage:**
- Пикер при входе без `?tab` → Task 3. ✅
- URL-driven (`?tab`), синхронизация activeTabId → Task 3, Task 4. ✅
- Deep-link (`?tab` + легаси `sectionId/highlight` → budgets) → Task 3 (Step 1, Step 5). ✅
- Префетч: дешёвое общее (idle) + hover + последняя активная → Task 1 (хук), Task 2 (hover wiring). ✅
- Совпадение ключей/параметров с view (kanban undefined; departments/sections/budgets `{}`) → Task 1 `prefetchHeavy`. ✅
- Дедуп/staleTime/отмена планирования → Task 1. ✅
- Нет утечек подписок → Task 3 Step 6, Task 5 Step 4. ✅
- README → Task 5. ✅

**2. Placeholder scan:** все шаги с кодом содержат полный код; команды и ожидаемые результаты указаны. ✅

**3. Type consistency:** `prefetchTab(id: string)`, `useTasksPrefetch({ tabs, activeTabId, enabled })`, `TabPicker` без props, `getTabFetchPlan`/`prefetchHeavy` — имена согласованы между Task 1 и Task 2. Ключи `queryKeys.*` и Server Actions сверены по спеке (раздел C/D). ✅

## Открытые моменты (зафиксированы, решения приняты)
- Удаление активной вкладки оставляет «висячий» `?tab` → пикер как fallback (допустимо, вне DoD). Автопереход — отдельная доработка при желании.
- Структуры инлайн-фильтра в набор A НЕ включены (минимизация трафика); при необходимости добавить позже.
