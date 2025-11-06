"use client" 
import { Loader2 } from "lucide-react"
// Импортируем сторы напрямую из их файлов
import { usePlanningStore } from "../stores/usePlanningStore"
// Заменяем старый стор фильтров на новый
import { useFilterStore } from "../filters/store"
import { usePlanningViewStore } from "../stores/usePlanningViewStore"
import { useUserStore } from "@/stores/useUserStore"
import { useUiStore } from "@/stores/useUiStore"
import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { TimelineGrid } from "./timeline-grid"
import { getFiltersPermissionContextAsync } from "@/modules/permissions/integration/filters-permission-context"
import * as Sentry from "@sentry/nextjs"
import { TimelineHeaderTabs } from "./timeline/timeline-header-tabs"
import { useTheme } from "next-themes"
import { useSettingsStore } from "@/stores/useSettingsStore"
import { ColumnVisibilityMenu } from "./timeline/column-visibility-menu"
import { PermissionBadge } from "./permission-badge"
import { Button } from "@/components/ui/button"
import { SectionPanel } from "@/components/modals"
import { useTimelineAutoRefresh } from "../hooks/useTimelineAutoRefresh"
import { Pagination } from "./pagination"
import { useSectionStatuses } from "@/modules/statuses-tags/statuses/hooks/useSectionStatuses"

