"use client"

import { useEffect } from "react"
import { usePlanningFiltersStore } from "../stores/usePlanningFiltersStore"
import { usePlanningStore } from "../stores/usePlanningStore"
import { useSettingsStore } from "@/stores/useSettingsStore"
import { cn } from "@/lib/utils"
import { Filter, X } from "lucide-react"
import { useTheme } from "next-themes"

// Переиспользуемый компонент для select элементов
interface FilterSelectProps {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  disabled: boolean
  options: Array<{ id: string; name: string }>
  placeholder: string
  theme: 'light' | 'dark'
}

function FilterSelect({ id, label, value, onChange, disabled, options, placeholder, theme }: FilterSelectProps) {
  return (
    <div>
      <label
        htmlFor={id}
        className={cn("block text-xs font-medium mb-1", theme === "dark" ? "text-slate-400" : "text-slate-500")}
      >
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value || "")}
        disabled={disabled}
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
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
    </div>
  )
}

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

  // Используем тему из useSettingsStore, если не передана через props
  const { theme: settingsTheme } = useSettingsStore()
  const { resolvedTheme } = useTheme()
  
  // Определяем эффективную тему
  const getEffectiveTheme = (resolvedTheme: string | null) => {
    if (settingsTheme === 'system') {
      return resolvedTheme === 'dark' ? 'dark' : 'light'
    }
    return settingsTheme
  }
  
  const theme = getEffectiveTheme(resolvedTheme || null)

  // Загружаем проекты, отделы и команды при монтировании компонента
  useEffect(() => {
    fetchFilterOptions()
  }, [fetchFilterOptions])

  // Получаем отфильтрованные проекты на основе выбранного менеджера
  const availableProjects = getFilteredProjects()

  // Перезагружаем разделы при изменении фильтров
  useEffect(() => {
    setFilters(selectedProjectId, selectedDepartmentId, selectedTeamId, selectedManagerId)
  }, [selectedProjectId, selectedDepartmentId, selectedTeamId, selectedManagerId, setFilters])

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
        <FilterSelect
          id="manager-filter"
          label="Менеджер"
          value={selectedManagerId || ""}
          onChange={(value) => setSelectedManager(value || null)}
          disabled={isLoading || availableManagers.length === 0}
          options={availableManagers}
          placeholder="Все менеджеры"
          theme={theme}
        />

        {/* Фильтр по проектам */}
        <FilterSelect
          id="project-filter"
          label="Проект"
          value={selectedProjectId || ""}
          onChange={(value) => setSelectedProject(value || null)}
          disabled={isLoading || availableProjects.length === 0}
          options={availableProjects}
          placeholder={selectedManagerId ? "Все проекты менеджера" : "Все проекты"}
          theme={theme}
        />

        {/* Фильтр по отделам */}
        <FilterSelect
          id="department-filter"
          label="Отдел"
          value={selectedDepartmentId || ""}
          onChange={(value) => setSelectedDepartment(value || null)}
          disabled={isLoading || departments.length === 0}
          options={departments}
          placeholder="Все отделы"
          theme={theme}
        />

        {/* Фильтр по командам */}
        <FilterSelect
          id="team-filter"
          label="Команда"
          value={selectedTeamId || ""}
          onChange={(value) => setSelectedTeam(value || null)}
          disabled={isLoading || filteredTeams.length === 0}
          options={filteredTeams}
          placeholder="Все команды"
          theme={theme}
        />
      </div>
    </div>
  )
}
