"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, Calendar, ChevronsLeft, ChevronsRight } from "lucide-react"
import { RoadmapProvider } from "./context/roadmap-context"
import { CombinedHeader } from "./components/headers/combined-header"
import { SectionsList } from "./components/sections/sections-list"
import { DepartmentEmployeeTimeline } from "@/components/department-employee-timeline"
import type { Project, Loading, SectionResponsible, Department } from "@/types/project-types"
import type { DetailFilterState } from "@/components/detail-filter-popover"
// Import the ViewMode type
import type { ViewMode } from "@/components/mode-switcher"

// Add the new props to the interface
interface RoadmapProps {
  project: Project
  expandedSections: Record<string, boolean>
  onToggleSection: (sectionId: string) => void
  onAddLoading: (taskId: string) => void
  onEditLoading?: (loading: Loading, taskId: string) => void
  onResponsibleChange?: (sectionId: string, responsible: SectionResponsible) => void
  onDepartmentChange?: (sectionId: string, department: Department) => void
  projects: Project[]
  selectedProjectIds: string[]
  onProjectsChange: (projectIds: string[]) => void
  detailFilters: DetailFilterState
  onDetailFiltersChange: (filters: DetailFilterState) => void
  userRole: string
  onCollapseAll?: () => void
  viewMode?: ViewMode
  selectedModeId?: string | null
  onModeChange?: (mode: ViewMode) => void
  onModeSelect?: (id: string) => void
}