export function TimelineView() {
  // Получаем состояние и действия из нового стора фильтров
  const {
    selectedProjectId,
    selectedDepartmentId,
    selectedTeamId,
    selectedEmployeeId,
    selectedManagerId,
    selectedStageId,
    selectedObjectId,
    resetFilters,
  } = useFilterStore()

  const {
    sections,
    allSections,
    departments,
    isLoadingSections,
    isLoadingDepartments,
    fetchProjectSummaries,
    fetchSections,
    fetchDepartments,
    setFilters,
    expandedSections,
    expandedDepartments,
    toggleSectionExpanded,
    toggleDepartmentExpanded,
    expandAllSections,
    collapseAllSections,
    expandAllDepartments,
    collapseAllDepartments,
    toggleShowDepartments,
    showSections,
    showDepartments,
    currentPage,
    sectionsPerPage,
    setCurrentPage,
  } = usePlanningStore()

  const {
    activeTab,
    setActiveTab,
    startDate,
    daysToShow,
    setStartDate,
    setDaysToShow,
    scrollForward,
    scrollBackward,
    cellWidth, // Оставляем только для чтения
  } = usePlanningViewStore()

  // Устанавливаем фиксированное значение в 180 дней при инициализации
useEffect(() => {
   // Устанавливаем фиксированное значение в 180 дней при инициализации
   if (daysToShow !== 180) {
     setDaysToShow(180)
   }
 
   // Проверяем, что startDate является валидным объектом Date
   if (!(startDate instanceof Date) || isNaN(startDate.getTime())) {
    setStartDate(new Date())
   }
}, []) // Run only on mount

  // Применяем ограничения по правам при монтировании
  useEffect(() => {
    getFiltersPermissionContextAsync()
      .then(() => {
        // блокировки временно отключены
      })
      .catch((err) => {
        Sentry.captureException(err)
        console.error('Failed to init filter permissions context', err)
      })
  }, [])

  // TODO: Заменить на новую систему permissions из @/modules/permissions
  // const { permissions } = useUserStore() // Удалено - permissions больше нет в userStore

  // Используем тему из useSettingsStore
  const { theme: storeTheme } = useSettingsStore()
  const { resolvedTheme } = useTheme()
  const theme = storeTheme === "system" ? resolvedTheme || "light" : storeTheme

  const { setLoading } = useUiStore()
  const { statuses } = useSectionStatuses()

  // Ссылка на контейнер для измерения ширины
  const containerRef = useRef<HTMLDivElement>(null)

  // Состояние для отслеживания размера окна
  const [windowSize, setWindowSize] = useState({
    width: typeof window !== "undefined" ? window.innerWidth : 0,
    height: typeof window !== "undefined" ? window.innerHeight : 0,
  })

  // Состояние для SectionPanel
  const [showSectionPanel, setShowSectionPanel] = useState(false)
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null)
  const [initialSectionTab, setInitialSectionTab] = useState<'overview' | 'comments' | 'decomposition' | 'tasks' | 'reports' | 'loadings'>('overview')

  // Счетчик для принудительных обновлений
  const [refreshCounter, setRefreshCounter] = useState(0)

  // Хук для автоматического обновления timeline
  const { forceRefresh } = useTimelineAutoRefresh()

  // Количество активных фильтров
  const activeFiltersCount = [
    selectedProjectId, 
    selectedDepartmentId, 
    selectedTeamId, 
    selectedEmployeeId,
    selectedManagerId,
    selectedStageId,
    selectedObjectId
  ].filter(Boolean).length

  // Проверяем, есть ли активные фильтры
  const hasActiveFilters = activeFiltersCount > 0

  // Загружаем саммари проектов при монтировании
  useEffect(() => {
    fetchProjectSummaries()
  }, [fetchProjectSummaries])

  // Перегружаем саммари проектов при изменении фильтров, чтобы список групп соответствовал выбранной организации/менеджеру/проекту
  useEffect(() => {
    fetchProjectSummaries()
  }, [fetchProjectSummaries, selectedProjectId, selectedManagerId, selectedDepartmentId, selectedTeamId, selectedEmployeeId])

  // Применяем фильтры только при их изменении (если действительно заданы)
  useEffect(() => {
    if (activeFiltersCount > 0) {
      setLoading(true)
      setFilters(selectedProjectId, selectedDepartmentId, selectedTeamId, selectedManagerId, selectedEmployeeId, selectedStageId, selectedObjectId)
      const timer = setTimeout(() => setLoading(false), 300)
      return () => clearTimeout(timer)
    }
    // если фильтров нет — работаем в режиме саммари проектов, ничего не тянем
  }, [activeFiltersCount, selectedProjectId, selectedDepartmentId, selectedTeamId, selectedEmployeeId, selectedManagerId, selectedStageId, selectedObjectId, setFilters, setLoading])

  // Дополнительная подписка на изменения фильтров для немедленного обновления данных
  useEffect(() => {
    console.log("🔄 Фильтры изменились, обновляем данные:", {
      selectedStageId,
      selectedObjectId,
      selectedProjectId,
      selectedDepartmentId,
      selectedTeamId,
      selectedEmployeeId,
      selectedManagerId
    })
    
    // Вызываем fetchSections для немедленного обновления данных
    if (selectedProjectId || selectedDepartmentId || selectedTeamId || selectedEmployeeId || selectedManagerId || selectedStageId || selectedObjectId) {
      fetchSections()
    }
  }, [selectedStageId, selectedObjectId, selectedEmployeeId, fetchSections])

  // Загружаем отделы при переключении showDepartments
  useEffect(() => {
    if (showDepartments && departments.length === 0) {
      fetchDepartments()
    }
  }, [showDepartments, departments.length, fetchDepartments])

  // Добавляем обработчик изменения размера окна
  useEffect(() => {
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      })
    }

    // Добавляем слушатель события resize
    window.addEventListener("resize", handleResize)

    // Вызываем handleResize сразу для инициализации
    handleResize()

    // Очищаем слушатель при размонтировании
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  // Подписываемся на изменения в стор для автоматического обновления
  useEffect(() => {
    let previousState = {
      sectionsLength: usePlanningStore.getState().sections.length,
      loadingsMapSize: Object.keys(usePlanningStore.getState().loadingsMap).length,
      totalLoadings: Object.values(usePlanningStore.getState().loadingsMap).reduce((sum, loadings) => sum + loadings.length, 0)
    }

    const unsubscribe = usePlanningStore.subscribe((state) => {
      const current = {
        sectionsLength: state.sections.length,
        loadingsMapSize: Object.keys(state.loadingsMap).length,
        totalLoadings: Object.values(state.loadingsMap).reduce((sum, loadings) => sum + loadings.length, 0)
      }

      // Обновляем только при реальных изменениях данных
      if (
        current.sectionsLength !== previousState.sectionsLength ||
        current.loadingsMapSize !== previousState.loadingsMapSize ||
        current.totalLoadings !== previousState.totalLoadings
      ) {
        console.log("📊 Данные изменились, обновляем Timeline:", {
          sections: current.sectionsLength,
          loadingsMap: current.loadingsMapSize,
          totalLoadings: current.totalLoadings
        })
        setRefreshCounter(prev => prev + 1)
        previousState = current
      }
    })

    return unsubscribe
  }, [])

  // Обработчики для фильтров
  const handleProjectChange = (projectId: string | null) => {
    console.log("Изменение проекта:", projectId)
    // Новая система фильтров автоматически обновляет состояние
  }

  const handleDepartmentChange = (departmentId: string | null) => {
    console.log("Изменение отдела:", departmentId)
    // Новая система фильтров автоматически обновляет состояние
  }

  const handleTeamChange = (teamId: string | null) => {
    console.log("Изменение команды:", teamId)
    // Новая система фильтров автоматически обновляет состояние
  }

