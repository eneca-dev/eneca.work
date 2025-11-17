"use client" 

import { cn } from "@/lib/utils"
import { ChevronDown, ChevronRight, Building2, Users } from "lucide-react"
import type { Department, Employee, Loading } from "../../types"
import { isToday, isFirstDayOfMonth } from "../../utils/date-utils"
import { usePlanningColumnsStore } from "../../stores/usePlanningColumnsStore"
import { usePlanningStore } from "../../stores/usePlanningStore"
import { useUiStore } from "@/stores/useUiStore"
import { useState, Fragment, useMemo } from "react"
import { Avatar, Tooltip } from "../avatar"
import { EditLoadingModal } from "./edit-loading-modal"
import { AddLoadingModal } from "./add-loading-modal"
import { AddShortageModal } from "./AddShortageModal"
import {
  loadingsToPeriods,
  groupVacationPeriods,
  calculateBarRenders,
  formatBarLabel,
  formatBarTooltip,
  type BarPeriod,
} from "./loading-bars-utils"

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
      <div className={cn("group/row min-w-full relative", theme === "dark" ? "border-slate-700" : "border-slate-200")}>
        <div
          className={cn(
            "flex transition-colors cursor-pointer min-w-full border-b", // Основная толстая нижняя граница для всей строки
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
                "p-3 font-medium flex items-center justify-between transition-colors h-full border-b border-r",
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
              <div className="flex items-center" style={{ paddingLeft: '0px' }}>
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
                  "p-3 transition-colors h-full flex items-center justify-center border-b border-r",
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
            <Fragment key={team.id}>
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
            </Fragment>
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
    <div className={cn("group/row min-w-full relative", theme === "dark" ? "border-slate-700" : "border-slate-200")}
    >
      <div
        className={cn(
          "flex transition-colors cursor-pointer min-w-full border-b",
          theme === "dark" ? "border-slate-700" : "border-slate-200",
        )}
        style={{ height: `${reducedRowHeight}px` }}
        onClick={onToggleExpand}
      >
        {/* Фиксированные столбцы */}
        <div className={cn("sticky left-0 z-20", "flex")} style={{ height: `${reducedRowHeight}px`, width: `${totalFixedWidth}px` }}>
          <div
            className={cn(
              "p-3 font-medium flex items-center justify-between transition-colors h-full border-b border-r",
              theme === "dark" ? "border-slate-700 bg-slate-900 group-hover/row:bg-slate-800" : "border-slate-200 bg-slate-50 group-hover/row:bg-white",
            )}
            style={{ width: `${totalFixedWidth}px`, minWidth: `${totalFixedWidth}px`, padding: `${padding}px` }}
          >
            <div className="flex items-center" style={{ paddingLeft: '20px' }}>
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
                  height: `${reducedRowHeight}px`,
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
                        height: `${reducedRowHeight - 10}px`,
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
                          height: `${Math.max(Math.min((loadPct / 100) * (reducedRowHeight - 14), reducedRowHeight - 14), 2)}px`,
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

export function EmployeeRow({
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
  const [showAddModal, setShowAddModal] = useState(false)
  const [showAddShortage, setShowAddShortage] = useState(false)
  const [editingLoading, setEditingLoading] = useState<Loading | null>(null)

  // Состояние для отслеживания наведения на аватар
  const [hoveredAvatar, setHoveredAvatar] = useState(false)

  // Получаем видимость столбцов из стора
  const { columnVisibility } = usePlanningColumnsStore()

  // Базовая высота строки сотрудника (90% от rowHeight)
  const reducedRowHeight = Math.floor(rowHeight * 0.9)

  // Преобразуем загрузки и отпуска в периоды для отрисовки
  const allPeriods = useMemo(() => {
    const loadingPeriods = loadingsToPeriods(employee.loadings)
    const vacationPeriods = groupVacationPeriods(employee.vacationsDaily)
    return [...loadingPeriods, ...vacationPeriods]
  }, [employee.loadings, employee.vacationsDaily])

  // Вычисляем параметры отрисовки всех полосок
  const barRenders = useMemo(() => {
    return calculateBarRenders(allPeriods, timeUnits, cellWidth, theme === "dark")
  }, [allPeriods, timeUnits, cellWidth, theme])

  // Вычисляем максимальную суммарную загрузку для определения режима отображения
  const maxTotalRate = useMemo(() => {
    if (allPeriods.length === 0) return 0

    // Фильтруем только загрузки (не отпуска)
    const loadingPeriods = allPeriods.filter(p => p.type === "loading")
    if (loadingPeriods.length === 0) return 0

    // Для каждого периода проверяем, какие другие периоды с ним пересекаются
    let maxRate = 0

    for (const period of loadingPeriods) {
      // Находим все периоды, пересекающиеся с текущим
      const overlapping = loadingPeriods.filter(p => {
        return p.startDate <= period.endDate && p.endDate >= period.startDate
      })

      // Суммируем их ставки
      const totalRate = overlapping.reduce((sum, p) => sum + (p.rate || 0), 0)
      maxRate = Math.max(maxRate, totalRate)
    }

    return maxRate
  }, [allPeriods])

  // Базовая высота полоски для 1 ставки и зазор между ними
  // Рассчитано так, чтобы при 0.25 ставки текст 8px был читаемым (56 * 0.25 = 14px)
  const BASE_BAR_HEIGHT = 56 // Высота для полной ставки (rate = 1)
  const BAR_GAP = 3 // Минимальное расстояние между полосками

  // Динамический расчёт высоты строки на основе загрузок
  const actualRowHeight = useMemo(() => {
    if (barRenders.length === 0) return reducedRowHeight

    // Рассчитываем необходимую высоту для вертикального размещения всех полосок
    let maxBottom = 0

    barRenders.forEach(bar => {
      const barHeight = BASE_BAR_HEIGHT * (bar.period.rate || 1)

      // Находим все полосы, которые пересекаются с текущей по времени И имеют меньший layer
      const overlappingBars = barRenders.filter(other =>
        other.period.startDate <= bar.period.endDate &&
        other.period.endDate >= bar.period.startDate &&
        other.layer < bar.layer
      )

      // Рассчитываем top на основе ТОЛЬКО пересекающихся полос
      let top = 8 // начальный отступ
      if (overlappingBars.length > 0) {
        const layersMap = new Map<number, number>()
        overlappingBars.forEach(other => {
          const otherHeight = BASE_BAR_HEIGHT * (other.period.rate || 1)
          layersMap.set(other.layer, Math.max(layersMap.get(other.layer) || 0, otherHeight))
        })

        // Суммируем высоты только тех слоёв, которые реально пересекаются
        for (let i = 0; i < bar.layer; i++) {
          if (layersMap.has(i)) {
            top += layersMap.get(i)! + BAR_GAP
          }
        }
      }

      maxBottom = Math.max(maxBottom, top + barHeight)
    })

    // Возвращаем максимум из минимальной высоты и требуемой высоты + отступ снизу
    return Math.max(reducedRowHeight, maxBottom + 8)
  }, [barRenders, reducedRowHeight])

  return (
    <>
      <div className="group/employee min-w-full">
        <div
          className={cn("flex transition-colors min-w-full")}
          style={{ height: `${actualRowHeight}px` }}
        >
          {/* Фиксированные столбцы с sticky позиционированием */}
          <div
            className={cn("sticky left-0 z-20", "flex")}
            style={{
              height: `${actualRowHeight}px`,
              width: `${totalFixedWidth}px`,
              borderBottom: "1px solid",
              borderColor: theme === "dark" ? "rgb(51, 65, 85)" : "rgb(226, 232, 240)",
            }}
          >
            {/* Столбец с информацией о сотруднике */}
            <div
              className={cn(
                "p-2 flex items-center transition-colors h-full border-b border-r",
                theme === "dark"
                  ? "border-slate-700 bg-slate-800 group-hover/employee:bg-slate-700"
                  : "border-slate-200 bg-white group-hover/employee:bg-slate-50",
              )}
              style={{
                width: `${totalFixedWidth}px`,
                minWidth: `${totalFixedWidth}px`,
                padding: `${padding - 1}px`,
              }}
            >
              <div className="flex items-center justify-between w-full">
                {/* Левая часть с аватаром, именем и должностью */}
                <div className="flex items-center" style={{ paddingLeft: '40px' }}>
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
                      e.stopPropagation()
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

          {/* Ячейки таймлайна с полосками загрузок */}
          <div className="flex-1 flex w-full" style={{ position: "relative", flexWrap: "nowrap" }}>
            {/* Overlay с полосками загрузок */}
            <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 4 }}>
              {(() => {
                // ВЕРТИКАЛЬНОЕ РАЗМЕЩЕНИЕ: загрузки размещаются одна под другой только при пересечении во времени

                return barRenders.map((bar, idx) => {
                  const barHeight = BASE_BAR_HEIGHT * (bar.period.rate || 1)

                  // Находим все полосы, которые пересекаются с текущей по времени И имеют меньший layer
                  const overlappingBars = barRenders.filter(other =>
                    other.period.startDate <= bar.period.endDate &&
                    other.period.endDate >= bar.period.startDate &&
                    other.layer < bar.layer
                  )

                  // Рассчитываем top на основе ТОЛЬКО пересекающихся полос
                  let top = 8 // Начальный отступ
                  if (overlappingBars.length > 0) {
                    const layersMap = new Map<number, number>()
                    overlappingBars.forEach(other => {
                      const otherHeight = BASE_BAR_HEIGHT * (other.period.rate || 1)
                      layersMap.set(other.layer, Math.max(layersMap.get(other.layer) || 0, otherHeight))
                    })

                    // Суммируем высоты только тех слоёв, которые реально пересекаются
                    for (let i = 0; i < bar.layer; i++) {
                      if (layersMap.has(i)) {
                        top += layersMap.get(i)! + BAR_GAP
                      }
                    }
                  }

                  return (
                    <div
                      key={`${bar.period.id}-${idx}`}
                      className={cn(
                        "absolute rounded transition-all duration-200 pointer-events-auto flex items-center",
                        bar.period.type === "loading" ? "cursor-pointer hover:brightness-110" : "cursor-default"
                      )}
                      style={{
                        left: `${bar.left}px`,
                        width: `${bar.width}px`,
                        height: `${barHeight}px`,
                        top: `${top}px`,
                        backgroundColor: bar.color,
                        opacity: 0.9,
                        border: `2px solid ${bar.color}`,
                        paddingLeft: "6px",
                        paddingRight: "6px",
                        overflow: "hidden",
                        whiteSpace: "nowrap",
                        textOverflow: "ellipsis",
                        filter: "brightness(1.1)",
                      }}
                      title={formatBarTooltip(bar.period)}
                      onClick={(e) => {
                        e.stopPropagation()
                        if (bar.period.type === "loading" && bar.period.loading) {
                          setEditingLoading(bar.period.loading)
                        }
                      }}
                    >
                      <span
                        className={cn(
                          "text-[9px] font-semibold leading-none",
                          theme === "dark" ? "text-white" : "text-white"
                        )}
                        style={{
                          textShadow: "0 1px 2px rgba(0,0,0,0.5)",
                        }}
                      >
                        {formatBarLabel(bar.period)}
                      </span>
                    </div>
                  )
                })
              })()}
            </div>

            {/* Базовые ячейки таймлайна (фон, границы, выходные) */}
            {timeUnits.map((unit, i) => {
              const isWeekendDay = unit.isWeekend
              const isTodayDate = isToday(unit.date)
              const isMonthBoundary = i === 0 || i === timeUnits.length - 1

              return (
                <div
                  key={i}
                  className={cn(
                    "border-r relative border-b",
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
                    height: `${actualRowHeight}px`,
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
                />
              )
            })}
          </div>
        </div>
      </div>

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
      {/* Модальное окно редактирования загрузки */}
      {editingLoading && (
        <EditLoadingModal
          loading={editingLoading}
          setEditingLoading={setEditingLoading}
          theme={theme}
        />
      )}
    </>
  )
}
