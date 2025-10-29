"use client" 

import { cn } from "@/lib/utils"
import { ChevronDown, ChevronRight, Building2, Users } from "lucide-react"
import type { Department, Employee, Loading } from "../../types"
import { isToday, isFirstDayOfMonth } from "../../utils/date-utils"
import { usePlanningColumnsStore } from "../../stores/usePlanningColumnsStore"
import { usePlanningStore } from "../../stores/usePlanningStore"
import { useUiStore } from "@/stores/useUiStore"
import { useState } from "react"
import { Avatar, Tooltip } from "../avatar"
import { EditLoadingModal } from "./edit-loading-modal"
import { AddLoadingModal } from "./add-loading-modal"
import { AddShortageModal } from "./AddShortageModal"

interface DepartmentRowProps {
  department: Department
  departmentIndex: number
  timeUnits: { date: Date; label: string; isWeekend?: boolean }[]
  theme: string
  rowHeight: number
  headerHeight: number
  columnWidth: number
  padding: number
  leftOffset: number
  cellWidth: number
  stickyColumnShadow: string
  totalExpandedDepartments: number
  totalEmployeesBeforeDepartment: number
  sectionsHeight?: number // Добавляем общую высоту разделов
  dividerHeight?: number // Добавляем высоту разделителя
}

