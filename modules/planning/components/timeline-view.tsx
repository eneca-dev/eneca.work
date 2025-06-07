"use client"
import { Loader2 } from "lucide-react"
// Импортируем сторы напрямую из их файлов
import { usePlanningStore } from "../stores/usePlanningStore"
import { usePlanningFiltersStore } from "../stores/usePlanningFiltersStore"
import { usePlanningViewStore } from "../stores/usePlanningViewStore"
import { useUserStore } from "@/stores/useUserStore"
import { useUiStore } from "@/stores/useUiStore"
import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { TimelineGrid } from "./timeline-grid"
import { FiltersPanel } from "./timeline/filters-panel"
import { NavigationControls } from "./timeline/navigation-controls"
import { TimelineHeaderTabs } from "./timeline/timeline-header-tabs"
import { Pagination } from "./pagination"
import { useTheme } from "next-themes"
import { useSettingsStore } from "@/stores/useSettingsStore"
import { ColumnVisibilityMenu } from "./timeline/column-visibility-menu"
import { PermissionBadge } from "./permission-badge"
import { Button } from "@/components/ui/button"



export function TimelineView() {
  // Получаем состояние и действия из стора фильтров
  const {
    selectedProjectId,
    selectedDepartmentId,
    selectedTeamId,
    selectedManagerId, // Добавляем выбранного менеджера
    setSelectedProject,
    setSelectedDepartment,
    setSelectedTeam,
    setSelectedManager,
    resetFilters,
    fetchFilterOptions,
  } = usePlanningFiltersStore()

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

  // Количество активных фильтров
  const activeFiltersCount = [selectedProjectId, selectedDepartmentId, selectedTeamId, selectedManagerId].filter(Boolean).length

  // Проверяем, есть ли активные фильтры
  const hasActiveFilters = activeFiltersCount > 0

  // Загружаем проекты и отделы при монтировании компонента
  useEffect(() => {
    fetchFilterOptions()
  }, [fetchFilterOptions])

  // Применяем фильтры при их изменении или при монтировании компонента
  useEffect(() => {
    // Устанавливаем состояние загрузки перед применением фильтров
    setLoading(true)

    // Применяем фильтры, включая команду
    setFilters(selectedProjectId, selectedDepartmentId, selectedTeamId, selectedManagerId)

    // Сбрасываем состояние загрузки после небольшой задержки
    const timer = setTimeout(() => setLoading(false), 300)
    return () => clearTimeout(timer)
  }, [selectedProjectId, selectedDepartmentId, selectedTeamId, selectedManagerId, setFilters, setLoading])

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
    setSelectedProject(projectId)
  }

  const handleDepartmentChange = (departmentId: string | null) => {
    console.log("Изменение отдела:", departmentId)
    setSelectedDepartment(departmentId)
  }

  const handleTeamChange = (teamId: string | null) => {
    console.log("Изменение команды:", teamId)
    setSelectedTeam(teamId)
  }

// Добавляем обработчик для менеджера
 const handleManagerChange = async (managerId: string | null) => {
   console.log("Изменение менеджера:", managerId)
   try {
     await setSelectedManager(managerId)
   } catch (error) {
     console.error("Error setting selected manager:", error)
     // Optionally show user-friendly error message
   }
 }

  const handleResetFilters = () => {
    console.log("Сброс фильтров")
    resetFilters()
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
      <FiltersPanel
        theme={theme}
        onProjectChange={handleProjectChange}
        onDepartmentChange={handleDepartmentChange}
        onTeamChange={handleTeamChange}
        onManagerChange={handleManagerChange}
        onResetFilters={handleResetFilters}
        showDepartments={showDepartments}
        toggleShowDepartments={toggleShowDepartments}
        expandAllDepartments={expandAllDepartments}
        collapseAllDepartments={collapseAllDepartments}
      />

      {/* Перемещаем пагинацию наверх, рядом с блоком дат */}
      <div className="flex justify-between items-center mb-4">
        {/* Пустое место слева */}
        <div></div>

        {/* Пагинация теперь здесь, в центре */}
        {totalPages > 1 && (
          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={handlePageChange} theme={theme} />
        )}

        {/* Блок с датами справа */}
        <NavigationControls
          theme={theme}
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
          "w-full border overflow-hidden relative overflow-y-auto",
          theme === "dark" ? "bg-slate-900 border-slate-700" : "bg-white border-slate-200",
        )}
        style={{ height: "calc(100vh - 250px)", borderCollapse: "collapse" }}
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
            />
          </div>
        )}
      </div>
    </div>
  )
}
