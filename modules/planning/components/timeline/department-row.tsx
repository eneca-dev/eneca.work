"use client" 

import { cn } from "@/lib/utils"
import { ChevronDown, ChevronRight, Building2, Users, FolderKanban, FileText, Milestone, MessageSquare } from "lucide-react"
import type { Department, Employee, Loading, TimelineUnit } from "../../types"
import { isToday, isFirstDayOfMonth } from "../../utils/date-utils"
import { usePlanningColumnsStore } from "../../stores/usePlanningColumnsStore"
import { usePlanningStore } from "../../stores/usePlanningStore"
import { useUiStore } from "@/stores/useUiStore"
import { useState, Fragment, useMemo } from "react"
import { Avatar, Tooltip } from "../avatar"
import { LoadingModal } from "./loading-modal"
import { AddShortageModal } from "./AddShortageModal"
import { FreshnessIndicator } from "./FreshnessIndicator"
import { useTeamActivityPermissions } from "../../hooks/useTeamActivityPermissions"
import {
  loadingsToPeriods,
  calculateBarRenders,
  calculateBarTop,
  splitPeriodByNonWorkingDays,
  formatBarLabel,
  formatBarTooltip,
  getBarLabelParts,
  BASE_BAR_HEIGHT,
  BAR_GAP,
  type BarPeriod,
} from "./loading-bars-utils"

interface DepartmentRowProps {
  department: Department
  departmentIndex: number
  timeUnits: TimelineUnit[]
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

  // Получаем данные freshness из стора и функцию подтверждения
  const freshnessCache = usePlanningStore(s => s.freshnessCache.data)
  const confirmActivity = usePlanningStore(s => s.confirmTeamActivity)
  const confirmMultipleActivity = usePlanningStore(s => s.confirmMultipleTeamsActivity)

  // Проверка прав на актуализацию данных команды
  const { canActualizeDepartment, canActualizeTeam } = useTeamActivityPermissions()

  // Вычисляем freshness для отдела на основе команд (максимум = самые старые данные)
  const departmentFreshness = useMemo(() => {
    if (!department.teams || department.teams.length === 0) return undefined

    // Собираем данные freshness всех команд
    const teamFreshness = department.teams
      .map(team => freshnessCache[team.id])
      .filter((f): f is NonNullable<typeof f> => f !== undefined && f.daysSinceUpdate !== undefined)

    if (teamFreshness.length === 0) return undefined

    // Находим команду с максимальным daysSinceUpdate (самые старые данные)
    const oldestTeam = teamFreshness.reduce((max, current) =>
      current.daysSinceUpdate! > max.daysSinceUpdate! ? current : max
    )

    return {
      daysSinceUpdate: oldestTeam.daysSinceUpdate,
      lastUpdate: oldestTeam.lastUpdate
    }
  }, [department.teams, freshnessCache])

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
                  ? "border-slate-700 bg-slate-800 group-hover/row:bg-slate-700"
                  : "border-slate-200 bg-white group-hover/row:bg-slate-100",
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

              {/* Правая часть с индикатором актуальности */}
              <div className="flex items-center gap-2 pr-2">
                {departmentFreshness && (
                  <FreshnessIndicator
                    teamId={department.teams[0]?.id || department.id}
                    teamName={department.name}
                    daysSinceUpdate={departmentFreshness.daysSinceUpdate}
                    lastUpdate={departmentFreshness.lastUpdate}
                    theme={theme === 'dark' ? 'dark' : 'light'}
                    size="sm"
                    onConfirm={confirmActivity}
                    teamIds={department.teams.map(t => t.id)}
                    onConfirmMultiple={confirmMultipleActivity}
                    disabled={!canActualizeDepartment()}
                    tooltipSide={departmentIndex === 0 ? 'left' : 'top'}
                  />
                )}
              </div>
            </div>