export function DepartmentRow({
  department,
  departmentIndex,
  timeUnits,
  theme,
  rowHeight,
  headerHeight,
  columnWidth,
  padding,
  leftOffset,
  cellWidth,
  stickyColumnShadow,
  totalExpandedDepartments,
  totalEmployeesBeforeDepartment,
  sectionsHeight = 0, // Значение по умолчанию
  dividerHeight = 0, // Значение по умолчанию
}: DepartmentRowProps) {
  // Получаем видимость столбцов из стора
  const { columnVisibility } = usePlanningColumnsStore()

  // Получаем функцию для переключения состояния раскрытия
  const toggleDepartmentExpanded = usePlanningStore((state) => state.toggleDepartmentExpanded)
  const expandedDepartments = usePlanningStore((state) => state.expandedDepartments)

  // Проверяем, раскрыт ли отдел
  const isDepartmentExpanded = expandedDepartments[department.id] || false

  // Состояния для модальных окон

  // Канонические ширины колонок - должны соответствовать timeline-grid.tsx
  const COLUMN_WIDTHS = {
    section: 430,  // Ширина для раздела (уменьшена на 10px)
    object: 120,   // Фиксированная ширина для объекта (скрыт по умолчанию)
    stage: 80,     // Фиксированная ширина для стадии
  } as const

  // Также упрощаем расчет общей ширины фиксированных столбцов
  const totalFixedWidth =
    COLUMN_WIDTHS.section + 
    (columnVisibility.object ? COLUMN_WIDTHS.object : 0)

  // Вычисляем уменьшенную высоту строки (примерно на 25%)
  const reducedRowHeight = Math.floor(rowHeight * 0.75)

  // Обработчик клика по отделу для раскрытия/скрытия
  const handleToggleExpand = () => {
    toggleDepartmentExpanded(department.id)
  }

  // Добавим функцию для переключения состояния раскрытия сотрудника
  // Добавьте следующую функцию после handleToggleExpand:

  const expandedTeams = usePlanningStore((s) => s.expandedTeams)
  const expandedEmployees = usePlanningStore((s) => s.expandedEmployees)
  const toggleTeamExpanded = usePlanningStore((s) => s.toggleTeamExpanded)
  const toggleEmployeeExpanded = usePlanningStore((s) => s.toggleEmployeeExpanded)

  // Получаем всех сотрудников отдела из всех команд (исключая строку дефицита)
  const allEmployees = department.teams.flatMap((team) => team.employees.filter((e) => !(e as any).isShortage))

  // Рассчитываем общую емкость отдела (сумма ставок всех сотрудников)
  const totalDepartmentCapacity = allEmployees.reduce((sum, employee) => {
    return sum + (employee.employmentRate || 1)
  }, 0)

  return (
    <>
      <div className={cn("group/row w-full relative", theme === "dark" ? "border-slate-700" : "border-slate-200")}>
        <div
          className={cn(
            "flex transition-colors cursor-pointer w-full border-b", // Основная толстая нижняя граница для всей строки
            theme === "dark" ? "border-slate-700" : "border-slate-200",
          )}
          style={{ height: `${rowHeight}px` }}
          onClick={handleToggleExpand}
        >
          {/* Фиксированные столбцы с sticky позиционированием */}
          <div
            className={cn("sticky left-0 z-20", "flex")}
            style={{
              height: `${rowHeight}px`,
              width: `${totalFixedWidth}px`,
              // Удаляем borderRight отсюда
            }}
          >
            {/* Столбец с названием отдела */}
            <div
              className={cn(
                "p-3 font-medium flex items-center justify-between transition-colors h-full border-b border-r-[0.5px]",
                theme === "dark"
                  ? "border-slate-700 bg-slate-800 group-hover/row:bg-emerald-900"
                  : "border-slate-200 bg-white group-hover/row:bg-emerald-50",
              )}
              style={{
                width: `${COLUMN_WIDTHS.section}px`,
                minWidth: `${COLUMN_WIDTHS.section}px`,
                padding: `${padding}px`,
                // Удаляем borderRight отсюда
              }}
            >
              {/* Левая часть с названием отдела */}
              <div className="flex items-center">
                <div className="flex-shrink-0 w-7 h-7 flex items-center justify-center mr-2">
                  {isDepartmentExpanded ? (
                    <ChevronDown className={cn("h-5 w-5", theme === "dark" ? "text-teal-400" : "text-teal-500")} />
                  ) : (
                    <ChevronRight className={cn("h-5 w-5", theme === "dark" ? "text-teal-400" : "text-teal-500")} />
                  )}
                </div>
                <Building2 className={cn("h-4 w-4 mr-2", theme === "dark" ? "text-emerald-400" : "text-emerald-600")} />
                <div className="flex flex-col min-w-0">
                  <span
                    className={cn(
                      "font-semibold truncate whitespace-nowrap overflow-hidden max-w-[300px]",
                      theme === "dark" ? "text-slate-200" : "text-slate-800",
                    )}
                  >
                    {department.name}
                  </span>
                  {department.departmentHeadName && (
                    <span
                      className={cn(
                        "text-xs truncate whitespace-nowrap overflow-hidden max-w-[300px]",
                        theme === "dark" ? "text-slate-400" : "text-slate-500",
                      )}
                    >
                      Руководитель: {department.departmentHeadName}
                    </span>
                  )}
                </div>
              </div>
            </div>

            

            {/* Столбец "Объект" (может быть скрыт) */}
            {columnVisibility.object && (
              <div
                className={cn(
                  "p-3 transition-colors h-full flex items-center justify-center border-b border-r-[0.5px]", // Добавлена border-b
                  theme === "dark"
                    ? "border-slate-700 bg-slate-800 group-hover/row:bg-emerald-900"
                    : "border-slate-200 bg-white group-hover/row:bg-emerald-50",
                )}
                style={{
                  width: `${COLUMN_WIDTHS.object}px`,
                  minWidth: `${COLUMN_WIDTHS.object}px`,
                  height: `${rowHeight}px`,
                  padding: `${padding}px`,
                }}
              >
                {department.managerName ? (
                  <span className={cn("text-xs truncate", theme === "dark" ? "text-slate-300" : "text-slate-700")}>
                    {department.managerName}
                  </span>
                ) : (
                  <span className={cn("text-xs italic", theme === "dark" ? "text-slate-500" : "text-slate-400")}>
                    Не назначен
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Ячейки для каждого периода - сдвигаем влево */}
          <div className="flex-1 flex w-full" style={{ flexWrap: "nowrap" }}>
            {timeUnits.map((unit, i) => {
              const isWeekendDay = unit.isWeekend
              const isTodayDate = isToday(unit.date)
              const isFirstDayOfMonthDate = isFirstDayOfMonth(unit.date)
              const isLastDayOfMonthDate = i === timeUnits.length - 1 // Проверяем, является ли это последним днем месяца

              // Получаем суммарную загрузку отдела на эту дату
              const dateKey = unit.date.toISOString().split("T")[0]
              const departmentWorkload = department.dailyWorkloads?.[dateKey] || 0

              // Рассчитываем процент загрузки отдела
              const departmentLoadPercentage =
                totalDepartmentCapacity > 0 ? Math.round((departmentWorkload / totalDepartmentCapacity) * 100) : 0

              return (
                <div
                  key={i}
                  className={cn(
                    "border-r relative transition-colors border-b", // Добавлена border-b
                    theme === "dark" ? "border-slate-700" : "border-slate-200",
                    isWeekendDay ? (theme === "dark" ? "bg-slate-900" : "bg-slate-100") : "",
                    isTodayDate ? (theme === "dark" ? "bg-teal-900/20" : "bg-teal-100/40") : "",
                    theme === "dark" ? "group-hover/row:bg-emerald-900" : "group-hover/row:bg-emerald-50",
                    isFirstDayOfMonth(unit.date)
                      ? theme === "dark"
                        ? "border-l border-l-slate-60"
                        : "border-l border-l-slate-300"
                      : "",
                    isLastDayOfMonthDate ? "border-r-0" : "",
                  )}
                  style={{
                    height: `${rowHeight}px`,
                    width: `${cellWidth}px`,
                    minWidth: `${cellWidth}px`, // Добавляем минимальную ширину
                    flexShrink: 0, // Запрещаем сжатие ячейки
                    borderRight: "1px solid",
                    borderRightColor: theme === "dark" ? "rgb(51, 65, 85)" : "rgb(226, 232, 240)",
                    borderLeft: isFirstDayOfMonth(unit.date) ? "1px solid" : "none",
                    borderLeftColor: isFirstDayOfMonth(unit.date)
                      ? theme === "dark"
                        ? "rgb(71, 85, 105)" // slate-600
                        : "rgb(203, 213, 225)" // slate-300
                      : "transparent",
                  }}
                >
                  {departmentLoadPercentage > 0 && (
                    <div className="absolute inset-0 flex items-end justify-center p-1 pointer-events-none">
                      <div
                        className={cn(
                          "rounded-sm transition-all duration-200 border-2 pointer-events-auto relative",
                          // Менее яркие границы для всех отделов
                          theme === "dark" ? "border-slate-500" : "border-slate-400"
                        )}
                        style={{
                          width: `${Math.max(cellWidth - 6, 3)}px`, // Ширина полосы
                          height: `${rowHeight - 10}px`, // Всегда полная высота (граница как 100%)
                          opacity: 0.9
                        }}
                        title={`Загрузка отдела: ${departmentLoadPercentage}%`}
                      >
                        {/* Внутренняя заливка, показывающая процент загрузки */}
                        <div
                          className={cn(
                            "absolute bottom-0 left-0 right-0 transition-all duration-200",
                            departmentLoadPercentage > 100
                              ? (theme === "dark" ? "bg-red-500" : "bg-red-600")
                              : departmentLoadPercentage <= 50 
                                ? (theme === "dark" ? "bg-blue-400" : "bg-blue-500")
                                : departmentLoadPercentage <= 85 
                                  ? (theme === "dark" ? "bg-amber-400" : "bg-amber-500")
                                  : (theme === "dark" ? "bg-emerald-400" : "bg-emerald-500")
                          )}
                          style={{
                            height: `${Math.max(
                              Math.min(
                                (departmentLoadPercentage / 100) * (rowHeight - 14), // Высота заливки пропорционально проценту
                                rowHeight - 14  // Максимальная высота заливки (учитываем border)
                              ),
                              2  // Минимальная высота для видимости
                            )}px`,
                            opacity: theme === "dark" ? 0.8 : 0.7
                          }}
                        ></div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Отображаем команды и их сотрудников, если отдел раскрыт */}
      {isDepartmentExpanded && (
        <>
          {department.teams.map((team, teamIndex) => (
            <div key={team.id}>
              <TeamRow
                team={team}
                timeUnits={timeUnits}
                theme={theme}
                rowHeight={rowHeight}
                padding={padding}
                cellWidth={cellWidth}
                totalFixedWidth={totalFixedWidth}
                isExpanded={expandedTeams[team.id] || false}
                onToggleExpand={() => toggleTeamExpanded(team.id)}
              />
              {(expandedTeams[team.id] || false) && (() => {
                // Формируем список сотрудников так, чтобы тимлид был первым, остальные — в исходном порядке
                const sortedEmployees = [...(team.employees || [])]
                const leadIndex = team.teamLeadId ? sortedEmployees.findIndex((e) => e.id === team.teamLeadId) : -1
                if (leadIndex > 0) {
                  const [lead] = sortedEmployees.splice(leadIndex, 1)
                  sortedEmployees.unshift(lead)
                }
                return sortedEmployees.map((employee, employeeIndex) => (
                  <EmployeeRow
                    key={employee.id}
                    employee={employee}
                    departmentPosition={departmentIndex}
                    employeeIndex={employeeIndex}
                    timeUnits={timeUnits}
                    theme={theme}
                    rowHeight={rowHeight}
                    padding={padding}
                    leftOffset={leftOffset}
                    cellWidth={cellWidth}
                    stickyColumnShadow={stickyColumnShadow}
                    totalFixedWidth={totalFixedWidth}
                    isExpanded={expandedEmployees[employee.id] || false}
                    onToggleExpand={() => toggleEmployeeExpanded(employee.id)}
                    isTeamLead={!!team.teamLeadId && employee.id === team.teamLeadId}
                  />
                ))
              })()}
            </div>
          ))}
        </>
      )}
    </>
  )
}

// Теперь полностью заменим компонент EmployeeRow на новую версию с поддержкой раскрытия:

// Компонент строки команды внутри отдела
interface TeamRowProps {
  team: Department["teams"][number]
  timeUnits: { date: Date; label: string; isWeekend?: boolean }[]
  theme: string
  rowHeight: number
  padding: number
  cellWidth: number
  totalFixedWidth: number
  isExpanded: boolean
  onToggleExpand: () => void
}

function TeamRow({ team, timeUnits, theme, rowHeight, padding, cellWidth, totalFixedWidth, isExpanded, onToggleExpand }: TeamRowProps) {
  const reducedRowHeight = Math.floor(rowHeight * 0.75)
  // Емкость команды: только реальные сотрудники, без строки дефицита
  const totalTeamCapacity = (team.employees || [])
    .filter((e) => !(e as any).isShortage)
    .reduce((sum, e) => sum + (e.employmentRate || 1), 0)
  const [showAddShortage, setShowAddShortage] = useState(false)

  return (
    <div className={cn("group/row w-full relative", theme === "dark" ? "border-slate-700" : "border-slate-200")}
    >
      <div
        className={cn(
          "flex transition-colors cursor-pointer w-full border-b",
          theme === "dark" ? "border-slate-700" : "border-slate-200",
        )}
        style={{ height: `${rowHeight}px` }}
        onClick={onToggleExpand}
      >
        {/* Фиксированные столбцы */}
        <div className={cn("sticky left-0 z-20", "flex")} style={{ height: `${rowHeight}px`, width: `${totalFixedWidth}px` }}>
          <div
            className={cn(
              "p-3 font-medium flex items-center justify-between transition-colors h-full border-b border-r-[0.5px]",
              theme === "dark" ? "border-slate-700 bg-slate-900 group-hover/row:bg-slate-800" : "border-slate-200 bg-slate-50 group-hover/row:bg-white",
            )}
            style={{ width: `${totalFixedWidth}px`, minWidth: `${totalFixedWidth}px`, padding: `${padding}px` }}
          >
            <div className="flex items-center">
              <div className="flex-shrink-0 w-7 h-7 flex items-center justify-center mr-2">
                {isExpanded ? (
                  <ChevronDown className={cn("h-5 w-5", theme === "dark" ? "text-teal-400" : "text-teal-500")} />
                ) : (
                  <ChevronRight className={cn("h-5 w-5", theme === "dark" ? "text-teal-400" : "text-teal-500")} />
                )}
              </div>
              <Users className={cn("h-4 w-4 mr-2", theme === "dark" ? "text-slate-400" : "text-slate-500")} />
              <div className="flex flex-col min-w-0">
                <span className={cn("font-medium truncate whitespace-nowrap overflow-hidden max-w-[300px]", theme === "dark" ? "text-slate-200" : "text-slate-800")}>{team.name}</span>
                {team.teamLeadName && (
                  <span className={cn("text-[10px] truncate", theme === "dark" ? "text-slate-400" : "text-slate-500")}>Лид: {team.teamLeadName}</span>
                )}
              </div>
            </div>
            {/* Кнопка добавления дефицита для команды */}
            <div className="flex items-center gap-2">
              <button
                className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center transition-opacity",
                  theme === "dark"
                    ? "bg-slate-800 text-slate-500 hover:text-red-400 hover:bg-slate-700"
                    : "bg-slate-100 text-slate-400 hover:text-red-500 hover:bg-slate-200",
                )}
                title="Добавить дефицит"
                onClick={(e) => {
                  e.stopPropagation()
                  setShowAddShortage(true)
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14M5 12h14"></path>
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Ячейки периода */}
        <div className="flex-1 flex w-full" style={{ flexWrap: "nowrap" }}>
          {timeUnits.map((unit, i) => {
            const isWeekendDay = unit.isWeekend
            const isTodayDate = isToday(unit.date)
            const dateKey = unit.date.toISOString().split("T")[0]
            const workload = (team.dailyWorkloads || {})[dateKey] || 0
            const loadPct = totalTeamCapacity > 0 ? Math.round((workload / totalTeamCapacity) * 100) : 0

            return (
              <div
                key={i}
                className={cn(
                  "border-r relative transition-colors border-b",
                  theme === "dark" ? "border-slate-700" : "border-slate-200",
                  isWeekendDay ? (theme === "dark" ? "bg-slate-900" : "bg-slate-100") : "",
                  isTodayDate ? (theme === "dark" ? "bg-teal-900/20" : "bg-teal-100/40") : "",
                  isFirstDayOfMonth(unit.date)
                    ? theme === "dark"
                      ? "border-l border-l-slate-600"
                      : "border-l border-l-slate-300"
                    : "",
                  i === timeUnits.length - 1 ? "border-r-0" : "",
                )}
                style={{
                  height: `${rowHeight}px`,
                  width: `${cellWidth}px`,
                  minWidth: `${cellWidth}px`,
                  flexShrink: 0,
                  borderRight: "1px solid",
                  borderRightColor: theme === "dark" ? "rgb(51, 65, 85)" : "rgb(226, 232, 240)",
                }}
              >
                {loadPct > 0 && (
                  <div className="absolute inset-0 flex items-end justify-center p-1 pointer-events-none">
                    <div
                      className={cn(
                        "rounded-sm transition-all duration-200 border-2 pointer-events-auto relative",
                        theme === "dark" ? "border-slate-500" : "border-slate-400"
                      )}
                      style={{
                        width: `${Math.max(cellWidth - 6, 3)}px`,
                        height: `${rowHeight - 10}px`,
                        opacity: 0.9
                      }}
                      title={`Загрузка команды: ${loadPct}%`}
                    >
                      <div
                        className={cn(
                          "absolute bottom-0 left-0 right-0 transition-all duration-200",
                          // Если превышена емкость (более 100%), всегда красный
                          loadPct > 100
                            ? (theme === "dark" ? "bg-red-500" : "bg-red-600")
                            : loadPct <= 50
                              ? (theme === "dark" ? "bg-blue-400" : "bg-blue-500")
                              : loadPct <= 85
                                ? (theme === "dark" ? "bg-amber-400" : "bg-amber-500")
                                : (theme === "dark" ? "bg-emerald-400" : "bg-emerald-500")
                        )}
                        style={{
                          height: `${Math.max(Math.min((loadPct / 100) * (rowHeight - 14), rowHeight - 14), 2)}px`,
                          opacity: theme === "dark" ? 0.8 : 0.7
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
      {showAddShortage && (
        <AddShortageModal
          teamId={team.id}
          teamName={team.name}
          departmentId={team.departmentId}
          departmentName={team.departmentName}
          theme={theme}
          onClose={() => setShowAddShortage(false)}
        />
      )}
    </div>
  )
}

// Компонент для отображения строки сотрудника
interface EmployeeRowProps {
  employee: Employee
  departmentPosition: number
  employeeIndex: number
  timeUnits: { date: Date; label: string; isWeekend?: boolean }[]
  theme: string
  rowHeight: number
  padding: number
  leftOffset: number
  cellWidth: number
  stickyColumnShadow: string
  totalFixedWidth: number
  isExpanded: boolean
  onToggleExpand: () => void
  isTeamLead: boolean
}

function EmployeeRow({
  employee,
  departmentPosition,
  employeeIndex,
  timeUnits,
  theme,
  rowHeight,
  padding,
  leftOffset,
  cellWidth,
  stickyColumnShadow,
  totalFixedWidth,
  isExpanded,
  onToggleExpand,
  isTeamLead,
}: EmployeeRowProps) {
  // Состояния для модальных окон
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false)
  const [loadingToArchive, setLoadingToArchive] = useState<Loading | null>(null)
  const [editingLoading, setEditingLoading] = useState<Loading | null>(null)

  // Состояние для отслеживания наведения на аватар
  const [hoveredAvatar, setHoveredAvatar] = useState(false)

  // Получаем видимость столбцов из стора
  const { columnVisibility } = usePlanningColumnsStore()

  // Вычисляем уменьшенную высоту строки (примерно на 25%)
  const reducedRowHeight = Math.floor(rowHeight * 0.75)

  // Функция для определения цвета ячейки в зависимости от загрузки
  const getWorkloadColor = (rate: number) => {
    if (rate === 0) return ""

    // Учитываем ставку сотрудника при определении цвета
    const employmentRate = employee.employmentRate || 1
    const relativeLoad = rate / employmentRate

    if (relativeLoad <= 0.5) return theme === "dark" ? "bg-blue-500/70" : "bg-blue-500/50"
    if (relativeLoad <= 1.0) return theme === "dark" ? "bg-green-500/70" : "bg-green-500/50"
    if (relativeLoad <= 1.5) return theme === "dark" ? "bg-yellow-500/70" : "bg-yellow-500/50"
    return theme === "dark" ? "bg-red-500/70" : "bg-red-500/50"
  }

  // Функция для форматирования даты в коротком формате
  const formatShortDate = (date: Date): string => {
    return new Intl.DateTimeFormat("ru-RU", {
      day: "2-digit",
      month: "2-digit",
    }).format(date)
  }

  // Проверяем, есть ли у сотрудника загрузки
  const hasLoadings = employee.loadings && employee.loadings.length > 0

  // Функция для проверки, активна ли загрузка в указанную дату
  const isLoadingActiveInPeriod = (loading: Loading, date: Date): boolean => {
    try {
      const loadingStart = new Date(loading.startDate)
      const loadingEnd = new Date(loading.endDate)

      // Сбрасываем время для корректного сравнения
      loadingStart.setHours(0, 0, 0, 0)
      loadingEnd.setHours(23, 59, 59, 999)

      const periodDate = new Date(date)
      periodDate.setHours(0, 0, 0, 0)

      return periodDate >= loadingStart && periodDate <= loadingEnd
    } catch (error) {
      console.error("Ошибка при проверке активности загрузки:", error)
      return false
    }
  }

  // Функция для вычисления загрузки для конкретной даты и загрузки
  const getLoadingRateForDate = (loading: Loading, date: Date): number => {
    if (isLoadingActiveInPeriod(loading, date)) {
      return loading.rate || 0
    }
    return 0
  }

  // Добавить после строки с editingLoading
  const [showAddModal, setShowAddModal] = useState(false)
  const [showAddShortage, setShowAddShortage] = useState(false)

  return (
    <>
      <div className="group/employee w-full">
        <div
          className={cn("flex transition-colors w-full", hasLoadings ? "cursor-pointer" : "cursor-default")}
          style={{ height: `${reducedRowHeight}px` }}
          onClick={hasLoadings ? onToggleExpand : undefined}
        >
          {/* Фиксированные столбцы с sticky позиционированием */}
          <div
            className={cn("sticky left-0 z-20", "flex")}
            style={{
              height: `${reducedRowHeight}px`,
              width: `${totalFixedWidth}px`,
              borderBottom: "1px solid",
              borderColor: theme === "dark" ? "rgb(51, 65, 85)" : "rgb(226, 232, 240)",
              // Удаляем или комментируем borderRight
              // borderRight: "1px solid",
              // borderRightColor: theme === "dark" ? "rgb(51, 65, 85)" : "rgb(226, 232, 240)",
            }}
          >
            {/* Столбец с информацией о сотруднике */}
            <div
              className={cn(
                "p-2 flex items-center transition-colors h-full border-b-[0.5px] border-r-[0.5px]", // Изменено с border-b на border-b-[0.5px]
                theme === "dark"
                  ? "border-slate-700 bg-slate-800 group-hover/employee:bg-slate-700"
                  : "border-slate-200 bg-white group-hover/employee:bg-slate-50",
              )}
              style={{
                width: `${totalFixedWidth}px`,
                minWidth: `${totalFixedWidth}px`,
                padding: `${padding - 1}px`,
                // borderRight: "1px solid",
                // borderRightColor: theme === "dark" ? "rgb(51, 65, 85)" : "rgb(226, 232, 240)",
              }}
            >
              <div className="flex items-center justify-between w-full">
                {/* Левая часть с иконкой раскрытия, аватаром, именем и должностью */}
                <div className="flex items-center">
                  <div className="flex-shrink-0 w-7 h-7 flex items-center justify-center mr-2">
                    {hasLoadings ? (
                      isExpanded ? (
                        <ChevronDown className={cn("h-4 w-4", theme === "dark" ? "text-teal-400" : "text-teal-500")} />
                      ) : (
                        <ChevronRight className={cn("h-4 w-4", theme === "dark" ? "text-teal-400" : "text-teal-500")} />
                      )
                    ) : (
                      <div className="w-4 h-4"></div> // Пустое место для выравнивания
                    )}
                  </div>
                  <div
                    className="flex items-center"
                    onMouseEnter={() => setHoveredAvatar(true)}
                    onMouseLeave={() => setHoveredAvatar(false)}
                  >
                    <Tooltip content={employee.fullName} isVisible={hoveredAvatar}>
                      <Avatar
                        name={employee.fullName}
                        avatarUrl={employee.avatarUrl}
                        theme={theme === "dark" ? "dark" : "light"}
                        size="md"
                      />
                    </Tooltip>
                    <div className="ml-2">
                      {/* Имя сотрудника */}
                      <div className={cn("text-xs font-medium flex items-center gap-1", theme === "dark" ? "text-slate-200" : "text-slate-700")}>
                        {employee.fullName || "Не указан"}
                        {isTeamLead && (
                          <span
                            className={cn(
                              "inline-flex items-center justify-center rounded-sm text-[10px] px-1 py-0.5",
                              theme === "dark" ? "bg-amber-900/60 text-amber-300" : "bg-amber-100 text-amber-700"
                            )}
                            title="Тимлид команды"
                          >
                            ★
                          </span>
                        )}
                      </div>
                      {/* Должность сотрудника или пометка дефицита */}
                      <div className={cn("text-[10px]", theme === "dark" ? "text-slate-400" : "text-slate-500")}>
                        {employee.isShortage ? "Строка дефицита команды" : (employee.position || "Без должности")}
                      </div>
                    </div>
                  </div>

                </div>

                {/* Правая часть с командой, кнопкой добавления и ставкой */}
                <div className="flex items-center gap-2">
                  {/* Команда сотрудника */}
                  {employee.teamName && (
                    <span
                      className={cn(
                        "text-xs px-2 py-0.5 rounded",
                        theme === "dark" ? "bg-slate-700 text-slate-300" : "bg-slate-100 text-slate-600",
                      )}
                    >
                      {employee.teamCode ? `${employee.teamCode} - ` : ""}
                      {employee.teamName}
                    </span>
                  )}

                  {/* Кнопка добавления загрузки - появляется при наведении */}
                  <button
                    className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center transition-opacity",
                      theme === "dark"
                        ? "bg-slate-700 text-slate-400 hover:text-teal-400 hover:bg-slate-600"
                        : "bg-slate-100 text-slate-400 hover:text-teal-500 hover:bg-slate-200",
                      "opacity-0 group-hover/employee:opacity-100",
                    )}
                    title={employee.isShortage ? "Добавить дефицит" : "Добавить загрузку"}
                    onClick={(e) => {
                      e.stopPropagation() // Предотвращаем раскрытие строки
                      if (employee.isShortage) {
                        setShowAddShortage(true)
                      } else {
                        setShowAddModal(true)
                      }
                    }}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M12 5v14M5 12h14"></path>
                    </svg>
                  </button>

                  {/* Ставка сотрудника (не показываем для строки дефицита) */}
                  {!employee.isShortage && (
                    <span
                      className={cn(
                        "text-xs font-medium px-2 py-0.5 rounded",
                        theme === "dark" ? "bg-teal-900/50 text-teal-300" : "bg-teal-100 text-teal-700",
                      )}
                    >
                      {employee.employmentRate || 1} ставка
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Ячейки для каждого периода - сдвигаем влево */}
          <div className="flex-1 flex w-full" style={{ flexWrap: "nowrap" }}>
            {timeUnits.map((unit, i) => {
              const isWeekendDay = unit.isWeekend
              const isTodayDate = isToday(unit.date)

              // Получаем суммарную загрузку сотрудника на эту дату
              const dateKey = unit.date.toISOString().split("T")[0]
              const isVacationDay = !!(employee as any).vacationsDaily?.[dateKey]
              const workloadRate = employee.dailyWorkloads?.[dateKey] || 0
              
              // Логирование для отладки (только для первых 3 ячеек первого сотрудника)
              if (employee.id === "1433d4ff-fb38-4f48-88bd-cb2a0213d6b8" && i < 3) {
                console.log(`🔍 ${employee.fullName} ${dateKey}:`, {
                  isVacationDay,
                  workloadRate,
                  vacationsDaily: (employee as any).vacationsDaily,
                })
              }

              const isMonthBoundary = i === 0 || i === timeUnits.length - 1

              return (
                <div
                  key={i}
                  className={cn(
                    "border-r relative border-b", // Добавлена border-b
                    theme === "dark" ? "border-slate-700" : "border-slate-200",
                    isWeekendDay ? (theme === "dark" ? "bg-slate-900" : "bg-slate-100") : "",
                    isTodayDate ? (theme === "dark" ? "bg-teal-900/20" : "bg-teal-100/40") : "",
                    isFirstDayOfMonth(unit.date)
                      ? theme === "dark"
                        ? "border-l border-l-slate-600"
                        : "border-l border-l-slate-300"
                      : "",
                    isMonthBoundary && i === timeUnits.length - 1 ? "border-r-0" : "",
                  )}
                  style={{
                    height: `${reducedRowHeight}px`,
                    width: `${cellWidth}px`,
                    minWidth: `${cellWidth}px`,
                    flexShrink: 0,
                    borderRight: "1px solid",
                    borderRightColor: theme === "dark" ? "rgb(51, 65, 85)" : "rgb(226, 232, 240)",
                    borderLeft: isFirstDayOfMonth(unit.date) ? "1px solid" : "none",
                    borderLeftColor: isFirstDayOfMonth(unit.date)
                      ? theme === "dark"
                        ? "rgb(71, 85, 105)"
                        : "rgb(203, 213, 225)"
                      : "transparent",
                  }}
                >
                  {/* Отображение загрузки и отпуска (для строки дефицита отпуск не применяется) */}
                  {(workloadRate > 0 || (isVacationDay && !employee.isShortage)) && (
                    <div className="absolute inset-0 flex items-end justify-center p-1 pointer-events-none">
                      {/* Если есть и загрузка, и отпуск - показываем разделённый столбик (не для дефицита) */}
                      {!employee.isShortage && isVacationDay && workloadRate > 0 ? (
                        <div className="flex w-full h-full items-end justify-center gap-0.5">
                          {/* Левая половина - загрузка */}
                          <div
                            className={cn(
                              "rounded-sm transition-all duration-200 border-2 pointer-events-auto",
                              // Пересечение загрузки с отпуском — всегда жёлтый
                              theme === "dark" 
                                ? "bg-amber-400/30 border-amber-400" 
                                : "bg-amber-500/30 border-amber-500"
                            )}
                            style={{
                              width: `${Math.max((cellWidth - 12) / 2, 1)}px`, // Половина ширины минус gap
                              height: `${(() => {
                                const employmentRate = employee.employmentRate || 1
                                const loadPercentage = (workloadRate / employmentRate) * 100
                                return Math.max(
                                  Math.min(
                                    (loadPercentage / 100) * (reducedRowHeight - 10),
                                    reducedRowHeight - 4
                                  ),
                                  3
                                )
                              })()}px`,
                              opacity: 0.9
                            }}
                            title={`Загрузка: ${(() => {
                              const employmentRate = employee.employmentRate || 1
                              const loadPercentage = Math.round((workloadRate / employmentRate) * 100)
                              const dateStr = new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit' }).format(unit.date)
                              return `${loadPercentage}% (${workloadRate === 1 ? "1" : workloadRate.toFixed(1)} из ${employmentRate} ставки) — пересечение с отпуском — ${dateStr}`
                            })()}`}
                          />
                          {/* Правая половина - отпуск */}
                          <div
                            className={cn(
                              "rounded-sm transition-all duration-200 border-2 pointer-events-auto",
                              theme === "dark" 
                                ? "bg-slate-500/30 border-slate-500" 
                                : "bg-slate-400/30 border-slate-400"
                            )}
                            style={{
                              width: `${Math.max((cellWidth - 12) / 2, 1)}px`, // Половина ширины минус gap
                              height: `${reducedRowHeight - 10}px`, // Полная высота для отпуска
                              opacity: 0.9
                            }}
                            title={`Отпуск (1 ставка) — ${new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit' }).format(unit.date)}`}
                          />
                        </div>
                      ) : (!employee.isShortage && isVacationDay) ? (
                        /* Только отпуск */
                        <div
                          className={cn(
                            "rounded-sm transition-all duration-200 border-2 pointer-events-auto",
                            theme === "dark" 
                              ? "bg-slate-500/30 border-slate-500" 
                              : "bg-slate-400/30 border-slate-400"
                          )}
                          style={{
                            width: `${Math.max(cellWidth - 10, 2)}px`,
                            height: `${reducedRowHeight - 10}px`,
                            opacity: 0.9
                          }}
                          title={`Отпуск (1 ставка) — ${new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit' }).format(unit.date)}`}
                        />
                      ) : (
                        /* Только загрузка */
                        <div
                          className={cn(
                            "rounded-sm transition-all duration-200 border-2 pointer-events-auto",
                            (() => {
                              if (employee.isShortage) {
                                return theme === "dark" 
                                  ? "bg-red-500/30 border-red-500" 
                                  : "bg-red-500/30 border-red-500"
                              }
                              const employmentRate = employee.employmentRate || 1
                              const loadPercentage = (workloadRate / employmentRate) * 100
                              // Если день отпуска и есть загрузка — жёлтый
                              if (!employee.isShortage && (employee as any).vacationsDaily?.[dateKey]) {
                                return theme === "dark" ? "bg-amber-400/30 border-amber-400" : "bg-amber-500/30 border-amber-500"
                              }
                              if (loadPercentage > 100) {
                                return theme === "dark" 
                                  ? "bg-red-400/30 border-red-400" 
                                  : "bg-red-500/30 border-red-500"
                              }
                              return theme === "dark" 
                                ? "bg-blue-400/30 border-blue-400" 
                                : "bg-blue-500/30 border-blue-500"
                            })()
                          )}
                          style={{
                            width: `${Math.max(cellWidth - 10, 2)}px`,
                            height: `${(() => {
                              if (employee.isShortage) {
                                const loadPercentage = Math.min(100, Math.max(10, Math.round(workloadRate * 100)))
                                return Math.max(
                                  Math.min(
                                    (loadPercentage / 100) * (reducedRowHeight - 10),
                                    reducedRowHeight - 4
                                  ),
                                  3
                                )
                              }
                              const employmentRate = employee.employmentRate || 1
                              const loadPercentage = (workloadRate / employmentRate) * 100
                              return Math.max(
                                Math.min(
                                  (loadPercentage / 100) * (reducedRowHeight - 10),
                                  reducedRowHeight - 4
                                ),
                                3
                              )
                            })()}px`,
                            opacity: 0.9
                          }}
                          title={(() => {
                            const dateStr = new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit' }).format(unit.date)
                            if (employee.isShortage) {
                              return `Дефицит: ${workloadRate === 1 ? "1" : workloadRate.toFixed(1)} ставки на ${dateStr}`
                            }
                            const employmentRate = employee.employmentRate || 1
                            const loadPercentage = Math.round((workloadRate / employmentRate) * 100)
                            return `Загрузка сотрудника: ${loadPercentage}% (${workloadRate === 1 ? "1" : workloadRate.toFixed(1)} из ${employmentRate} ставки) на ${dateStr}`
                          })()}
                        />
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>



      {/* Отображаем детали загрузок, если сотрудник раскрыт */}
      {isExpanded && employee.loadings && employee.loadings.length > 0 && (
        <>
          {employee.loadings.map((loading) => (
            <div
              key={loading.id}
              className="relative w-full flex cursor-pointer"
              style={{ height: `${reducedRowHeight}px` }}
              title="Открыть информацию о загрузке"
              onClick={() => setEditingLoading(loading)}
              role="button"
            >
              {/* Фиксированные столбцы с sticky позиционированием */}
              <div
                className={cn("sticky left-0 z-20", "flex")}
                style={{
                  height: `${reducedRowHeight}px`,
                  width: `${totalFixedWidth}px`,
                  borderBottom: "1px solid",
                  borderColor: theme === "dark" ? "rgb(51, 65, 85)" : "rgb(226, 232, 240)",
                  // Удаляем или комментируем borderRight
                  // borderRight: "1px solid",
                  // borderRightColor: theme === "dark" ? "rgb(51, 65, 85)" : "rgb(226, 232, 240)",
                }}
              >
                {/* Столбец с информацией о загрузке */}
                <div
                  className={cn(
                    "p-2 flex items-center transition-colors h-full border-b border-r-[0.5px]", // Добавлена border-b
                    theme === "dark"
                      ? "border-slate-700 bg-slate-900 hover:bg-slate-800"
                      : "border-slate-200 bg-slate-50 hover:bg-white",
                  )}
                  style={{
                    width: `${totalFixedWidth}px`,
                    minWidth: `${totalFixedWidth}px`,
                    padding: `${padding - 1}px`,
                    // borderRight: "1px solid",
                    // borderRightColor: theme === "dark" ? "rgb(51, 65, 85)" : "rgb(226, 232, 240)",
                  }}
                >
                  <div className="flex items-center justify-between w-full">
                    {/* Левая часть с информацией о проекте и разделе */}
                    <div className="flex items-center">
                      <div className="flex-shrink-0 w-7 h-7 flex items-center justify-center mr-2">
                        {/* Кнопка удаления/архивирования */}
                        <button
                          className={cn(
                            "w-5 h-5 rounded-full flex items-center justify-center transition-opacity",
                            theme === "dark"
                              ? "bg-slate-800 text-slate-500 hover:text-red-400 hover:bg-slate-700"
                              : "bg-slate-100 text-slate-400 hover:text-red-500 hover:bg-slate-200",
                            "opacity-70 group-hover:opacity-100",
                          )}
                          title={loading.responsibleName === "Дефицит" ? "Удалить дефицит" : "Архивировать"}
                          onClick={async (e) => {
                            e.stopPropagation()
                            if (loading.responsibleName === "Дефицит") {
                              // Удаляем запись дефицита
                              const { deleteLoading: deleteLoadingFromStore } = usePlanningStore.getState()
                              await deleteLoadingFromStore(loading.id)
                            } else {
                              setLoadingToArchive(loading)
                              setShowArchiveConfirm(true)
                            }
                          }}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="21,8 21,21 3,21 3,8"></polyline>
                            <rect x="1" y="3" width="22" height="5"></rect>
                            <line x1="10" y1="12" x2="14" y2="12"></line>
                          </svg>
                        </button>
                      </div>
                      <div className="ml-2">
                        {/* Название проекта */}
                        <div
                          className={cn(
                            "text-[11px] font-medium truncate whitespace-nowrap overflow-hidden max-w-[220px]",
                            theme === "dark" ? "text-slate-300" : "text-slate-800",
                          )}
                          title={loading.projectName || "Проект не указан"}
                        >
                          {loading.projectName || "Проект не указан"}
                        </div>
                        {/* Название раздела */}
                        <div
                          className={cn(
                            "text-[10px] truncate whitespace-nowrap overflow-hidden max-w-[220px]",
                            theme === "dark" ? "text-slate-400" : "text-slate-500",
                          )}
                          title={loading.sectionName || "Раздел не указан"}
                        >
                          {loading.sectionName || "Раздел не указан"}
                        </div>
                      </div>

                      {/* Период загрузки */}
                      <div className="ml-4 flex items-center">
                        <span className={cn("text-[10px]", theme === "dark" ? "text-slate-400" : "text-slate-600")}>
                          {formatShortDate(new Date(loading.startDate))} — {formatShortDate(new Date(loading.endDate))}
                        </span>
                      </div>
                    </div>

                    {/* Правая часть с кнопкой редактирования и ставкой */}
                    <div className="flex items-center gap-2">
                      {/* Кнопка редактирования загрузки - появляется при наведении */}
                      <button
                        className={cn(
                          "w-5 h-5 rounded-full flex items-center justify-center transition-opacity mr-2",
                          theme === "dark"
                            ? "bg-slate-800 text-slate-500 hover:text-amber-400 hover:bg-slate-700"
                            : "bg-slate-100 text-slate-400 hover:text-amber-500 hover:bg-slate-200",
                          "opacity-70 group-hover:opacity-100",
                        )}
                        title="Редактировать загрузку"
                        onClick={(e) => {
                          e.stopPropagation()
                          setEditingLoading(loading)
                        }}
                      >
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
                        </svg>
                      </button>

                      <span
                        className={cn(
                          "text-[10px] font-medium px-1.5 py-0 rounded",
                          theme === "dark" ? "bg-blue-900/50 text-blue-300" : "bg-blue-100 text-blue-700",
                        )}
                        title="Ставка"
                      >
                        {(() => {
                          const v = Number(loading.rate || 0)
                          return Number.isInteger(v) ? v : v.toFixed(2).replace(/\.00$/, "").replace(/0$/, "")
                        })()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Ячейки для каждого периода - сдвигаем влево */}
              <div className="flex-1 flex w-full" style={{ flexWrap: "nowrap" }}>
                {timeUnits.map((unit) => {
                  const isWeekendDay = unit.isWeekend
                  const isTodayDate = isToday(unit.date)

                  // Получаем загрузку для конкретной даты и конкретной загрузки
                  const loadingRate = getLoadingRateForDate(loading, unit.date)

                  // Создаем стабильный ключ на основе даты и ID загрузки
                  const stableKey = `${loading.id}-${unit.date.toISOString().split('T')[0]}`

                  return (
                    <div
                      key={stableKey}
                      className={cn(
                        "border-r relative border-b", // Добавлена border-b
                        theme === "dark" ? "border-slate-700" : "border-slate-200",
                        // Базовый фон для ячеек
                        isWeekendDay ? (theme === "dark" ? "bg-slate-900" : "bg-slate-100") : "",
                        isTodayDate ? (theme === "dark" ? "bg-teal-900/20" : "bg-teal-100/40") : "",
                        // Фон для ячеек с загрузкой
                        loadingRate > 0 && !isWeekendDay && !isTodayDate 
                          ? theme === "dark" ? "bg-blue-900/20" : "bg-blue-50/80"
                          : "",
                        isFirstDayOfMonth(unit.date)
                          ? theme === "dark"
                            ? "border-l border-l-slate-600"
                            : "border-l border-l-slate-300"
                          : "",
                      )}
                      style={{
                        height: `${reducedRowHeight}px`,
                        width: `${cellWidth}px`,
                        minWidth: `${cellWidth}px`,
                        flexShrink: 0,
                        borderRight: "1px solid",
                        borderRightColor: theme === "dark" ? "rgb(51, 65, 85)" : "rgb(226, 232, 240)",
                        borderLeft: isFirstDayOfMonth(unit.date) ? "1px solid" : "none",
                        borderLeftColor: isFirstDayOfMonth(unit.date)
                          ? theme === "dark"
                            ? "rgb(71, 85, 105)"
                            : "rgb(203, 213, 225)"
                          : "transparent",
                      }}
                    >
                      {loadingRate > 0 && (
                        <div 
                          className="absolute inset-0 flex items-center justify-center pointer-events-none"
                          title={`Загрузка: ${loadingRate === 1 ? "1" : loadingRate.toFixed(1)} ставки`}
                        >
                          <div
                            className={cn(
                              "flex items-center justify-center text-xs font-medium pointer-events-auto",
                              // Оставляем только цвет текста
                              loadingRate > 0
                                ? (() => {
                                    const employmentRate = employee.employmentRate || 1
                                    const relativeLoad = loadingRate / employmentRate

                                    if (relativeLoad <= 0.5) return theme === "dark" ? "text-blue-400" : "text-blue-500"
                                    if (relativeLoad <= 1.0)
                                      return theme === "dark" ? "text-green-400" : "text-green-500"
                                    if (relativeLoad <= 1.5)
                                      return theme === "dark" ? "text-yellow-400" : "text-yellow-500"
                                    return theme === "dark" ? "text-red-400" : "text-red-500"
                                  })()
                                : "",
                            )}
                            title={`Загрузка: ${loadingRate === 1 ? "1" : loadingRate.toFixed(1)} ставки на ${new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit' }).format(unit.date)}`}
                          >
                            {loadingRate === 1 ? "1" : loadingRate.toFixed(1)}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </>
      )}
      {/* Модальное окно подтверждения архивирования */}
      {showArchiveConfirm && loadingToArchive && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={cn("rounded-lg p-6 w-96 max-w-[90vw]", theme === "dark" ? "bg-slate-800" : "bg-white")}>
            <h3 className={cn("text-lg font-semibold mb-4", theme === "dark" ? "text-slate-200" : "text-slate-800")}>
              Архивирование загрузки
            </h3>

            <div
              className={cn(
                "p-4 rounded-lg border mb-4",
                theme === "dark" ? "bg-blue-900 border-blue-700" : "bg-blue-50 border-blue-200",
              )}
            >
              <div className="flex items-start space-x-3">
                <div
                  className={cn("flex-shrink-0 w-5 h-5 mt-0.5", theme === "dark" ? "text-blue-400" : "text-blue-600")}
                >
                  <svg fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div>
                  <h4 className={cn("text-sm font-medium", theme === "dark" ? "text-blue-200" : "text-blue-800")}>
                    Что означает архивирование?
                  </h4>
                  <div className={cn("mt-2 text-sm", theme === "dark" ? "text-blue-300" : "text-blue-700")}>
                    <p className="mb-2">
                      <strong>Архивирование</strong> скрывает загрузку с графика планирования, но сохраняет её в базе
                      данных.
                    </p>
                    <p className="mb-2">Архивированные загрузки можно восстановить при необходимости.</p>
                    <p>
                      <strong>Проект:</strong> {loadingToArchive.projectName || "Без названия"}
                    </p>
                    <p>
                      <strong>Раздел:</strong> {loadingToArchive.sectionName || "Без названия"}
                    </p>
                    <p>
                      <strong>Период:</strong>{" "}
                      {formatShortDate(new Date(loadingToArchive.startDate))} — {formatShortDate(new Date(loadingToArchive.endDate))}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowArchiveConfirm(false)
                  setLoadingToArchive(null)
                }}
                className={cn(
                  "px-4 py-2 text-sm rounded border",
                  theme === "dark"
                    ? "border-slate-600 text-slate-300 hover:bg-slate-700"
                    : "border-slate-300 text-slate-600 hover:bg-slate-50",
                )}
              >
                Отмена
              </button>
              <button
                onClick={async () => {
                  try {
                    // Получаем функцию архивирования из стора
                    const archiveLoadingFromStore = usePlanningStore.getState().archiveLoading

                    // Вызываем архивирование для конкретной загрузки
                    const result = await archiveLoadingFromStore(loadingToArchive.id)

                    if (result.success) {
                      // Показываем уведомление об успехе
                      const uiStore = useUiStore.getState()
                      uiStore.setNotification(
                        `Загрузка для проекта "${loadingToArchive.projectName || "Без названия"}" успешно архивирована`,
                      )

                      // Автоматически скрываем уведомление через 3 секунды
                      setTimeout(() => {
                        uiStore.clearNotification()
                      }, 3000)
                    } else {
                      throw new Error(result.error || "Ошибка при архивировании")
                    }
                  } catch (error) {
                    console.error("Ошибка при архивировании загрузки:", error)

                    // Показываем уведомление об ошибке
                    const uiStore = useUiStore.getState()
                    uiStore.setNotification(
                      `Ошибка при архивировании загрузки: ${error instanceof Error ? error.message : "Неизвестная ошибка"}`,
                    )

                    // Автоматически скрываем уведомление через 5 секунд
                    setTimeout(() => {
                      uiStore.clearNotification()
                    }, 5000)
                  } finally {
                    setShowArchiveConfirm(false)
                    setLoadingToArchive(null)
                  }

                  console.log("Архивирование загрузки:", loadingToArchive.id, loadingToArchive.projectName)
                }}
                className={cn(
                  "px-4 py-2 text-sm rounded",
                  theme === "dark"
                    ? "bg-blue-600 text-white hover:bg-blue-700"
                    : "bg-blue-500 text-white hover:bg-blue-600",
                )}
              >
                Архивировать
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Модальное окно добавления загрузки */}
      {showAddModal && <AddLoadingModal employee={employee} setShowAddModal={setShowAddModal} theme={theme} />}
      {showAddShortage && (
        <AddShortageModal
          teamId={employee.teamId}
          teamName={employee.teamName || "Команда"}
          departmentId={employee.departmentId}
          departmentName={employee.departmentName}
          theme={theme}
          onClose={() => setShowAddShortage(false)}
        />
      )}
      {editingLoading && (
        <EditLoadingModal loading={editingLoading} setEditingLoading={setEditingLoading} theme={theme} />
      )}
    </>
  )
}
