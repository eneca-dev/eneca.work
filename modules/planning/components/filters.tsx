"use client"

import { useEffect } from "react"
import { usePlanningFiltersStore } from "../stores/usePlanningFiltersStore"
import { usePlanningStore } from "../stores/usePlanningStore"
import { useSettingsStore } from "@/stores/useSettingsStore"
import { useUserStore } from "@/stores/useUserStore"
import { cn } from "@/lib/utils"
import { Filter, X, Lock, Shield } from "lucide-react"
import { useTheme } from "next-themes"

// Переиспользуемый компонент для select элементов
interface FilterSelectProps {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  disabled: boolean
  locked?: boolean
  options: Array<{ id: string; name: string; leaderName?: string }>
  placeholder: string
  theme: 'light' | 'dark'
}

function FilterSelect({ id, label, value, onChange, disabled, locked = false, options, placeholder, theme }: FilterSelectProps) {
  const isDisabled = disabled || locked;
  
  return (
    <div>
      <label
        htmlFor={id}
        className={cn(
          "block text-xs font-medium mb-1 flex items-center gap-1", 
          theme === "dark" ? "text-slate-400" : "text-slate-500"
        )}
      >
        {label}
        {locked && <Lock size={12} className="text-amber-500" />}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value || "")}
        disabled={isDisabled}
        className={cn(
          "w-full text-sm rounded-md border px-3 py-2 transition-colors duration-150 ease-in-out",
          theme === "dark"
            ? "bg-slate-700 border-slate-600 text-slate-200"
            : "bg-white border-slate-300 text-slate-800",
          "focus:outline-none focus:ring-1",
          theme === "dark"
            ? "focus:ring-teal-500 focus:ring-offset-slate-800 focus:ring-offset-1"
            : "focus:ring-teal-500 focus:ring-offset-white focus:ring-offset-1",
          locked && "opacity-60 cursor-not-allowed",
          locked && theme === "dark" 
            ? "bg-slate-800 border-amber-500/30" 
            : "bg-slate-50 border-amber-500/30"
        )}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}{option.leaderName ? ` (${option.leaderName})` : ''}
          </option>
        ))}
      </select>
    </div>
  )
}

// Компонент беджа разрешения
function PermissionBadge({ theme }: { theme: 'light' | 'dark' }) {
  const { getActivePermission, getPermissionLabel } = useUserStore();
  const activePermission = getActivePermission();
  
  if (!activePermission) {
    return null;
  }

  const label = getPermissionLabel(activePermission);
  
  const getBadgeColor = (permission: string) => {
    switch (permission) {
      case 'is_top_manager':
        return theme === 'dark' 
          ? 'bg-purple-900/50 text-purple-300 border-purple-700' 
          : 'bg-purple-100 text-purple-800 border-purple-300';
      case 'is_project_manager':
        return theme === 'dark' 
          ? 'bg-blue-900/50 text-blue-300 border-blue-700' 
          : 'bg-blue-100 text-blue-800 border-blue-300';
      case 'is_head_of_department':
        return theme === 'dark' 
          ? 'bg-green-900/50 text-green-300 border-green-700' 
          : 'bg-green-100 text-green-800 border-green-300';
      case 'is_teamlead':
        return theme === 'dark' 
          ? 'bg-orange-900/50 text-orange-300 border-orange-700' 
          : 'bg-orange-100 text-orange-800 border-orange-300';
      default:
        return theme === 'dark' 
          ? 'bg-slate-700 text-slate-300 border-slate-600' 
          : 'bg-slate-100 text-slate-700 border-slate-300';
    }
  };

  return (
    <div className={cn(
      "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border",
      getBadgeColor(activePermission)
    )}>
      <Shield size={12} />
      {label}
    </div>
  );
}

export function PlanningFilters() {
  const {
    availableProjects: allProjects,
    availableManagers, // Добавляем менеджеров
    availableDepartments: departments,
    availableTeams: teams,
    availableEmployees: employees, // Добавляем сотрудников
    selectedProjectId,
    selectedDepartmentId,
    selectedTeamId,
    selectedManagerId, // Добавляем выбранного менеджера
    selectedEmployeeId, // Добавляем выбранного сотрудника
    isLoading,
    fetchFilterOptions,
    setSelectedProject,
    setSelectedDepartment,
    setSelectedTeam,
    setSelectedManager, // Добавляем метод для выбора менеджера
    setSelectedEmployee, // Добавляем метод для выбора сотрудника
    resetFilters,
    getFilteredProjects, // Добавляем метод для получения отфильтрованных проектов
    getFilteredEmployees, // Добавляем метод для получения отфильтрованных сотрудников
    isFilterLocked, // Добавляем метод для проверки блокировки
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

  // Получаем отфильтрованных сотрудников на основе выбранного отдела и команды
  const filteredEmployees = getFilteredEmployees()

  // Перезагружаем разделы при изменении фильтров
  useEffect(() => {
    setFilters(selectedProjectId, selectedDepartmentId, selectedTeamId, selectedManagerId, selectedEmployeeId)
  }, [selectedProjectId, selectedDepartmentId, selectedTeamId, selectedManagerId, selectedEmployeeId, setFilters])

  // Фильтруем команды в зависимости от выбранного отдела
  const filteredTeams = selectedDepartmentId
    ? teams.filter((team) => team.departmentId === selectedDepartmentId)
    : teams

  return (
    <div
      className={cn(
        "p-4 rounded-xl border mb-6",
        theme === "dark" ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200",
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter size={16} className={theme === "dark" ? "text-slate-400" : "text-slate-500"} />
            <h3 className={cn("text-sm font-medium", theme === "dark" ? "text-slate-200" : "text-slate-800")}>Фильтры</h3>
          </div>
          <PermissionBadge theme={theme} />
        </div>

        {(selectedProjectId || selectedDepartmentId || selectedTeamId || selectedManagerId || selectedEmployeeId) && (
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

      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        {/* Фильтр по менеджерам */}
        <FilterSelect
          id="manager-filter"
          label="Менеджер"
          value={selectedManagerId || ""}
          onChange={(value) => setSelectedManager(value || null)}
          disabled={isLoading || availableManagers.length === 0}
          locked={isFilterLocked('manager')}
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
          locked={isFilterLocked('project')}
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
          locked={isFilterLocked('department')}
          options={departments.map(dept => ({
            id: dept.id,
            name: dept.name,
            leaderName: dept.departmentHeadName || undefined
          }))}
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
          locked={isFilterLocked('team')}
          options={filteredTeams.map(team => ({
            id: team.id,
            name: team.name,
            leaderName: team.teamLeadName || undefined
          }))}
          placeholder="Все команды"
          theme={theme}
        />

        {/* Фильтр по сотрудникам */}
        <FilterSelect
          id="employee-filter"
          label="Сотрудник"
          value={selectedEmployeeId || ""}
          onChange={(value) => setSelectedEmployee(value || null)}
          disabled={isLoading || filteredEmployees.length === 0}
          locked={isFilterLocked('employee')}
          options={filteredEmployees.map(emp => ({
            id: emp.id,
            name: emp.name,
            leaderName: emp.position || undefined
          }))}
          placeholder="Все сотрудники"
          theme={theme}
        />
      </div>
    </div>
  )
}