            {/* Столбец "Объект" (может быть скрыт) */}
            {columnVisibility.object && (
              <div
                className={cn(
                  "p-3 transition-colors h-full flex items-center justify-center border-b border-r",
                  theme === "dark"
                    ? "border-slate-700 bg-slate-800 group-hover/row:bg-slate-700"
                    : "border-slate-200 bg-white group-hover/row:bg-slate-100",
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
              // Используем isWorkingDay для определения нерабочих дней (выходные, праздники, переносы)
              const isWeekendDay = unit.isWorkingDay === false
              const isTodayDate = isToday(unit.date)
              const isFirstDayOfMonthDate = isFirstDayOfMonth(unit.date)
              const isLastDayOfMonthDate = i === timeUnits.length - 1 // Проверяем, является ли это последним днем месяца

              // Получаем суммарную загрузку отдела на эту дату
              const dateKey = unit.date.toISOString().split("T")[0]
              const departmentWorkload = department.dailyWorkloads?.[dateKey] || 0

              // Рассчитываем процент загрузки отдела (только для рабочих дней)
              const departmentLoadPercentage =
                !isWeekendDay && totalDepartmentCapacity > 0
                  ? Math.round((departmentWorkload / totalDepartmentCapacity) * 100)
                  : 0

              return (
                <div
                  key={i}
                  className={cn(
                    "border-r relative transition-colors border-b", // Добавлена border-b
                    theme === "dark" ? "border-slate-700" : "border-slate-200",
                    isWeekendDay ? (theme === "dark" ? "bg-slate-900/80" : "") : "",
                    isTodayDate ? (theme === "dark" ? "bg-teal-600/30" : "bg-teal-400/40") : "",
                    theme === "dark" ? "group-hover/row:bg-slate-700/50" : "group-hover/row:bg-slate-200/50",
                    isFirstDayOfMonth(unit.date)
                      ? theme === "dark"
                        ? "border-l border-l-slate-60"
                        : "border-l border-l-slate-300"
                      : "",
                    isLastDayOfMonthDate ? "border-r-0" : "",
                  )}
                  style={{
                    height: `${rowHeight}px`,
                    width: `${unit.width ?? cellWidth}px`,
                    minWidth: `${unit.width ?? cellWidth}px`, // Добавляем минимальную ширину
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
                          "rounded-sm pointer-events-auto relative",
                          departmentLoadPercentage > 100
                            ? (theme === "dark" ? "border-2 border-red-400" : "border-2 border-red-500")
                            : departmentLoadPercentage >= 90
                              ? (theme === "dark" ? "border-2 border-teal-400" : "border-2 border-teal-500")
                              : (theme === "dark" ? "border border-amber-500/50" : "border border-amber-600/50")
                        )}
                        style={{
                          width: `${Math.max(cellWidth - 6, 3)}px`,
                          height: `${rowHeight - 10}px`,
                          opacity: 0.9
                        }}
                        title={`Загрузка отдела: ${departmentLoadPercentage}%`}
                      >
                        {/* Внутренняя заливка, показывающая процент загрузки */}
                        <div
                          className={cn(
                            "absolute bottom-0 left-0 right-0",
                            departmentLoadPercentage > 100
                              ? "bg-red-500"
                              : departmentLoadPercentage >= 90
                                ? "bg-teal-500"
                                : "bg-amber-500"
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
                canActualizeTeam={canActualizeTeam}
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
  timeUnits: TimelineUnit[]
  theme: string
  rowHeight: number
  padding: number
  cellWidth: number
  totalFixedWidth: number
  isExpanded: boolean
  onToggleExpand: () => void
  canActualizeTeam: (teamId: string) => boolean
}

function TeamRow({ team, timeUnits, theme, rowHeight, padding, cellWidth, totalFixedWidth, isExpanded, onToggleExpand, canActualizeTeam }: TeamRowProps) {
  const reducedRowHeight = Math.floor(rowHeight * 0.75)
  // Емкость команды: только реальные сотрудники, без строки дефицита
  const totalTeamCapacity = (team.employees || [])
    .filter((e) => !(e as any).isShortage)
    .reduce((sum, e) => sum + (e.employmentRate || 1), 0)
  const [showAddShortage, setShowAddShortage] = useState(false)

  // Получаем данные freshness для команды
  const freshness = usePlanningStore(s => s.freshnessCache.data[team.id])
  const confirmActivity = usePlanningStore(s => s.confirmTeamActivity)

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
            {/* Индикатор актуальности и кнопка добавления дефицита для команды */}
            <div className="flex items-center gap-2">
              <FreshnessIndicator
                teamId={team.id}
                teamName={team.name}
                daysSinceUpdate={freshness?.daysSinceUpdate}
                lastUpdate={freshness?.lastUpdate}
                theme={theme === 'dark' ? 'dark' : 'light'}
                size="sm"
                onConfirm={confirmActivity}
                disabled={!canActualizeTeam(team.id)}
              />
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
            // Используем isWorkingDay для определения нерабочих дней (выходные, праздники, переносы)
            const isWeekendDay = unit.isWorkingDay === false
            const isTodayDate = isToday(unit.date)
            const dateKey = unit.date.toISOString().split("T")[0]
            const workload = (team.dailyWorkloads || {})[dateKey] || 0
            // Рассчитываем процент загрузки команды (только для рабочих дней)
            const loadPct = !isWeekendDay && totalTeamCapacity > 0 ? Math.round((workload / totalTeamCapacity) * 100) : 0

            return (
              <div
                key={i}
                className={cn(
                  "border-r relative transition-colors border-b",
                  theme === "dark" ? "border-slate-700" : "border-slate-200",
                  isWeekendDay ? (theme === "dark" ? "bg-slate-900/80" : "") : "",
                  isTodayDate ? (theme === "dark" ? "bg-teal-600/30" : "bg-teal-400/40") : "",
                  theme === "dark" ? "group-hover/row:bg-slate-700/50" : "group-hover/row:bg-slate-200/50",
                  isFirstDayOfMonth(unit.date)
                    ? theme === "dark"
                      ? "border-l border-l-slate-600"
                      : "border-l border-l-slate-300"
                    : "",
                  i === timeUnits.length - 1 ? "border-r-0" : "",
                )}
                style={{
                  height: `${reducedRowHeight}px`,
                  width: `${unit.width ?? cellWidth}px`,
                  minWidth: `${unit.width ?? cellWidth}px`,
                  flexShrink: 0,
                  borderRight: "1px solid",
                  borderRightColor: theme === "dark" ? "rgb(51, 65, 85)" : "rgb(226, 232, 240)",
                }}
              >
                {loadPct > 0 && (
                  <div className="absolute inset-0 flex items-end justify-center p-1 pointer-events-none">
                    <div
                      className={cn(
                        "rounded-sm pointer-events-auto relative",
                        loadPct > 100
                          ? (theme === "dark" ? "border-2 border-red-400" : "border-2 border-red-500")
                          : loadPct >= 90
                            ? (theme === "dark" ? "border-2 border-teal-400" : "border-2 border-teal-500")
                            : (theme === "dark" ? "border border-amber-500/50" : "border border-amber-600/50")
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
                          "absolute bottom-0 left-0 right-0",
                          loadPct > 100
                            ? "bg-red-500"
                            : loadPct >= 90
                              ? "bg-teal-500"
                              : "bg-amber-500"
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
  timeUnits: TimelineUnit[]
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
  const [showLoadingModal, setShowLoadingModal] = useState(false)
  const [showAddShortage, setShowAddShortage] = useState(false)
  // Состояние для редактирования загрузки
  const [editingLoading, setEditingLoading] = useState<Loading | null>(null)

  // Состояние для отслеживания наведения на аватар
  const [hoveredAvatar, setHoveredAvatar] = useState(false)

  // Получаем видимость столбцов из стора
  const { columnVisibility } = usePlanningColumnsStore()

  // Базовая высота строки сотрудника (90% от rowHeight)
  const reducedRowHeight = Math.floor(rowHeight * 0.9)

  const allPeriods = useMemo(() => {
    const loadingPeriods = loadingsToPeriods(employee.loadings)
    return loadingPeriods
  }, [employee.loadings])

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

  // Динамический расчёт высоты строки на основе загрузок
  const actualRowHeight = useMemo(() => {
    if (barRenders.length === 0) return reducedRowHeight

    // Рассчитываем необходимую высоту для вертикального размещения всех полосок
    let maxBottom = 0

    barRenders.forEach(bar => {
      const barHeight = BASE_BAR_HEIGHT * (bar.period.rate || 1)

      // Используем централизованную функцию для расчёта top
      const top = calculateBarTop(bar, barRenders, BASE_BAR_HEIGHT, BAR_GAP, 8)

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
                        setShowLoadingModal(true)
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

                  // Используем централизованную функцию для расчёта top
                  const top = calculateBarTop(bar, barRenders, BASE_BAR_HEIGHT, BAR_GAP, 8)

                  return (
                    <div
                      key={`${bar.period.id}-${idx}`}
                      className={cn(
                        "absolute rounded transition-all duration-200 pointer-events-auto",
                        // Всегда используем горизонтальное выравнивание
                        "flex items-center",
                        // Курсор pointer для загрузок (можно редактировать)
                        bar.period.type === "loading" && "cursor-pointer hover:brightness-110"
                      )}
                      style={{
                        left: `${bar.left}px`,
                        width: `${bar.width}px`,
                        height: `${barHeight}px`,
                        top: `${top}px`,
                        backgroundColor: bar.color,
                        opacity: 0.8,
                        border: `2px solid ${bar.color}`,
                        paddingLeft: "6px",
                        paddingRight: "6px",
                        paddingTop: "4px",
                        paddingBottom: "4px",
                        overflow: "hidden",
                        filter: "brightness(1.1)",
                      }}
                      title={formatBarTooltip(bar.period)}
                      onClick={() => {
                        // Открыть модалку редактирования для загрузок
                        if (bar.period.type === "loading" && bar.period.loading) {
                          setEditingLoading(bar.period.loading)
                        }
                      }}
                    >
                      {/* Контейнер для текста - должен быть поверх оверлея выходных */}
                      <div className="relative w-full h-full flex items-center" style={{ zIndex: 2 }}>
                        {(() => {
                          // Адаптивное отображение для загрузок
                          if (bar.period.type === "loading") {
                          const labelParts = getBarLabelParts(bar.period, bar.width)
                          const rate = bar.period.rate || 1
                          const hasComment = !!bar.period.comment

                          // Определяем максимальное количество строк в зависимости от rate (высоты)
                          let maxLines = 3
                          if (rate < 0.5) {
                            maxLines = 1 // Очень низкие бары - только одна строка
                          } else if (rate < 1) {
                            maxLines = 2 // Средние бары - максимум 2 строки
                          }

                          if (labelParts.displayMode === 'icon-only') {
                            return (
                              <FolderKanban
                                size={11}
                                className="text-white"
                                style={{ filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.5))" }}
                              />
                            )
                          }

                          if (labelParts.displayMode === 'minimal') {
                            // Узкие бары - многострочное отображение, используем высоту
                            const displayText = labelParts.project || labelParts.stage

                            if (maxLines === 1) {
                              // Одна строка для маленьких баров
                              return (
                                <span
                                  className="text-[10px] font-semibold text-white truncate"
                                  style={{ textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}
                                  title={displayText}
                                >
                                  {displayText}
                                </span>
                              )
                            }

                            let lineCount = 0
                            return (
                              <div className="flex flex-col justify-center items-start overflow-hidden w-full h-full" style={{ gap: "2px" }}>
                                {labelParts.project && lineCount < maxLines && (() => { lineCount++; return (
                                  <div className="flex items-center gap-1 w-full overflow-hidden">
                                    <FolderKanban size={9} className="text-white flex-shrink-0" style={{ filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.5))" }} />
                                    <span
                                      className="text-[10px] font-semibold text-white truncate"
                                      style={{ textShadow: "0 1px 2px rgba(0,0,0,0.5)", lineHeight: "1.3" }}
                                      title={labelParts.project}
                                    >
                                      {labelParts.project}
                                    </span>
                                  </div>
                                )})()}
                                {labelParts.stage && lineCount < maxLines && (() => { lineCount++; return (
                                  <div className="flex items-center gap-1 w-full overflow-hidden">
                                    <Milestone size={8} className="text-white/90 flex-shrink-0" style={{ filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.5))" }} />
                                    <span
                                      className="text-[9px] font-medium text-white/90 truncate"
                                      style={{ textShadow: "0 1px 2px rgba(0,0,0,0.5)", lineHeight: "1.3" }}
                                      title={labelParts.stage}
                                    >
                                      {labelParts.stage}
                                    </span>
                                  </div>
                                )})()}
                              </div>
                            )
                          }

                          if (labelParts.displayMode === 'compact') {
                            // Средние бары
                            const displayText = labelParts.project || labelParts.stage

                            if (maxLines === 1) {
                              const Icon = labelParts.project ? FolderKanban : Milestone
                              return (
                                <div className="flex items-center gap-1 overflow-hidden">
                                  <Icon size={10} className="text-white flex-shrink-0" style={{ filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.5))" }} />
                                  <span
                                    className="text-[10px] font-semibold text-white truncate"
                                    style={{ textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}
                                    title={displayText}
                                  >
                                    {displayText}
                                  </span>
                                </div>
                              )
                            }

                            let lineCount = 0
                            return (
                              <div className="flex flex-col justify-center items-start overflow-hidden w-full h-full" style={{ gap: "2px" }}>
                                {labelParts.project && lineCount < maxLines && (() => { lineCount++; return (
                                  <div className="flex items-center gap-1 w-full overflow-hidden">
                                    <FolderKanban size={10} className="text-white flex-shrink-0" style={{ filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.5))" }} />
                                    <span
                                      className="text-[10px] font-semibold text-white truncate"
                                      style={{ textShadow: "0 1px 2px rgba(0,0,0,0.5)", lineHeight: "1.3" }}
                                      title={labelParts.project}
                                    >
                                      {labelParts.project}
                                    </span>
                                  </div>
                                )})()}
                                {labelParts.stage && lineCount < maxLines && (() => { lineCount++; return (
                                  <div className="flex items-center gap-1 w-full overflow-hidden">
                                    <Milestone size={9} className="text-white/90 flex-shrink-0" style={{ filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.5))" }} />
                                    <span
                                      className="text-[9px] font-medium text-white/90 truncate"
                                      style={{ textShadow: "0 1px 2px rgba(0,0,0,0.5)", lineHeight: "1.3" }}
                                      title={labelParts.stage}
                                    >
                                      {labelParts.stage}
                                    </span>
                                  </div>
                                )})()}
                              </div>
                            )
                          }

                          // full mode - многострочное отображение с иконками
                          if (maxLines === 1) {
                            const displayText = labelParts.project || labelParts.stage
                            const Icon = labelParts.project ? FolderKanban : Milestone
                            return (
                              <div className="flex items-center gap-1 overflow-hidden">
                                <Icon size={10} className="text-white flex-shrink-0" style={{ filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.5))" }} />
                                <span
                                  className="text-[11px] font-semibold text-white truncate"
                                  style={{ textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}
                                  title={displayText}
                                >
                                  {displayText}
                                </span>
                              </div>
                            )
                          }

                          let lineCount = 0
                          return (
                            <div className="flex flex-col justify-center overflow-hidden w-full" style={{ gap: "1px" }}>
                              {labelParts.project && lineCount < maxLines && (() => { lineCount++; return (
                                <div className="flex items-center gap-1 overflow-hidden">
                                  <FolderKanban size={9} className="text-white flex-shrink-0" style={{ filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.5))" }} />
                                  <span
                                    className="text-[10px] font-semibold text-white truncate"
                                    style={{
                                      textShadow: "0 1px 2px rgba(0,0,0,0.5)",
                                      lineHeight: "1.2"
                                    }}
                                    title={labelParts.project}
                                  >
                                    {labelParts.project}
                                  </span>
                                </div>
                              )})()}
                              {labelParts.stage && lineCount < maxLines && (() => { lineCount++; return (
                                <div className="flex items-center gap-1 overflow-hidden">
                                  <Milestone size={8} className="text-white/90 flex-shrink-0" style={{ filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.5))" }} />
                                  <span
                                    className="text-[9px] font-medium text-white/90 truncate"
                                    style={{
                                      textShadow: "0 1px 2px rgba(0,0,0,0.5)",
                                      lineHeight: "1.2"
                                    }}
                                    title={labelParts.stage}
                                  >
                                    {labelParts.stage}
                                  </span>
                                </div>
                              )})()}

                              {/* Блок комментария */}
                              {hasComment && (
                                rate >= 0.5 ? (
                                  // Для высоких полосок (≥ 0.5 ставки): иконка + текст в несколько строк
                                  <div className="flex items-start gap-1 mt-0.5" title={bar.period.comment}>
                                    <MessageSquare className="w-3 h-3 flex-shrink-0 text-white/70" style={{ filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.5))" }} />
                                    <span
                                      className="text-[9px] font-medium text-white tracking-wide leading-tight overflow-hidden"
                                      style={{
                                        display: '-webkit-box',
                                        WebkitLineClamp: Math.max(1, maxLines - 1),
                                        WebkitBoxOrient: 'vertical',
                                        textShadow: "0 1px 2px rgba(0,0,0,0.5)"
                                      }}
                                    >
                                      {bar.period.comment}
                                    </span>
                                  </div>
                                ) : (
                                  // Для низких полосок (< 0.5 ставки): только иконка
                                  <div title={bar.period.comment}>
                                    <MessageSquare
                                      className="w-3 h-3 text-white/70"
                                      style={{ filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.5))" }}
                                    />
                                  </div>
                                )
                              )}
                            </div>
                          )
                        }

                        // Для отпусков, больничных и отгулов - простой текст
                        return (
                          <span
                            className="text-[10px] font-semibold leading-none text-white"
                            style={{ textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}
                          >
                            {formatBarLabel(bar.period)}
                          </span>
                        )
                        })()}
                      </div>

                      {/* Overlay для нерабочих дней */}
                      {(() => {
                        const nonWorkingSegments = splitPeriodByNonWorkingDays(bar.startIdx, bar.endIdx, timeUnits)
                        const HORIZONTAL_GAP = 6 // Константа из loading-bars-utils.ts

                        return nonWorkingSegments.map((segment, segmentIdx) => {
                          // Вычисляем left относительно бара, но компенсируем HORIZONTAL_GAP чтобы совпадать с сеткой
                          const barStartLeft = timeUnits[bar.startIdx]?.left ?? 0
                          const segmentStartLeft = timeUnits[segment.startIdx]?.left ?? 0
                          const overlayLeft = segmentStartLeft - barStartLeft - HORIZONTAL_GAP / 2

                          let overlayWidth = 0
                          for (let idx = segment.startIdx; idx <= segment.endIdx; idx++) {
                            overlayWidth += timeUnits[idx]?.width ?? cellWidth
                          }
                          overlayWidth -= 3 // Делаем правый край на 2px левее

                          return (
                            <div
                              key={`non-working-${segmentIdx}`}
                              className="absolute pointer-events-none"
                              style={{
                                left: `${overlayLeft}px`,
                                width: `${overlayWidth}px`,
                                top: '-3px',
                                bottom: '-3px',
                                backgroundColor: theme === 'dark' ? 'rgba(0, 0, 0, 0.25)' : 'rgba(255, 255, 255, 0.25)',
                                borderTop: `3px dashed ${bar.color}`,
                                borderBottom: `3px dashed ${bar.color}`,
                                zIndex: 1,
                              }}
                            />
                          )
                        })
                      })()}
                    </div>
                  )
                })
              })()}
            </div>

            {/* Базовые ячейки таймлайна (фон, границы, выходные) */}
            {timeUnits.map((unit, i) => {
              // Используем isWorkingDay для определения нерабочих дней (выходные, праздники, переносы)
              const isWeekendDay = unit.isWorkingDay === false
              const isTodayDate = isToday(unit.date)
              const isMonthBoundary = i === 0 || i === timeUnits.length - 1

              return (
                <div
                  key={i}
                  className={cn(
                    "border-r relative border-b",
                    theme === "dark" ? "border-slate-700" : "border-slate-200",
                    isWeekendDay ? (theme === "dark" ? "bg-slate-900/80" : "") : "",
                    isTodayDate ? (theme === "dark" ? "bg-teal-600/30" : "bg-teal-400/40") : "",
                    theme === "dark" ? "group-hover/employee:bg-slate-700/50" : "group-hover/employee:bg-slate-200/50",
                    isFirstDayOfMonth(unit.date)
                      ? theme === "dark"
                        ? "border-l border-l-slate-600"
                        : "border-l border-l-slate-300"
                      : "",
                    isMonthBoundary && i === timeUnits.length - 1 ? "border-r-0" : "",
                  )}
                  style={{
                    height: `${actualRowHeight}px`,
                    width: `${unit.width ?? cellWidth}px`,
                    minWidth: `${unit.width ?? cellWidth}px`,
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

      {/* Модальное окно для создания загрузки */}
      <LoadingModal
        isOpen={showLoadingModal}
        onClose={() => setShowLoadingModal(false)}
        theme={theme}
        employee={employee}
        mode="create"
      />

      {/* Модальное окно для редактирования загрузки */}
      {editingLoading && (
        <LoadingModal
          isOpen={!!editingLoading}
          onClose={() => setEditingLoading(null)}
          theme={theme}
          mode="edit"
          loading={editingLoading}
          onLoadingUpdated={() => {
            // Store автоматически обновит state через realtime subscriptions
          }}
        />
      )}

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
    </>
  )
}
