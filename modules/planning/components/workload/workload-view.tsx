"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import { useWorkloadStore } from "../../stores/useWorkloadStore"
import { usePlanningViewStore } from "../../stores/usePlanningViewStore"
import { useSettingsStore } from "@/stores/useSettingsStore"
import { useTheme } from "next-themes"
import { Loader2, ChevronDown, ChevronRight } from "lucide-react"
import { WorkloadHeader } from "./workload-header"
import { WorkloadFilters } from "./workload-filters"
import { ScrollbarStyles } from "../timeline/scrollbar-styles"
import { generateTimeUnits } from "../../utils/date-utils"
import type { Department, Employee } from "../../types"

export function WorkloadView() {
  const {
    departments,
    projects,
    isLoading,
    fetchWorkloadData,
    calculateDailyWorkloads,
    selectedDepartmentId,
    selectedTeamId,
    selectedProjectId,
    setSelectedDepartment,
    setSelectedTeam,
    setSelectedProject,
    resetFilters,
    getFilteredEmployees,
  } = useWorkloadStore()

  const { startDate, daysToShow } = usePlanningViewStore()

  // Используем тему из useSettingsStore
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

  // Состояние для отслеживания раскрытых отделов и команд
  const [expandedDepartments, setExpandedDepartments] = useState<Record<string, boolean>>({})
  const [expandedEmployees, setExpandedEmployees] = useState<Record<string, boolean>>({})

  // Загружаем данные при монтировании компонента
  useEffect(() => {
    fetchWorkloadData()
  }, [fetchWorkloadData])

  // Рассчитываем ежедневную загрузку при изменении периода или после загрузки данных
  useEffect(() => {
    if (departments.length > 0) {
      calculateDailyWorkloads(startDate, daysToShow)
    }
  }, [departments, startDate, daysToShow, calculateDailyWorkloads])

  // Генерируем массив дат для отображения
  const timeUnits = generateTimeUnits(startDate, daysToShow)

  // Получаем отфильтрованных сотрудников
  const filteredEmployees = getFilteredEmployees()

  // Фильтруем отделы на основе выбранных фильтров
  const filteredDepartments = departments.filter((department) => {
    // Если выбран отдел, показываем только его
    if (selectedDepartmentId && department.id !== selectedDepartmentId) {
      return false
    }

    // Проверяем, есть ли в отделе сотрудники после применения всех фильтров
    return department.teams.some((team) => {
      // Если выбрана команда, показываем только ее
      if (selectedTeamId && team.id !== selectedTeamId) {
        return false
      }

      // Проверяем, есть ли в команде сотрудники после фильтрации по проекту
      return team.employees.some((employee) => filteredEmployees.some((e) => e.id === employee.id))
    })
  })

  // Переключение состояния раскрытия отдела
  const toggleDepartment = (departmentId: string) => {
    setExpandedDepartments((prev) => ({
      ...prev,
      [departmentId]: !prev[departmentId],
    }))
  }

  // Переключение состояния раскрытия сотрудника
  const toggleEmployee = (employeeId: string) => {
    setExpandedEmployees((prev) => ({
      ...prev,
      [employeeId]: !prev[employeeId],
    }))
  }

  // Раскрыть все отделы
  const expandAllDepartments = () => {
    const newExpandedDepartments: Record<string, boolean> = {}
    departments.forEach((department) => {
      newExpandedDepartments[department.id] = true
    })
    setExpandedDepartments(newExpandedDepartments)
  }

  // Свернуть все отделы
  const collapseAllDepartments = () => {
    setExpandedDepartments({})
  }

  const cellWidth = 22

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className={cn("text-2xl font-semibold", theme === "dark" ? "text-slate-200" : "text-slate-800")}>
          Загрузка сотрудников
        </h2>

        <div className="flex gap-2">
          <button
            onClick={expandAllDepartments}
            className={cn(
              "px-3 py-2 rounded-md flex items-center gap-1.5 text-xs border",
              theme === "dark"
                ? "border-slate-600 text-teal-400 hover:bg-slate-700 hover:border-slate-500"
                : "border-slate-300 text-teal-600 hover:bg-slate-100 hover:border-slate-400",
            )}
            title="Развернуть все отделы"
          >
            <ChevronDown size={14} />
            <span>Развернуть все</span>
          </button>

          <button
            onClick={collapseAllDepartments}
            className={cn(
              "px-3 py-2 rounded-md flex items-center gap-1.5 text-xs border",
              theme === "dark"
                ? "border-slate-600 text-teal-400 hover:bg-slate-700 hover:border-slate-500"
                : "border-slate-300 text-teal-600 hover:bg-slate-100 hover:border-slate-400",
            )}
            title="Свернуть все отделы"
          >
            <ChevronRight size={14} />
            <span>Свернуть все</span>
          </button>
        </div>
      </div>

      <WorkloadFilters
        departments={departments}
        projects={projects}
        selectedDepartmentId={selectedDepartmentId}
        selectedTeamId={selectedTeamId}
        selectedProjectId={selectedProjectId}
        onDepartmentChange={setSelectedDepartment}
        onTeamChange={setSelectedTeam}
        onProjectChange={setSelectedProject}
        onResetFilters={resetFilters}
        theme={theme}
      />

      <div
        className={cn(
          "w-full max-w-full rounded-xl border overflow-hidden",
          theme === "dark" ? "bg-slate-900 border-slate-700" : "bg-white border-slate-200",
        )}
      >
        <ScrollbarStyles theme={theme} />

        {isLoading ? (
          <div className="flex justify-center items-center p-8">
            <Loader2 className={cn("h-8 w-8 animate-spin", "text-teal-500")} />
          </div>
        ) : (
          <div className="relative">
            <table className="w-full border-collapse table-fixed">
              <WorkloadHeader timeUnits={timeUnits} theme={theme} cellWidth={cellWidth} />

              <tbody>
                {filteredDepartments.length === 0 ? (
                  <tr>
                    <td colSpan={timeUnits.length + 1} className="p-8 text-center">
                      <p className={cn("text-sm", theme === "dark" ? "text-slate-400" : "text-slate-500")}>
                        Нет данных для отображения
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredDepartments.map((department) => (
                    <DepartmentRows
                      key={department.id}
                      department={department}
                      timeUnits={timeUnits}
                      theme={theme}
                      cellWidth={cellWidth}
                      isExpanded={expandedDepartments[department.id] || false}
                      expandedEmployees={expandedEmployees}
                      onToggleDepartment={() => toggleDepartment(department.id)}
                      onToggleEmployee={toggleEmployee}
                      filteredEmployees={filteredEmployees}
                      selectedTeamId={selectedTeamId}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// Компонент для отображения строк отдела
interface DepartmentRowsProps {
  department: Department
  timeUnits: { date: Date; label: string; isWeekend?: boolean }[]
  theme: string
  cellWidth: number
  isExpanded: boolean
  expandedEmployees: Record<string, boolean>
  onToggleDepartment: () => void
  onToggleEmployee: (employeeId: string) => void
  filteredEmployees: Employee[]
  selectedTeamId: string | null
}

function DepartmentRows({
  department,
  timeUnits,
  theme,
  cellWidth,
  isExpanded,
  expandedEmployees,
  onToggleDepartment,
  onToggleEmployee,
  filteredEmployees,
  selectedTeamId,
}: DepartmentRowsProps) {
  // Фильтруем команды на основе selectedTeamId
  const filteredTeams = department.teams
    .filter((team) => !selectedTeamId || team.id === selectedTeamId)
    .filter((team) =>
      // Проверяем, есть ли в команде сотрудники после фильтрации
      team.employees.some((emp) => filteredEmployees.some((e) => e.id === emp.id)),
    )

  // Получаем общее количество сотрудников после фильтрации
  const totalEmployeesCount = filteredTeams.reduce(
    (count, team) => count + team.employees.filter((emp) => filteredEmployees.some((e) => e.id === emp.id)).length,
    0,
  )

  if (filteredTeams.length === 0) return null

  return (
    <>
      {/* Строка отдела */}
      <tr>
        <td
          className={cn(
            "px-4 py-3 font-medium border-b cursor-pointer",
            theme === "dark"
              ? "bg-slate-800 border-slate-700 hover:bg-slate-700"
              : "bg-slate-50 border-slate-200 hover:bg-slate-100",
          )}
          onClick={onToggleDepartment}
          colSpan={timeUnits.length + 1}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              {isExpanded ? (
                <ChevronDown className={cn("h-4 w-4 mr-2", theme === "dark" ? "text-teal-400" : "text-teal-500")} />
              ) : (
                <ChevronRight className={cn("h-4 w-4 mr-2", theme === "dark" ? "text-teal-400" : "text-teal-500")} />
              )}
              <span className={cn("font-semibold", theme === "dark" ? "text-slate-200" : "text-slate-800")}>
                {department.name}
              </span>
              <span
                className={cn(
                  "ml-2 text-xs px-2 py-0.5 rounded-full",
                  theme === "dark" ? "bg-slate-700 text-slate-300" : "bg-slate-200 text-slate-600",
                )}
              >
                {totalEmployeesCount} сотрудников
              </span>
            </div>

            <div className="flex items-center">
              <span
                className={cn(
                  "text-xs px-2 py-0.5 rounded",
                  theme === "dark" ? "bg-teal-900/50 text-teal-300" : "bg-teal-100 text-teal-700",
                )}
              >
                {department.teams
                  .reduce(
                    (sum, team) => sum + Object.values(team.dailyWorkloads || {}).reduce((s, rate) => s + rate, 0),
                    0,
                  )
                  .toFixed(1)}{" "}
                ставок
              </span>
            </div>
          </div>
        </td>
      </tr>

      {/* Строки сотрудников */}
      {isExpanded &&
        filteredTeams.flatMap((team) => {
          // Фильтруем сотрудников команды
          const teamEmployees = team.employees.filter((emp) => filteredEmployees.some((e) => e.id === emp.id))

          if (teamEmployees.length === 0) return []

          return teamEmployees.flatMap((employee) => (
            <EmployeeRows
              key={employee.id}
              employee={employee}
              team={team}
              timeUnits={timeUnits}
              theme={theme}
              cellWidth={cellWidth}
              isExpanded={expandedEmployees[employee.id] || false}
              onToggleEmployee={() => onToggleEmployee(employee.id)}
            />
          ))
        })}
    </>
  )
}

// Импортируем компоненты для строк сотрудников и загрузок
import { EmployeeRows } from "./employee-rows"