// Add the new props to the function parameters with default values
export function Roadmap({
  project,
  expandedSections,
  onToggleSection,
  onAddLoading,
  onEditLoading = () => {},
  onResponsibleChange,
  onDepartmentChange,
  projects,
  selectedProjectIds,
  onProjectsChange,
  detailFilters,
  onDetailFiltersChange,
  userRole,
  onCollapseAll,
  viewMode = "manager",
  selectedModeId = null,
  onModeChange = () => {},
  onModeSelect = () => {},
}: RoadmapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [allDays, setAllDays] = useState<Date[]>([])
  const [visibleDays, setVisibleDays] = useState<Date[]>([])
  const [currentStartIndex, setCurrentStartIndex] = useState(() => {
    // Default to 10 days before current date
    const today = new Date()
    const tenDaysAgo = new Date(today)
    tenDaysAgo.setDate(today.getDate() - 10)
    return 0 // This will be updated when allDays is populated
  })
  const [daysToShow, setDaysToShow] = useState(30) // Начальное значение, будет пересчитано
  const CELL_WIDTH = 25 // Ширина ячейки в пикселях

  // State for resizable sidebar
  const sidebarWidth = 264 // Fixed width

  // State for chart visibility
  const [showPlanCharts, setShowPlanCharts] = useState(true)
  const [showFactCharts, setShowFactCharts] = useState(true)

  // Добавим состояние для отслеживания, свернут ли столбец ответственного
  const [isResponsibleColumnCollapsed, setIsResponsibleColumnCollapsed] = useState(false)

  // Toggle functions for chart visibility - use useCallback to prevent unnecessary re-renders
  const togglePlanCharts = useCallback(() => setShowPlanCharts((prev) => !prev), [])
  const toggleFactCharts = useCallback(() => setShowFactCharts((prev) => !prev), [])

  // Добавим функцию для переключения состояния столбца
  const toggleResponsibleColumn = useCallback(() => {
    setIsResponsibleColumnCollapsed((prev) => !prev)
  }, [])

  // Функция для сворачивания всех разделов
  const collapseAllSections = useCallback(() => {
    if (onCollapseAll) {
      onCollapseAll()
    }
  }, [onCollapseAll])

  // Memoize the earliest date calculation to prevent recalculation on every render
  const earliestDate = useMemo(() => {
    if (!project) return new Date()

    let earliest: Date | null = null

    project.sections.forEach((section) => {
      // Check if section has tasks
      if (section.tasks) {
        section.tasks.forEach((task) => {
          task.loadings.forEach((loading) => {
            if (!earliest || loading.date_start < earliest) {
              earliest = new Date(loading.date_start)
            }
          })
        })
      }
    })

    // If no loadings, use current month
    if (!earliest) {
      const today = new Date()
      earliest = new Date(today.getFullYear(), today.getMonth(), 1)
    }

    return earliest
  }, [project])

  // Инициализация всех дат при первой загрузке
  useEffect(() => {
    if (project) {
      // Устанавливаем конечную дату на конец года
      const currentYear = new Date().getFullYear()
      const endDate = new Date(currentYear, 11, 31) // 31 декабря текущего года

      // Получаем все рабочие дни в диапазоне
      const days: Date[] = []
      const currentDate = new Date(earliestDate)

      while (currentDate <= endDate) {
        days.push(new Date(currentDate))
        currentDate.setDate(currentDate.getDate() + 1)
      }

      setAllDays(days)

      // Calculate the index for 10 days before today
      const today = new Date()
      const tenDaysAgo = new Date(today)
      tenDaysAgo.setDate(today.getDate() - 10)

      // Find the closest index to tenDaysAgo
      const startIndex = Math.max(
        0,
        days.findIndex((day) => day >= tenDaysAgo),
      )
      setCurrentStartIndex(startIndex)
    }
  }, [project, earliestDate])

  // Расчет количества дней для отображения на основе ширины контейнера
  useEffect(() => {
    function calculateVisibleDays() {
      if (containerRef.current && allDays.length > 0) {
        // Получаем ширину контейнера
        const containerWidth = containerRef.current.clientWidth
        // Вычитаем ширину левой панели
        const availableWidth = containerWidth - sidebarWidth
        // Рассчитываем, сколько дней можем показать
        const calculatedDaysToShow = Math.floor(availableWidth / CELL_WIDTH)
        // Устанавливаем минимум 7 дней и максимум - все доступные дни
        const newDaysToShow = Math.max(7, Math.min(calculatedDaysToShow, allDays.length))

        setDaysToShow(newDaysToShow)

        // Обновляем видимые дни
        const endIndex = Math.min(currentStartIndex + newDaysToShow, allDays.length)
        setVisibleDays(allDays.slice(currentStartIndex, endIndex))
      }
    }

    calculateVisibleDays()

    // Добавляем слушатель изменения размера окна
    window.addEventListener("resize", calculateVisibleDays)

    return () => {
      window.removeEventListener("resize", calculateVisibleDays)
    }
  }, [allDays, currentStartIndex, CELL_WIDTH, sidebarWidth])

  // Функция для навигации по датам - use useCallback to prevent unnecessary re-renders
  const navigateDates = useCallback(
    (direction: "prev" | "next" | "prevMonth" | "nextMonth" | "today") => {
      if (allDays.length === 0) return

      let newStartIndex = currentStartIndex

      if (direction === "prev") {
        // Перемещаемся на 10 дней назад
        newStartIndex = Math.max(0, currentStartIndex - 10)
      } else if (direction === "next") {
        // Перемещаемся на 10 дней вперед
        newStartIndex = Math.min(allDays.length - daysToShow, currentStartIndex + 10)
      } else if (direction === "prevMonth") {
        // Перемещаемся на месяц назад (примерно 30 дней)
        newStartIndex = Math.max(0, currentStartIndex - 30)
      } else if (direction === "nextMonth") {
        // Перемещаемся на месяц вперед (примерно 30 дней)
        newStartIndex = Math.min(allDays.length - daysToShow, currentStartIndex + 30)
      } else if (direction === "today") {
        // Перемещаемся к текущей дате
        const today = new Date()
        const todayIndex = allDays.findIndex((day) => day.toDateString() === today.toDateString())
        if (todayIndex !== -1) {
          // Центрируем текущую дату в видимой области
          newStartIndex = Math.max(0, Math.min(allDays.length - daysToShow, todayIndex - Math.floor(daysToShow / 2)))
        }
      }

      setCurrentStartIndex(newStartIndex)
    },
    [allDays.length, currentStartIndex, daysToShow],
  )

  // Проверка возможности навигации
  const canNavigatePrev = currentStartIndex > 0
  const canNavigateNext = currentStartIndex < allDays.length - daysToShow

  // Get current visible date range for display
  const dateRangeText = useMemo(() => {
    if (visibleDays.length === 0) return ""

    const startDate = visibleDays[0]
    const endDate = visibleDays[visibleDays.length - 1]

    // Format dates for display
    const formatOptions: Intl.DateTimeFormatOptions = {
      day: "numeric",
      month: "short",
      year: "numeric",
    }

    return `${startDate.toLocaleDateString("ru-RU", formatOptions)} - ${endDate.toLocaleDateString("ru-RU", formatOptions)}`
  }, [visibleDays])

  if (!project) {
    return <div className="p-4 text-center">Loading roadmap data...</div>
  }

  // Обновим константу для ширины столбца ответственного
  const responsibleColumnWidth = isResponsibleColumnCollapsed ? 50 : 200

  // Create a modified project with stages for backward compatibility
  const projectWithStages = {
    ...project,
    sections: project.sections.map((section) => {
      // Create stages from tasks for backward compatibility
      const stages = section.tasks
        ? section.tasks.map((task) => ({
            id: task.id,
            name: task.name,
            loadings: task.loadings.map((loading) => ({
              ...loading,
              stageId: task.id,
              executorId: loading.user_id, // For backward compatibility
            })),
          }))
        : []

      return {
        ...section,
        stages: stages,
      }
    }),
  }

  // Убираем отступы и границы в компоненте Roadmap
  return (
    <RoadmapProvider
      project={projectWithStages}
      expandedSections={expandedSections}
      onToggleSection={onToggleSection}
      onAddLoading={onAddLoading}
      onEditLoading={onEditLoading}
      visibleDays={visibleDays}
      allDays={allDays}
      sidebarWidth={sidebarWidth}
      showPlanCharts={showPlanCharts}
      showFactCharts={showFactCharts}
      togglePlanCharts={togglePlanCharts}
      toggleFactCharts={toggleFactCharts}
      responsibleColumnWidth={responsibleColumnWidth}
      isResponsibleColumnCollapsed={isResponsibleColumnCollapsed}
      toggleResponsibleColumn={toggleResponsibleColumn}
      collapseAllSections={collapseAllSections}
    >
      <div className="relative w-full h-full bg-white dark:bg-slate-900" ref={containerRef}>
        <div className="min-w-[800px] bg-white dark:bg-slate-900 overflow-hidden relative">
          <CombinedHeader
            sidebarWidth={sidebarWidth}
            userRole={userRole}
            responsibleColumnWidth={responsibleColumnWidth}
            isResponsibleColumnCollapsed={isResponsibleColumnCollapsed}
            toggleResponsibleColumn={toggleResponsibleColumn}
            projects={projects}
            selectedProjectIds={selectedProjectIds}
            onProjectsChange={onProjectsChange}
            detailFilters={detailFilters}
            onDetailFiltersChange={onDetailFiltersChange}
            viewMode={viewMode}
            selectedModeId={selectedModeId}
            onModeChange={onModeChange}
            onModeSelect={onModeSelect}
          />

          <div className="relative">
            <div className="flex">
              {/* Левая панель с задачами */}
              <div
                className="bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800"
                style={{
                  width: `${sidebarWidth}px`,
                  minWidth: `${sidebarWidth}px`,
                  position: "relative",
                  zIndex: 1,
                }}
              >
                {/* Пустой элемент для левой панели */}
              </div>

              {/* Столбец ответственных */}
              <div
                className="bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800"
                style={{
                  width: `${responsibleColumnWidth}px`,
                  minWidth: `${responsibleColumnWidth}px`,
                  position: "relative",
                  zIndex: 1,
                }}
              >
                {/* Пустой элемент для столбца ответственных */}
              </div>

              {/* Правая панель с графиками */}
              <div className="flex-1 bg-white dark:bg-slate-900">{/* Пустой элемент для правой панели */}</div>
            </div>

            {/* Простой разделитель без возможности изменения размера */}
            <div
              className="absolute top-0 bottom-0 z-10"
              style={{
                left: `${sidebarWidth + responsibleColumnWidth}px`,
                width: "1px",
                background: "var(--border)",
              }}
            />

            <SectionsList
              onResponsibleChange={onResponsibleChange}
              onDepartmentChange={onDepartmentChange}
              projectName={project.name}
            />

            {/* Добавляем компонент таблицы загрузки сотрудников отдела */}
            {viewMode === "department" && <DepartmentEmployeeTimeline departmentId={selectedModeId} />}

            {/* Floating timeline navigation */}
            <div className="fixed bottom-8 right-8 z-50">
              <div className="flex bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 rounded-none border-r border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-primary"
                  onClick={() => navigateDates("prevMonth")}
                  disabled={!canNavigatePrev}
                >
                  <ChevronsLeft className="h-4 w-4" />
                  <span className="sr-only">Предыдущий месяц</span>
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 rounded-none border-r border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-primary"
                  onClick={() => navigateDates("prev")}
                  disabled={!canNavigatePrev}
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span className="sr-only">Предыдущие 10 дней</span>
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-3 rounded-none border-r border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-primary"
                  onClick={() => navigateDates("today")}
                >
                  <Calendar className="h-4 w-4 mr-1" />
                  <span className="text-xs">Сегодня</span>
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 rounded-none border-r border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-primary"
                  onClick={() => navigateDates("next")}
                  disabled={!canNavigateNext}
                >
                  <ChevronRight className="h-4 w-4" />
                  <span className="sr-only">Следующие 10 дней</span>
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 rounded-none text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-primary"
                  onClick={() => navigateDates("nextMonth")}
                  disabled={!canNavigateNext}
                >
                  <ChevronsRight className="h-4 w-4" />
                  <span className="sr-only">Следующий месяц</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </RoadmapProvider>
  )
}

