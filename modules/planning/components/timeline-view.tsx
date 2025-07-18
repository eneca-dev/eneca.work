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
// Заменяем FiltersPanel на TimelineFilters
import { TimelineFilters } from "../filters/TimelineFilters"
import { TimelineHeaderTabs } from "./timeline/timeline-header-tabs"
import { useTheme } from "next-themes"
import { useSettingsStore } from "@/stores/useSettingsStore"
import { ColumnVisibilityMenu } from "./timeline/column-visibility-menu"
import { PermissionBadge } from "./permission-badge"
import { Button } from "@/components/ui/button"
import { SectionPanel } from "@/components/modals"

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

  const { permissions } = useUserStore()

  // Используем тему из useSettingsStore
  const { theme: storeTheme } = useSettingsStore()
  const { resolvedTheme } = useTheme()
  const theme = storeTheme === "system" ? resolvedTheme || "light" : storeTheme

  const { setLoading } = useUiStore()

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

  // Загружаем проекты и отделы при монтировании компонента
  useEffect(() => {
    fetchSections()
  }, [fetchSections])

  // Применяем фильтры при их изменении или при монтировании компонента
  useEffect(() => {
    // Устанавливаем состояние загрузки перед применением фильтров
    setLoading(true)

    // Применяем фильтры из нового стора
    setFilters(selectedProjectId, selectedDepartmentId, selectedTeamId, selectedManagerId, selectedEmployeeId, selectedStageId, selectedObjectId)

    // Сбрасываем состояние загрузки после небольшой задержки
    const timer = setTimeout(() => setLoading(false), 300)
    return () => clearTimeout(timer)
  }, [selectedProjectId, selectedDepartmentId, selectedTeamId, selectedEmployeeId, selectedManagerId, selectedStageId, selectedObjectId, setFilters, setLoading])

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
  const handleOpenSectionPanel = (sectionId: string) => {
    setSelectedSectionId(sectionId)
    setShowSectionPanel(true)
  }

  // Обработчик закрытия SectionPanel
  const handleCloseSectionPanel = () => {
    setShowSectionPanel(false)
    setSelectedSectionId(null)
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
        "font-sans overflow-x-hidden",
      )}
      ref={containerRef}
    >
      {/* Header with improved styling */}
      <header className="flex justify-between items-center mb-6">
        <TimelineHeaderTabs
          theme={theme}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onTodayClick={handleTodayPeriod}
        />
      </header>

      {/* Панель фильтров всегда отображается */}
      <div className="mb-6" id="filters-container">
        <TimelineFilters
          onProjectChange={handleProjectChange}
          onDepartmentChange={handleDepartmentChange}
          onTeamChange={handleTeamChange}
          onEmployeeChange={handleEmployeeChange}
          onManagerChange={handleManagerChange}
          onStageChange={handleStageChange}
          onObjectChange={handleObjectChange}
          onResetFilters={handleResetFilters}
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={handlePageChange}
          onScrollBackward={scrollBackward}
          onScrollForward={scrollForward}
          startDate={startDate}
          daysToShow={daysToShow}
          onTodayClick={handleTodayPeriod}
        />
      </div>

      {/* Main content area with improved styling - new approach with fixed columns */}
      <div
        className={cn(
          "w-full border overflow-hidden relative overflow-y-auto rounded-lg",
          theme === "dark" ? "bg-slate-900 border-slate-700" : "bg-white border-slate-200",
        )}
        style={{ 
          height: "calc(100vh - 180px)", 
          borderCollapse: "collapse" 
        }}
      >
        {isLoadingSections ? (
          <div className="flex justify-center items-center p-8">
            <Loader2 className={cn("h-8 w-8 animate-spin", "text-teal-500")} />
          </div>
        ) : (
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
            />
          </div>
        )}
      </div>



      {/* Панель информации о разделе */}
      {showSectionPanel && selectedSectionId && (
        <SectionPanel
          isOpen={showSectionPanel}
          onClose={handleCloseSectionPanel}
          sectionId={selectedSectionId}
        />
      )}
    </div>
  )
}
