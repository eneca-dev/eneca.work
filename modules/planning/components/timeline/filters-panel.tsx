"use client"

import { cn } from "@/lib/utils"
import { X, ChevronDown, ChevronRight } from "lucide-react"
import { usePlanningFiltersStore } from "../../stores/usePlanningFiltersStore"
import { useEffect, useState } from "react"
import { ColumnVisibilityMenu } from "./column-visibility-menu"
// Импортируем функцию fetchProjectObjects
import { fetchProjectObjects } from "@/lib/supabase-client"

interface FiltersPanelProps {
  theme: string
  onProjectChange: (projectId: string | null) => void
  onDepartmentChange: (departmentId: string | null) => void
  onTeamChange: (teamId: string | null) => void
  onManagerChange: (managerId: string | null) => void
  onObjectChange?: (objectId: string | null) => void // Make optional
  onStageChange?: (stageId: string | null) => void // Add stage change handler
  onResetFilters: () => void
  showDepartments: boolean
  toggleShowDepartments: () => void
  expandAllDepartments: () => void
  collapseAllDepartments: () => void
}

// Define Object interface
interface ProjectObject {
  id: string
  name: string
  projectId: string
}

// Define Stage interface
interface Stage {
  id: string
  name: string
  description?: string
  projectId: string
}

