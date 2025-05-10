"use client"

import { useRoadmap } from "../../context/roadmap-context"
import { cn } from "@/lib/utils"
import { useMemo, useCallback } from "react"
import { BarChart2, BarChart3, UserCircle, ChevronLeft, ChevronRight, ChevronsUp } from "lucide-react"
import { ProjectFilterPopover } from "@/components/project-filter-popover"
import { DetailFilterPopover, type DetailFilterState } from "@/components/detail-filter-popover"
import type { Project } from "@/types/project-types"
import { useTheme } from "next-themes"

// Import the new components at the top of the file
import { ModeSwitcher, type ViewMode } from "@/components/mode-switcher"
import { ModeSelector } from "@/components/mode-selector"

// Add viewMode, selectedModeId, onModeChange, and onModeSelect to the interface
interface CombinedHeaderProps {
  sidebarWidth?: number
  userRole?: string
  responsibleColumnWidth?: number
  isResponsibleColumnCollapsed?: boolean
  toggleResponsibleColumn?: () => void
  projects: Project[]
  selectedProjectIds: string[]
  onProjectsChange: (projectIds: string[]) => void
  detailFilters: DetailFilterState
  onDetailFiltersChange: (filters: DetailFilterState) => void
  viewMode?: ViewMode
  selectedModeId?: string | null
  onModeChange?: (mode: ViewMode) => void
  onModeSelect?: (id: string) => void
}

