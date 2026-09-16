/**
 * Tasks View - Main Component
 *
 * Объединяет Kanban и Timeline (Resource Graph) представления
 * с общими фильтрами и системой вкладок
 */

'use client'

import { useMemo, useCallback, useEffect } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Lock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { InlineFilter, parseFilterString, tokensToQueryParams, type FilterOption } from '@/modules/inline-filter'
import { useTasksTabsStore, TASKS_FILTER_CONFIG } from '../stores'
import { useTasksFilterOptions } from '../hooks'
import { KanbanBoardInternal } from '@/modules/kanban/components/KanbanBoard'
import { DepartmentsTimelineInternal } from '@/modules/departments-timeline'
import { SectionsPageInternal } from '@/modules/sections-page'
import { BudgetsViewInternal } from '@/modules/budgets-page'
import { EMPLOYMENT_BOARD_FILTER_CONFIG, EmploymentBoardInternal } from '@/modules/employment-board'
import { TasksTabs } from './TasksTabs'
import { TabPicker } from './TabPicker'
import { PermissionsDebugPanel } from './PermissionsDebugPanel'
import { useHasPermission, usePermissions, usePermissionsLoader } from '@/modules/permissions'
import { EMPLOYMENT_BOARD_VIEW } from '@/modules/employment-board'

// ============================================================================
// Main Component
// ============================================================================

