"use client"

import { cn } from "@/lib/utils"
import { Filter, X } from "lucide-react"
import type { Department } from "../../types"

interface WorkloadFiltersProps {
  departments: Department[]
  projects: { id: string; name: string }[]
  selectedDepartmentId: string | null
  selectedTeamId: string | null
  selectedProjectId: string | null
  onDepartmentChange: (departmentId: string | null) => void
  onTeamChange: (teamId: string | null) => void
  onProjectChange: (projectId: string | null) => void
  onResetFilters: () => void
  theme: string
}

export function WorkloadFilters({
  departments,
  projects,
  selectedDepartmentId,
  selectedTeamId,
  selectedProjectId,
  onDepartmentChange,
  onTeamChange,
  onProjectChange,
  onResetFilters,
  theme,
}: WorkloadFiltersProps) {
  // Получаем команды выбранного отдела
  const teams = selectedDepartmentId
    ? departments.find((d) => d.id === selectedDepartmentId)?.teams || []
    : departments.flatMap((d) => d.teams)

  // Количество активных фильтров
  const activeFiltersCount = [selectedDepartmentId, selectedTeamId, selectedProjectId].filter(Boolean).length

  return (
    <div
      className={cn(
        "p-4 rounded-xl border mb-6",
        theme === "dark" ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200",
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Filter size={16} className={theme === "dark" ? "text-slate-400" : "text-slate-500"} />
          <h3 className={cn("text-sm font-medium", theme === "dark" ? "text-slate-200" : "text-slate-800")}>
            Фильтры загрузки
          </h3>
        </div>

        {activeFiltersCount > 0 && (
          <button
            onClick={onResetFilters}
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
            onChange={(e) => {
              const newDepartmentId = e.target.value || null
              onDepartmentChange(newDepartmentId)
              // Сбрасываем выбранную команду при изменении отдела
              onTeamChange(null)
            }}
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
                {department.name} ({department.totalEmployees})
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
            onChange={(e) => onTeamChange(e.target.value || null)}
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
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.code ? `${team.code} - ` : ""}
                {team.name} ({team.totalEmployees})
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
            onChange={(e) => onProjectChange(e.target.value || null)}
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
            <option value="">Все проекты</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  )
}
