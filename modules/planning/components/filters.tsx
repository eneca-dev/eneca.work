"use client"

import { useEffect } from "react"
import { usePlanningFiltersStore } from "../stores/usePlanningFiltersStore"
import { usePlanningStore } from "../stores/usePlanningStore"
import { useSettingsStore } from "@/stores/useSettingsStore"
import { cn } from "@/lib/utils"
import { Filter, X } from "lucide-react"
import { useTheme } from "next-themes"

export function PlanningFilters() {
  const {
    availableProjects: allProjects,
    availableManagers, // Добавляем менеджеров
    availableDepartments: departments,
    availableTeams: teams,
    selectedProjectId,
    selectedDepartmentId,
    selectedTeamId,
    selectedManagerId, // Добавляем выбранного менеджера
    isLoading,
    fetchFilterOptions,
    setSelectedProject,
    setSelectedDepartment,
    setSelectedTeam,
    setSelectedManager, // Добавляем метод для выбора менеджера
    resetFilters,
    getFilteredProjects, // Добавляем метод для получения отфильтрованных проектов
  } = usePlanningFiltersStore()

  const { setFilters } = usePlanningStore()

  // Используем тему из useSettingsStore
  const { getEffectiveTheme } = useSettingsStore()
  const { resolvedTheme } = useTheme()
  const theme = getEffectiveTheme(resolvedTheme || null)

  // Загружаем проекты, отделы и команды при монтировании компонента
  useEffect(() => {
    fetchFilterOptions()
  }, [fetchFilterOptions])

  // Получаем отфильтрованные проекты на основе выбранного менеджера
  const availableProjects = getFilteredProjects()

  // Перезагружаем разделы при изменении фильтров
  useEffect(() => {
    setFilters(selectedProjectId, selectedDepartmentId, selectedTeamId)
  }, [selectedProjectId, selectedDepartmentId, selectedTeamId, setFilters])

  // Фильтруем команды в зависимости от выбранного отдела
  const filteredTeams = selectedDepartmentId
    ? teams.filter((team) => team.departmentId === selectedDepartmentId)
    : teams

  return (
    <div
      className={cn(
        "p-4 rounded-xl shadow-md border mb-6",
        theme === "dark" ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200",
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Filter size={16} className={theme === "dark" ? "text-slate-400" : "text-slate-500"} />
          <h3 className={cn("text-sm font-medium", theme === "dark" ? "text-slate-200" : "text-slate-800")}>Фильтры</h3>
        </div>

        {(selectedProjectId || selectedDepartmentId || selectedTeamId || selectedManagerId) && (
          <button
            onClick={resetFilters}
            className={cn(
              "text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-md border",
              theme === "dark"
                ? "border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-slate-200"
                : "border-slate-300 text-slate-600 hover:bg-slate-100 hover:text-slate-700",
            )}
          >
            <X size={12} />
            Сбросить
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {/* Фильтр по менеджерам */}
        <div>
          <label
            htmlFor="manager-filter"
            className={cn("block text-xs font-medium mb-1", theme === "dark" ? "text-slate-400" : "text-slate-500")}
          >
            Менеджер
          </label>
          <select
            id="manager-filter"
            value={selectedManagerId || ""}
            onChange={(e) => setSelectedManager(e.target.value || null)}
            disabled={isLoading || availableManagers.length === 0}
            className={cn(
              "w-full text-sm rounded-md border px-3 py-2 transition-colors duration-150 ease-in-out",
              theme === "dark"
                ? "bg-slate-700 border-slate-600 text-slate-200"
                : "bg-white border-slate-300 text-slate-800",
              "focus:outline-none focus:ring-1",
              theme === "dark"
                ? "focus:ring-teal-500 focus:ring-offset-slate-800 focus:ring-offset-1"
                : "focus:ring-teal-500 focus:ring-offset-white focus:ring-offset-1",
            )}
          >
            <option value="">Все менеджеры</option>
            {availableManagers.map((manager) => (
              <option key={manager.id} value={manager.id}>
                {manager.name}
              </option>
            ))}
          </select>
        </div>

        {/* Фильтр по проектам */}
        <div>
          <label
            htmlFor="project-filter"
            className={cn("block text-xs font-medium mb-1", theme === "dark" ? "text-slate-400" : "text-slate-500")}
          >
            Проект
          </label>
          <select
            id="project-filter"
            value={selectedProjectId || ""}
            onChange={(e) => setSelectedProject(e.target.value || null)}
            disabled={isLoading || availableProjects.length === 0}
            className={cn(
              "w-full text-sm rounded-md border px-3 py-2 transition-colors duration-150 ease-in-out",
              theme === "dark"
                ? "bg-slate-700 border-slate-600 text-slate-200"
                : "bg-white border-slate-300 text-slate-800",
              "focus:outline-none focus:ring-1",
              theme === "dark"
                ? "focus:ring-teal-500 focus:ring-offset-slate-800 focus:ring-offset-1"
                : "focus:ring-teal-500 focus:ring-offset-white focus:ring-offset-1",
            )}
          >
            <option value="">{selectedManagerId ? "Все проекты менеджера" : "Все проекты"}</option>
            {availableProjects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </div>

        {/* Остальные фильтры остаются без изменений */}
        {/* Фильтр по отделам */}
        <div>
          <label
            htmlFor="department-filter"
            className={cn("block text-xs font-medium mb-1", theme === "dark" ? "text-slate-400" : "text-slate-500")}
          >
            Отдел
          </label>
          <select
            id="department-filter"
            value={selectedDepartmentId || ""}
            onChange={(e) => setSelectedDepartment(e.target.value || null)}
            disabled={isLoading || departments.length === 0}
            className={cn(
              "w-full text-sm rounded-md border px-3 py-2 transition-colors duration-150 ease-in-out",
              theme === "dark"
                ? "bg-slate-700 border-slate-600 text-slate-200"
                : "bg-white border-slate-300 text-slate-800",
              "focus:outline-none focus:ring-1",
              theme === "dark"
                ? "focus:ring-teal-500 focus:ring-offset-slate-800 focus:ring-offset-1"
                : "focus:ring-teal-500 focus:ring-offset-white focus:ring-offset-1",
            )}
          >
            <option value="">Все отделы</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </select>
        </div>

        {/* Фильтр по командам */}
        <div>
          <label
            htmlFor="team-filter"
            className={cn("block text-xs font-medium mb-1", theme === "dark" ? "text-slate-400" : "text-slate-500")}
          >
            Команда
          </label>
          <select
            id="team-filter"
            value={selectedTeamId || ""}
            onChange={(e) => setSelectedTeam(e.target.value || null)}
            disabled={isLoading || filteredTeams.length === 0}
            className={cn(
              "w-full text-sm rounded-md border px-3 py-2 transition-colors duration-150 ease-in-out",
              theme === "dark"
                ? "bg-slate-700 border-slate-600 text-slate-200"
                : "bg-white border-slate-300 text-slate-800",
              "focus:outline-none focus:ring-1",
              theme === "dark"
                ? "focus:ring-teal-500 focus:ring-offset-slate-800 focus:ring-offset-1"
                : "focus:ring-teal-500 focus:ring-offset-white focus:ring-offset-1",
            )}
          >
            <option value="">Все команды</option>
            {filteredTeams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.code ? `${team.code} - ` : ""}
                {team.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  )
}