export function TasksView() {
  // Подтягиваем permissions через встроенный авто-loader usePermissionsLoader.
  // Он грузит права один раз за сессию (guard globalLoadedForUserId) и делает
  // фоновое обновление при наличии кэша — без блокировки UI и без лишних POST.
  // Раньше здесь был форсированный reloadPermissions() на каждый маунт, который
  // пробивал кэш и дублировал useFilterContext → шторм Server Actions (bug-VT-06).
  usePermissionsLoader()

  // URL search params
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const canViewEmploymentBoard = useHasPermission(EMPLOYMENT_BOARD_VIEW)
  const { isLoading: permissionsLoading } = usePermissions()

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

  const requestedTab = useMemo(
    () => (resolvedTabId ? tabs.find((t) => t.id === resolvedTabId) : undefined),
    [tabs, resolvedTabId]
  )
  const activeTab =
    requestedTab?.viewMode === 'employment' && !permissionsLoading && !canViewEmploymentBoard
      ? undefined
      : requestedTab

  // Не оставляем недоступную или уже удалённую локальную вкладку в прямой ссылке.
  // В частности, после отзыва права вкладка employment может отсутствовать в
  // persisted-store другого пользователя. Это UI-барьер; Server Action и RLS
  // остаются защитой данных.
  useEffect(() => {
    const isForbiddenEmploymentTab =
      requestedTab?.viewMode === 'employment' && !canViewEmploymentBoard
    const isMissingTab = Boolean(tabParam) && !requestedTab

    // Для несуществующего id не нужно ждать permissions: он не может стать
    // валидной вкладкой после загрузки прав.
    if (isMissingTab || (!permissionsLoading && isForbiddenEmploymentTab)) {
      router.replace(`${pathname}?tab=kanban`)
    }
  }, [requestedTab, tabParam, permissionsLoading, canViewEmploymentBoard, router, pathname])

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

  // Filter options for autocomplete + locked filters.
  // На Sections/Departments вкладках расширяем scope до отдела, чтобы UI
  // соответствовал серверной выборке (whole department, не только своя команда).
  const expandScopeForTasks = viewMode === 'sections' || viewMode === 'departments'
  const { options: filterOptions, allOptions, filterContext, lockedFilters } = useTasksFilterOptions({
    expandScopeForTasks,
  })

  const isEmploymentBoard = viewMode === 'employment'
  const activeFilterConfig = isEmploymentBoard
    ? EMPLOYMENT_BOARD_FILTER_CONFIG
    : TASKS_FILTER_CONFIG

  // У доски свой небольшой словарь, но источник опций и применение scope —
  // те же, что у остальных вкладок. `ответственный` переименовываем только
  // в UI: значение остаётся UUID сотрудника.
  const activeFilterOptions = useMemo<FilterOption[]>(() => {
    if (!isEmploymentBoard) return filterOptions

    // У руководителя подразделения доступ к доске определяется его
    // `headSubdivisionId`, а не общим tasks filter-scope. Поэтому список
    // отделов строим из его подразделения прямо здесь; другие вкладки
    // продолжают пользоваться только общим scope без изменений.
    const departmentOptions = filterContext?.headSubdivisionId
      ? allOptions.filter(
          (option) => option.key === 'отдел' && option.parentId === filterContext.headSubdivisionId,
        )
      : filterOptions.filter((option) => option.key === 'отдел')

    return [
      ...departmentOptions,
      ...filterOptions.flatMap((option) => {
        if (option.key === 'ответственный') return [{ ...option, key: 'сотрудник' }]
        return []
      }),
    ]
  }, [allOptions, filterContext?.headSubdivisionId, filterOptions, isEmploymentBoard])

  const activeLockedFilters = useMemo(
    () => isEmploymentBoard ? lockedFilters.filter((filter) => filter.key === 'отдел') : lockedFilters,
    [isEmploymentBoard, lockedFilters],
  )

  // // Log URL params for debugging
  // useEffect(() => {
  //   const projectId = searchParams.get('projectId')
  //   const sectionId = searchParams.get('sectionId')
  //   const highlight = searchParams.get('highlight')
  //   console.log('[TasksView] URL params:', { projectId, sectionId, highlight })
  //   console.log('[TasksView] Current viewMode:', viewMode)
  // }, [searchParams, viewMode])

  // Parse filter string to query params (shared between views)
  const queryParams = useMemo(() => {
    const parsed = parseFilterString(filterString, activeFilterConfig)
    return tokensToQueryParams(parsed.tokens, activeFilterConfig)
  }, [filterString, activeFilterConfig])

  // Handler for filter changes
  const handleFilterChange = useCallback((newFilterString: string) => {
    updateActiveTabFilters(newFilterString)
  }, [updateActiveTabFilters])

  return (
    <div className="h-screen flex flex-col bg-card">
      {/* Header with tabs and filter */}
      <header className="shrink-0 sticky top-0 z-50 bg-card border-b">
        {/* Tabs row */}
        <div className="flex items-center gap-6 px-4 pt-2">
          <h1 className="text-lg font-semibold">Задачи</h1>

          {/* Tabs component */}
          <TasksTabs />
        </div>

        {/* Filter row - показываем только когда открыта вкладка (не на пикере) */}
        {!showPicker && (
          <div className="px-4 py-2 border-t border-border/50">
            <div className="flex items-center gap-2">
              {/* Locked filters */}
              {activeLockedFilters.map((lock) => (
                <Badge
                  key={lock.key}
                  variant="secondary"
                  className="flex items-center gap-1.5 text-xs font-normal bg-muted/50"
                >
                  <Lock className="h-3 w-3 text-muted-foreground" />
                  <span className="text-muted-foreground">{lock.key}:</span>
                  <span>{lock.displayName}</span>
                </Badge>
              ))}

              {/* Inline filter */}
              <div className="flex-1">
                <InlineFilter
                  key={activeTab?.id ?? 'none'}
                  config={activeFilterConfig}
                  value={filterString}
                  onChange={handleFilterChange}
                  options={activeFilterOptions}
                />
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Content - takes remaining height */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {/* Пикер вкладок — пока вкладка не выбрана (тяжёлый контент не монтируется) */}
        {showPicker && <TabPicker />}

        {!showPicker && viewMode === 'kanban' && (
          <KanbanBoardInternal
            filterString={filterString}
            queryParams={queryParams}
            filterConfig={TASKS_FILTER_CONFIG}
            loadAllEnabled={loadAllEnabled}
            onLoadAll={() => setActiveTabLoadAll(true)}
          />
        )}
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
        {!showPicker && viewMode === 'employment' && (
          <EmploymentBoardInternal queryParams={queryParams} />
        )}
        {!showPicker && viewMode === 'budgets' && (
          <BudgetsViewInternal
            queryParams={queryParams}
            loadAllEnabled={loadAllEnabled}
            onLoadAll={() => setActiveTabLoadAll(true)}
          />
        )}
      </div>

      {/* Debug Panel - только в dev режиме */}
      {process.env.NODE_ENV === 'development' && <PermissionsDebugPanel />}
    </div>
  )
}