// Добавляем обработчик для менеджера
 const handleManagerChange = (managerId: string | null) => {
   console.log("Изменение менеджера:", managerId)
   // Новая система фильтров автоматически обновляет состояние
 }

  // Добавляем обработчик для этапов
  const handleStageChange = (stageId: string | null) => {
    console.log("Изменение этапа:", stageId)
    // Новая система фильтров автоматически обновляет состояние
  }

  // Добавляем обработчик для объектов
  const handleObjectChange = (objectId: string | null) => {
    console.log("Изменение объекта:", objectId)
    // Новая система фильтров автоматически обновляет состояние
  }

  // Добавляем обработчик для сотрудников
  const handleEmployeeChange = (employeeId: string | null) => {
    console.log("Изменение сотрудника:", employeeId)
    // Новая система фильтров автоматически обновляет состояние
  }

  const handleResetFilters = () => {
    console.log("Сброс фильтров")
    resetFilters()
  }

  // Обработчик открытия SectionPanel
  const handleOpenSectionPanel = (sectionId: string, initialTab: 'overview' | 'comments' | 'decomposition' | 'tasks' | 'reports' | 'loadings' = 'overview') => {
    setSelectedSectionId(sectionId)
    setInitialSectionTab(initialTab)
    setShowSectionPanel(true)
  }

  // Обработчик закрытия SectionPanel
  const handleCloseSectionPanel = () => {
    setShowSectionPanel(false)
    setSelectedSectionId(null)
  }

  // Обработчик для показа руководства  
  const handleShowGuide = () => {
    // Эта функция будет передана из родительского компонента
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('showPlanningGuide'))
    }
  }


 const handleTodayPeriod = () => {
   const today = new Date()
   // Отступаем на 30 дней назад от текущей даты
   today.setDate(today.getDate() - 30)
   setStartDate(today)
 }

  // Вычисляем общее количество страниц
  const totalPages = Math.ceil(allSections.length / Math.max(sectionsPerPage, 1))

  // Обработчик изменения страницы
  const handlePageChange = (page: number) => {
    // При изменении страницы подгружаем отделы, если они должны быть показаны
    setCurrentPage(page)
    if (showDepartments) {
      fetchDepartments()
    }
  }

  useEffect(() => {
    // Если отделы должны быть показаны, но еще не загружены, загружаем их
    if (showDepartments && departments.length === 0 && !isLoadingDepartments) {
      fetchDepartments()
    }
  }, [showDepartments, departments.length, isLoadingDepartments, fetchDepartments])

  return (
    <div
      className={cn(
        "font-sans overflow-x-hidden px-0",
      )}
      ref={containerRef}
    >
      {/* Header with improved styling */}
      <header className="flex justify-between items-center">
        <TimelineHeaderTabs
          theme={theme}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onTodayClick={handleTodayPeriod}
        />
      </header>

      {/* Старая панель фильтров удалена — фильтры перенесены в верхний бар */}

      {/* Main content area with improved styling - new approach with fixed columns */}
      <div
        className={cn(
          "w-full overflow-hidden relative overflow-y-auto",
          theme === "dark" ? "bg-slate-900" : "bg-white",
        )}
        style={{ 
          height: "calc(100vh - (var(--topbar-height,60px)))",
          borderCollapse: "collapse" 
        }}
      >
        {isLoadingSections ? (
          <div className="flex justify-center items-center p-8">
            <Loader2 className={cn("h-8 w-8 animate-spin", "text-teal-500")} />
          </div>
        ) : (
          <>
            <div className="relative w-full overflow-x-auto" style={{ borderCollapse: "collapse" }}>
              <TimelineGrid
                sections={sections}
                departments={departments}
                showSections={showSections}
                showDepartments={showDepartments}
                startDate={startDate}
                daysToShow={daysToShow}
                theme={theme}
                isLoading={isLoadingSections}
                isLoadingDepartments={isLoadingDepartments}
                enableShadow={true}
                useAbsoluteColumns={false}
                cellWidth={22}
                windowWidth={windowSize.width}
                hasActiveFilters={hasActiveFilters}
                onOpenSectionPanel={handleOpenSectionPanel}
                expandAllDepartments={expandAllDepartments}
                collapseAllDepartments={collapseAllDepartments}
                refreshCounter={refreshCounter}
              />
            </div>

            {/* Пагинация в самом низу страницы */}
            {totalPages > 1 && (
              <div
                className={cn(
                  "flex justify-center items-center py-4 border-t",
                  theme === "dark" ? "bg-slate-900 border-slate-700" : "bg-white border-slate-200"
                )}
              >
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={handlePageChange}
                  theme={theme}
                />
              </div>
            )}
          </>
        )}
      </div>



      {/* Панель информации о разделе */}
      {showSectionPanel && selectedSectionId && (
        <SectionPanel
          isOpen={showSectionPanel}
          onClose={handleCloseSectionPanel}
          sectionId={selectedSectionId}
          initialTab={initialSectionTab}
          statuses={statuses}
        />
      )}
    </div>
  )
}