// Add default values for the new props in the function parameters
export function CombinedHeader({
  sidebarWidth = 264,
  userRole = "Пользователь",
  responsibleColumnWidth = 200,
  isResponsibleColumnCollapsed = false,
  toggleResponsibleColumn = () => {},
  projects,
  selectedProjectIds,
  onProjectsChange,
  detailFilters,
  onDetailFiltersChange,
  viewMode = "manager",
  selectedModeId = null,
  onModeChange = () => {},
  onModeSelect = () => {},
}: CombinedHeaderProps) {
  const {
    workingDays,
    monthGroups,
    CELL_WIDTH,
    showPlanCharts,
    showFactCharts,
    togglePlanCharts,
    toggleFactCharts,
    collapseAllSections,
  } = useRoadmap()

  // Используем хук useTheme для реактивного отслеживания темы
  const { resolvedTheme } = useTheme()
  const isDarkTheme = resolvedTheme === "dark"

  // Получаем выбранные проекты
  const selectedProjects = useMemo(() => {
    return projects.filter((project) => selectedProjectIds.includes(project.id))
  }, [projects, selectedProjectIds])

  // Memoize month groups rendering
  const monthGroupsElements = useMemo(() => {
    return monthGroups.map((group, index) => (
      <div
        key={index}
        className="font-medium text-center border-r border-slate-200 dark:border-slate-800 flex items-center justify-center"
        style={{
          width: `${group.days * CELL_WIDTH}px`,
          backgroundColor: "var(--background)", // Используем CSS переменную для поддержки темной темы
          height: "32px", // Уменьшено с 40px до 32px, чтобы соответствовать панели инструментов
        }}
      >
        <span className="text-slate-700 dark:text-slate-300 font-semibold capitalize text-sm">
          {group.month.charAt(0).toUpperCase() + group.month.slice(1)}
        </span>
      </div>
    ))
  }, [monthGroups, CELL_WIDTH])

  // Memoize day cells rendering
  const dayCells = useMemo(() => {
    return workingDays.map((day, index) => {
      const isWeekend = day.getDay() === 0 || day.getDay() === 6
      const isToday = new Date().toDateString() === day.toDateString()

      return (
        <div
          key={index}
          className={cn(
            "text-center text-xs border-r border-slate-200 dark:border-slate-800 flex items-center justify-center py-1",
            isWeekend ? "bg-slate-50 dark:bg-slate-800/50" : "",
            isToday ? "bg-primary/5 dark:bg-primary/10" : "",
          )}
          style={{ width: `${CELL_WIDTH}px`, minWidth: `${CELL_WIDTH}px` }}
        >
          <span
            className={cn(
              "rounded-full w-6 h-6 flex items-center justify-center",
              isToday ? "bg-primary text-white" : "",
            )}
          >
            {day.getDate()}
          </span>
        </div>
      )
    })
  }, [workingDays, CELL_WIDTH])

  // Use callbacks for toggle functions
  const handleTogglePlanCharts = useCallback(() => {
    togglePlanCharts()
  }, [togglePlanCharts])

  const handleToggleFactCharts = useCallback(() => {
    toggleFactCharts()
  }, [toggleFactCharts])

  // Обработчик для сворачивания всех разделов
  const handleCollapseAll = useCallback(() => {
    if (collapseAllSections) {
      collapseAllSections()
    }
  }, [collapseAllSections])

  return (
    <div className="border-b border-slate-200 dark:border-slate-800">
      {/* Compact header with months in one row */}
      <div className="flex bg-white dark:bg-slate-900 items-center">
        <div
          className="py-1 px-3 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
          style={{ width: `${sidebarWidth}px`, minWidth: `${sidebarWidth}px`, height: "32px" }}
        >
          <div className="flex items-center h-full">
            {/* Фильтры проектов и деталей */}
            <div className="flex items-center gap-2">
              <ProjectFilterPopover
                projects={projects}
                selectedProjects={selectedProjectIds}
                onProjectsChange={onProjectsChange}
              />
              <DetailFilterPopover
                currentFilters={detailFilters}
                onFilterChange={onDetailFiltersChange}
                selectedProjects={selectedProjects}
              />

              {/* Mode switcher and selector */}
              <div className="flex items-center gap-1">
                <ModeSwitcher mode={viewMode} onChange={onModeChange} />
                <ModeSelector mode={viewMode} selectedId={selectedModeId} onSelect={onModeSelect} />
              </div>
            </div>
          </div>
        </div>

        {/* Заголовок столбца ответственных и отделов */}
        <div
          className="py-1 px-2 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between"
          style={{ width: `${responsibleColumnWidth}px`, minWidth: `${responsibleColumnWidth}px`, height: "32px" }}
        >
          <div className="flex items-center">
            {isResponsibleColumnCollapsed ? (
              <div className="flex">
                <UserCircle size={14} className="text-slate-500 dark:text-slate-400" />
              </div>
            ) : (
              <>
                <UserCircle size={14} className="text-slate-500 dark:text-slate-400 mr-1" />
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Ответственные</span>
              </>
            )}
          </div>
          <button
            onClick={toggleResponsibleColumn}
            className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors"
            title={isResponsibleColumnCollapsed ? "Развернуть" : "Свернуть"}
          >
            {isResponsibleColumnCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>

        <div className="flex-1 flex">{monthGroupsElements}</div>
      </div>

      {/* Дни */}
      <div className="flex bg-white dark:bg-slate-900">
        <div
          className="bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800"
          style={{ width: `${sidebarWidth}px`, minWidth: `${sidebarWidth}px`, position: "relative", zIndex: 1 }}
        >
          {/* Улучшенная композиция для панели инструментов */}
          <div className="flex items-center p-2 text-xs">
            <div className="flex items-center bg-slate-50 dark:bg-slate-800 rounded-lg px-2 py-1 border border-slate-200 dark:border-slate-700 w-full">
              <span className="text-slate-600 dark:text-slate-400 font-medium whitespace-nowrap">
                {workingDays.length} дней
              </span>

              <div className="h-4 mx-2 w-px bg-slate-300 dark:bg-slate-700"></div>

              <div className="flex items-center gap-2">
                <button
                  className={`p-1 rounded hover:bg-white dark:hover:bg-slate-700 transition-colors ${showPlanCharts ? "text-blue-500" : "text-slate-400 dark:text-slate-500"}`}
                  title={showPlanCharts ? "Скрыть графики плана" : "Показать графики плана"}
                  onClick={handleTogglePlanCharts}
                >
                  <BarChart2 size={14} />
                </button>
                <button
                  className={`p-1 rounded hover:bg-white dark:hover:bg-slate-700 transition-colors ${showFactCharts ? "text-orange-500" : "text-slate-400 dark:text-slate-500"}`}
                  title={showFactCharts ? "Скрыть графики факта" : "Показать графики факта"}
                  onClick={handleToggleFactCharts}
                >
                  <BarChart3 size={14} />
                </button>
                <button
                  className="p-1 rounded hover:bg-white dark:hover:bg-slate-700 transition-colors text-slate-500 dark:text-slate-400"
                  title="Свернуть все разделы"
                  onClick={handleCollapseAll}
                >
                  <ChevronsUp size={14} />
                </button>
              </div>

              <div className="flex-1"></div>
            </div>
          </div>
        </div>

        {/* Заголовок столбца ответственных и отделов */}
        <div
          className="bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex items-center justify-start pl-2"
          style={{ width: `${responsibleColumnWidth}px`, minWidth: `${responsibleColumnWidth}px` }}
        >
          {/* Пустой блок для столбца ответственных */}
        </div>

        <div className="flex-1 flex">{dayCells}</div>
      </div>
    </div>
  )
}