export function FiltersPanel({
  theme,
  onProjectChange,
  onDepartmentChange,
  onTeamChange,
  onManagerChange,
  onObjectChange,
  onStageChange,
  onResetFilters,
  showDepartments,
  toggleShowDepartments,
  expandAllDepartments,
  collapseAllDepartments,
}: FiltersPanelProps) {
  // Local state for objects since they're not in the store yet
  const [availableObjects, setAvailableObjects] = useState<ProjectObject[]>([])
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null)
  const [isLoadingObjects, setIsLoadingObjects] = useState(false)
  
  // Remove local state for stages - use store instead
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null)

  // Получаем данные из стора фильтров
  const {
    availableProjects,
    availableManagers,
    availableDepartments,
    availableTeams,
    availableStages, // Use stages from store
    selectedProjectId,
    selectedDepartmentId,
    selectedTeamId,
    selectedManagerId,
    isLoading,
    isLoadingManagerProjects,
    isLoadingStages, // Use loading state from store
    fetchFilterOptions,
    getFilteredProjects,
    getFilteredStages, // Add this to get filtered stages
    fetchProjectStages,
  } = usePlanningFiltersStore()

  // Загружаем опции фильтров при монтировании компонента
  useEffect(() => {
    fetchFilterOptions()
  }, [fetchFilterOptions])

  // Загружаем этапы при изменении выбранного проекта
  useEffect(() => {
    if (selectedProjectId) {
      console.log("FiltersPanel: начинаем загрузку этапов для проекта", selectedProjectId)
      // Сбрасываем выбранный этап и объект при смене проекта
      setSelectedStageId(null)
      setSelectedObjectId(null)
      setAvailableObjects([]) // Очищаем объекты при смене проекта

      // Загружаем этапы из стора
      fetchProjectStages(selectedProjectId)
        .then(() => {
          console.log("FiltersPanel: этапы успешно загружены из стора")
        })
        .catch((error) => {
          console.error("FiltersPanel: ошибка при загрузке этапов:", error)
        })
    } else {
      // Очищаем этапы и объекты, если проект не выбран
      console.log("FiltersPanel: очищаем этапы и объекты, проект не выбран")
      setSelectedStageId(null)
      setAvailableObjects([])
      setSelectedObjectId(null)
    }
  }, [selectedProjectId, fetchProjectStages])

  // Загружаем объекты при изменении выбранного этапа
  useEffect(() => {
    if (selectedStageId) {
      console.log("FiltersPanel: начинаем загрузку объектов для этапа", selectedStageId)
      setIsLoadingObjects(true)
      // Сбрасываем выбранный объект при смене этапа
      setSelectedObjectId(null)

      // Создаем AbortController для отмены запроса
      const abortController = new AbortController()

      // Здесь нужно будет создать функцию fetchStageObjects
      // Пока используем fetchProjectObjects как заглушку
      fetchProjectObjects(selectedProjectId!, abortController.signal)
        .then((objects) => {
          // Проверяем, не была ли операция отменена
          if (abortController.signal.aborted) {
            console.log("FiltersPanel: загрузка объектов отменена для этапа", selectedStageId)
            return
          }
          
          console.log("FiltersPanel: получен результат загрузки объектов для этапа:", {
            stageId: selectedStageId,
            isArray: Array.isArray(objects),
            objectsCount: Array.isArray(objects) ? objects.length : 0,
            result: objects
          })
          
          // Проверяем, что результат не является ошибкой
          if (Array.isArray(objects)) {
            // Фильтруем объекты по этапу (пока используем все объекты)
            setAvailableObjects(objects)
            console.log("FiltersPanel: объекты этапа успешно загружены:", objects.map(obj => obj.name))
          } else {
            console.error("FiltersPanel: ошибка при загрузке объектов этапа:", {
              stageId: selectedStageId,
              error: objects.error,
              details: objects.details
            })
            setAvailableObjects([])
          }
          setIsLoadingObjects(false)
        })
        .catch((error) => {
          // Проверяем, не была ли операция отменена
          if (abortController.signal.aborted) {
            console.log("FiltersPanel: загрузка объектов отменена (catch) для этапа", selectedStageId)
            return
          }
          
          console.error("FiltersPanel: исключение при загрузке объектов этапа:", {
            stageId: selectedStageId,
            error,
            errorName: error instanceof Error ? error.name : 'Unknown',
            errorMessage: error instanceof Error ? error.message : String(error),
            errorStack: error instanceof Error ? error.stack : undefined
          })
          setAvailableObjects([])
          setIsLoadingObjects(false)
        })

      // Функция очистки для отмены запроса
      return () => {
        console.log("FiltersPanel: отменяем загрузку объектов для этапа", selectedStageId)
        abortController.abort()
      }
    } else {
      // Очищаем объекты, если этап не выбран
      console.log("FiltersPanel: очищаем объекты, этап не выбран")
      setAvailableObjects([])
      setSelectedObjectId(null)
    }
  }, [selectedStageId, selectedProjectId])

  // Получаем отфильтрованные этапы для выбранного проекта
  const filteredStages = getFilteredStages()

  // Добавляем логирование для отладки
  useEffect(() => {
    console.log("FiltersPanel: состояние этапов изменилось:", {
      selectedProjectId,
      availableStagesCount: availableStages.length,
      filteredStagesCount: filteredStages.length,
      isLoadingStages,
      availableStages: availableStages.map(s => ({ id: s.id, name: s.name, projectId: s.projectId })),
      filteredStages: filteredStages.map(s => ({ id: s.id, name: s.name, projectId: s.projectId }))
    })
  }, [selectedProjectId, availableStages, filteredStages, isLoadingStages])

  // Handle stage selection
  const handleStageChange = (stageId: string | null) => {
    setSelectedStageId(stageId)
    if (onStageChange) {
      onStageChange(stageId)
    }
  }

  // Handle object selection
  const handleObjectChange = (objectId: string | null) => {
    setSelectedObjectId(objectId)
    if (onObjectChange) {
      onObjectChange(objectId)
    }
  }

  // Получаем отфильтрованные проекты на основе выбранного менеджера
  const filteredProjects = getFilteredProjects()
  
  // Количество активных фильтров
  const activeFiltersCount = [selectedProjectId, selectedDepartmentId, selectedTeamId, selectedManagerId, selectedStageId, selectedObjectId].filter(
    Boolean,
  ).length

  return (
    <div
      className={cn(
        "p-4 rounded-xl border mb-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-3",
        theme === "dark" ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200",
      )}
    >
      {/* Group for Filter Selects */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {/* Фильтр по менеджерам */}
        <div className="flex-shrink-0 min-w-[200px]">
          <label
            htmlFor="manager-filter"
            className={cn("block text-xs font-medium mb-1", theme === "dark" ? "text-slate-400" : "text-slate-500")}
          >
            Менеджер
          </label>
          <select
            id="manager-filter"
            value={selectedManagerId || ""}
            onChange={(e) => onManagerChange(e.target.value || null)}
            disabled={isLoading || availableManagers.length === 0}
            className={cn(
              "w-full text-sm rounded-md border px-3 py-2 pr-8",
              "appearance-none bg-no-repeat bg-right",
              "bg-[length:16px_16px] bg-[position:right_8px_center]",
              theme === "dark"
                ? "bg-slate-700 border-slate-600 text-slate-200 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTQgNkw4IDEwTDEyIDYiIHN0cm9rZT0iIzk0YTNiOCIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz4KPC9zdmc+')]"
                : "bg-white border-slate-300 text-slate-800 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTQgNkw4IDEwTDEyIDYiIHN0cm9rZT0iIzY0NzQ4YiIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz4KPC9zdmc+')]",
              "focus:outline-none focus:ring-1",
              theme === "dark"
                ? "focus:ring-teal-500 focus:ring-offset-slate-800 focus:ring-offset-1"
                : "focus:ring-teal-500 focus:ring-offset-white focus:ring-offset-1",
              "transition-colors duration-150 ease-in-out",
            )}
          >
            <option value="">Все менеджеры</option>
            {availableManagers.map((manager) => (
              <option key={manager.id} value={manager.id}>
                {manager.name} ({manager.projectsCount || 0} проектов)
              </option>
            ))}
          </select>
        </div>

        {/* Фильтр по проектам */}
        <div className="flex-shrink-0 min-w-[200px]">
          <label
            htmlFor="project-filter"
            className={cn("block text-xs font-medium mb-1", theme === "dark" ? "text-slate-400" : "text-slate-500")}
          >
            Проект
          </label>
          <select
            id="project-filter"
            value={selectedProjectId || ""}
            onChange={(e) => onProjectChange(e.target.value || null)}
            disabled={isLoading || isLoadingManagerProjects || filteredProjects.length === 0}
            className={cn(
              "w-full text-sm rounded-md border px-3 py-2 pr-8",
              "appearance-none bg-no-repeat bg-right",
              "bg-[length:16px_16px] bg-[position:right_8px_center]",
              theme === "dark"
                ? "bg-slate-700 border-slate-600 text-slate-200 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTQgNkw4IDEwTDEyIDYiIHN0cm9rZT0iIzk0YTNiOCIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz4KPC9zdmc+')]"
                : "bg-white border-slate-300 text-slate-800 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTQgNkw4IDEwTDEyIDYiIHN0cm9rZT0iIzY0NzQ4YiIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz4KPC9zdmc+')]",
              "focus:outline-none focus:ring-1",
              theme === "dark"
                ? "focus:ring-teal-500 focus:ring-offset-slate-800 focus:ring-offset-1"
                : "focus:ring-teal-500 focus:ring-offset-white focus:ring-offset-1",
              "transition-colors duration-150 ease-in-out",
            )}
          >
            <option value="">
              {isLoadingManagerProjects
                ? "Загрузка проектов..."
                : selectedManagerId
                  ? "Все проекты менеджера"
                  : "Все проекты"}
            </option>
            {filteredProjects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </div>

        {/* Фильтр по этапам - показывается только при выбранном проекте */}
        {selectedProjectId && (
          <div className="flex-shrink-0 min-w-[200px]">
            <label
              htmlFor="stage-filter"
              className={cn("block text-xs font-medium mb-1", theme === "dark" ? "text-slate-400" : "text-slate-500")}
            >
              Этап
            </label>
            <select
              id="stage-filter"
              value={selectedStageId || ""}
              onChange={(e) => handleStageChange(e.target.value || null)}
              disabled={isLoadingStages}
              className={cn(
                "w-full text-sm rounded-md border px-3 py-2 pr-8",
                "appearance-none bg-no-repeat bg-right",
                "bg-[length:16px_16px] bg-[position:right_8px_center]",
                theme === "dark"
                  ? "bg-slate-700 border-slate-600 text-slate-200 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTQgNkw4IDEwTDEyIDYiIHN0cm9rZT0iIzk0YTNiOCIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz4KPC9zdmc+')]"
                  : "bg-white border-slate-300 text-slate-800 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTQgNkw4IDEwTDEyIDYiIHN0cm9rZT0iIzY0NzQ4YiIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz4KPC9zdmc+')]",
                "focus:outline-none focus:ring-1",
                theme === "dark"
                  ? "focus:ring-teal-500 focus:ring-offset-slate-800 focus:ring-offset-1"
                  : "focus:ring-teal-500 focus:ring-offset-white focus:ring-offset-1",
                "transition-colors duration-150 ease-in-out",
              )}
            >
              <option value="">Все этапы</option>
              {filteredStages.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {stage.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Фильтр по объектам - показывается только при выбранном этапе */}
        {selectedStageId && (
          <div className="flex-shrink-0 min-w-[200px]">
            <label
              htmlFor="object-filter"
              className={cn("block text-xs font-medium mb-1", theme === "dark" ? "text-slate-400" : "text-slate-500")}
            >
              Объект
            </label>
            <select
              id="object-filter"
              value={selectedObjectId || ""}
              onChange={(e) => handleObjectChange(e.target.value || null)}
              disabled={isLoadingObjects}
              className={cn(
                "w-full text-sm rounded-md border px-3 py-2 pr-8",
                "appearance-none bg-no-repeat bg-right",
                "bg-[length:16px_16px] bg-[position:right_8px_center]",
                theme === "dark"
                  ? "bg-slate-700 border-slate-600 text-slate-200 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTQgNkw4IDEwTDEyIDYiIHN0cm9rZT0iIzk0YTNiOCIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz4KPC9zdmc+')]"
                  : "bg-white border-slate-300 text-slate-800 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTQgNkw4IDEwTDEyIDYiIHN0cm9rZT0iIzY0NzQ4YiIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz4KPC9zdmc+')]",
                "focus:outline-none focus:ring-1",
                theme === "dark"
                  ? "focus:ring-teal-500 focus:ring-offset-slate-800 focus:ring-offset-1"
                  : "focus:ring-teal-500 focus:ring-offset-white focus:ring-offset-1",
                "transition-colors duration-150 ease-in-out",
              )}
            >
              <option value="">{isLoadingObjects ? "Загрузка объектов..." : "Все объекты"}</option>
              {availableObjects.map((object) => (
                <option key={object.id} value={object.id}>
                  {object.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Фильтр по отделам */}
        <div className="flex-shrink-0 min-w-[200px]">
          <label
            htmlFor="department-filter"
            className={cn("block text-xs font-medium mb-1", theme === "dark" ? "text-slate-400" : "text-slate-500")}
          >
            Отдел (фильтр)
          </label>
          <select
            id="department-filter"
            value={selectedDepartmentId || ""}
            onChange={(e) => onDepartmentChange(e.target.value || null)}
            disabled={isLoading || availableDepartments.length === 0}
            className={cn(
              "w-full text-sm rounded-md border px-3 py-2 pr-8",
              "appearance-none bg-no-repeat bg-right",
              "bg-[length:16px_16px] bg-[position:right_8px_center]",
              theme === "dark"
                ? "bg-slate-700 border-slate-600 text-slate-200 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTQgNkw4IDEwTDEyIDYiIHN0cm9rZT0iIzk0YTNiOCIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz4KPC9zdmc+')]"
                : "bg-white border-slate-300 text-slate-800 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTQgNkw4IDEwTDEyIDYiIHN0cm9rZT0iIzY0NzQ4YiIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz4KPC9zdmc+')]",
              "focus:outline-none focus:ring-1",
              theme === "dark"
                ? "focus:ring-teal-500 focus:ring-offset-slate-800 focus:ring-offset-1"
                : "focus:ring-teal-500 focus:ring-offset-white focus:ring-offset-1",
              "transition-colors duration-150 ease-in-out",
            )}
          >
            <option value="">Все отделы</option>
            {availableDepartments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </select>
        </div>

        {/* Фильтр по командам - показывается только при выбранном отделе */}
        {selectedDepartmentId && (
          <div className="flex-shrink-0 min-w-[200px]">
            <label
              htmlFor="team-filter"
              className={cn("block text-xs font-medium mb-1", theme === "dark" ? "text-slate-400" : "text-slate-500")}
            >
              Команда
            </label>
            <select
              id="team-filter"
              value={selectedTeamId || ""}
              onChange={(e) => onTeamChange(e.target.value || null)}
              disabled={isLoading || availableTeams.filter(team => team.departmentId === selectedDepartmentId).length === 0}
              className={cn(
                "w-full text-sm rounded-md border px-3 py-2 pr-8",
                "appearance-none bg-no-repeat bg-right",
                "bg-[length:16px_16px] bg-[position:right_8px_center]",
                theme === "dark"
                  ? "bg-slate-700 border-slate-600 text-slate-200 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTQgNkw4IDEwTDEyIDYiIHN0cm9rZT0iIzk0YTNiOCIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz4KPC9zdmc+')]"
                  : "bg-white border-slate-300 text-slate-800 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTQgNkw4IDEwTDEyIDYiIHN0cm9rZT0iIzY0NzQ4YiIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz4KPC9zdmc+')]",
                "focus:outline-none focus:ring-1",
                theme === "dark"
                  ? "focus:ring-teal-500 focus:ring-offset-slate-800 focus:ring-offset-1"
                  : "focus:ring-teal-500 focus:ring-offset-white focus:ring-offset-1",
                "transition-colors duration-150 ease-in-out",
              )}
            >
              <option value="">Все команды</option>
              {availableTeams
                .filter(team => team.departmentId === selectedDepartmentId)
                .map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}{team.teamLeadName ? ` (${team.teamLeadName})` : ''}
                  </option>
                ))}
            </select>
          </div>
        )}
      </div>

      {/* Group for Other Controls */}
      <div className="flex items-center gap-x-2 gap-y-2 flex-wrap">
        <ColumnVisibilityMenu theme={theme} />

        <div className={cn("h-6 mx-1 w-px", theme === "dark" ? "bg-slate-700" : "bg-slate-200")}></div>

        <div className="flex items-center gap-2">
          <span className={cn("text-xs", theme === "dark" ? "text-slate-400" : "text-slate-500")}>Режим "Отдел"</span>
          <button
            className={cn(
              "relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out",
              showDepartments
                ? theme === "dark"
                  ? "bg-teal-500"
                  : "bg-teal-600"
                : theme === "dark"
                  ? "bg-slate-700"
                  : "bg-slate-300",
            )}
            onClick={toggleShowDepartments}
            title={showDepartments ? "Скрыть отделы" : "Показать отделы"}
          >
            <span
              className={cn(
                "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                showDepartments ? "translate-x-5" : "translate-x-0",
              )}
            />
          </button>
        </div>

        {showDepartments && (
          <>
            <button
              className={cn(
                "p-1.5 rounded flex items-center gap-1 text-xs",
                theme === "dark" ? "hover:bg-slate-700 text-teal-400" : "hover:bg-slate-100 text-teal-500",
              )}
              onClick={expandAllDepartments}
              title="Развернуть все отделы"
            >
              <ChevronDown size={14} />
            </button>
            <button
              className={cn(
                "p-1.5 rounded flex items-center gap-1 text-xs",
                theme === "dark" ? "hover:bg-slate-700 text-teal-400" : "hover:bg-slate-100 text-teal-500",
              )}
              onClick={collapseAllDepartments}
              title="Свернуть все отделы"
            >
              <ChevronRight size={14} />
            </button>
          </>
        )}
      </div>

      {/* Reset Button */}
      {activeFiltersCount > 0 && (
        <button
          onClick={onResetFilters}
          className={cn(
            "text-xs flex items-center gap-1 px-3 py-2 rounded-lg border-2",
            theme === "dark"
              ? "border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-slate-200"
              : "border-slate-300 text-slate-600 hover:bg-slate-100 hover:text-slate-700",
          )}
        >
          <X size={12} />
          Сбросить фильтры ({activeFiltersCount})
        </button>
      )}
    </div>
  )
}
