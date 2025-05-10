"use client"

import { useState, useMemo, useEffect } from "react"
import { useRoadmap } from "@/components/roadmap/context/roadmap-context"
import { mockProfiles, mockTeams } from "@/data/mock-profiles"
import { mockDepartments } from "@/data/mock-profiles"
import { formatDate } from "@/lib/date-utils"
import { ChevronUp, ChevronDown, Filter, X } from "lucide-react"
import { TeamGroup } from "./team-group"
import { cn } from "@/lib/utils"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

interface DepartmentEmployeeTimelineProps {
  departmentId: string | null
}

export function DepartmentEmployeeTimeline({ departmentId }: DepartmentEmployeeTimelineProps) {
  const { workingDays, CELL_WIDTH, sidebarWidth, responsibleColumnWidth, project } = useRoadmap()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null)

  // Добавляем состояние для отслеживания развернутости команд
  const [expandedTeams, setExpandedTeams] = useState<Record<string, boolean>>({})

  // Получаем информацию о выбранном отделе
  const selectedDepartment = useMemo(() => {
    if (!departmentId) return null
    return mockDepartments.find((dept) => dept.department_id === departmentId)
  }, [departmentId])

  // Получаем сотрудников выбранного отдела, сгруппированных по командам
  const employeesByTeam = useMemo(() => {
    if (!departmentId) return []

    // Фильтруем сотрудников по отделу
    const departmentEmployees = mockProfiles.filter((profile) => profile.department_id === departmentId)

    // Группируем по командам
    const teams = new Map()

    departmentEmployees.forEach((employee) => {
      const teamId = employee.team_id
      if (!teams.has(teamId)) {
        const team = mockTeams.find((t) => t.team_id === teamId)
        teams.set(teamId, {
          id: teamId,
          team_name: team ? team.team_name : "Без команды",
          employees: [],
        })
      }

      teams.get(teamId).employees.push(employee)
    })

    // Сортируем команды по имени
    return Array.from(teams.values()).sort((a, b) => {
      // Проверяем, что имена команд определены
      const nameA = a.team_name || ""
      const nameB = b.team_name || ""
      return nameA.localeCompare(nameB)
    })
  }, [departmentId])

  // Фильтруем команды на основе выбранной команды
  const filteredTeams = useMemo(() => {
    if (!selectedTeamId) return employeesByTeam
    return employeesByTeam.filter((team) => team.id === selectedTeamId)
  }, [employeesByTeam, selectedTeamId])

  // Инициализируем состояние развернутости команд при изменении списка команд
  useEffect(() => {
    const initialExpandedState = {}
    employeesByTeam.forEach((team) => {
      initialExpandedState[team.id] = true // По умолчанию все команды развернуты
    })
    setExpandedTeams(initialExpandedState)
  }, [employeesByTeam])

  // Обработчик переключения состояния развернутости команды
  const handleTeamExpandToggle = (teamId: string, isExpanded: boolean) => {
    setExpandedTeams((prev) => ({
      ...prev,
      [teamId]: isExpanded,
    }))
  }

  // Обработчик изменения выбранной команды
  const handleTeamChange = (teamId: string) => {
    setSelectedTeamId(teamId === "all" ? null : teamId)
  }

  // Обработчик сброса фильтра команды
  const handleClearTeamFilter = () => {
    setSelectedTeamId(null)
  }

  // Рассчитываем загрузку сотрудников по дням
  const employeeWorkloads = useMemo(() => {
    if (!project || !departmentId) return {}

    const workloads = {}

    // Инициализируем загрузку для всех сотрудников отдела
    mockProfiles
      .filter((profile) => profile.department_id === departmentId)
      .forEach((profile) => {
        workloads[profile.user_id] = {}

        // Инициализируем все дни с нулевой загрузкой
        workingDays.forEach((day) => {
          const dateKey = formatDate(day)
          workloads[profile.user_id][dateKey] = 0
        })
      })

    // Проходим по всем разделам и задачам проекта
    project.sections.forEach((section) => {
      if (!section.stages) return

      section.stages.forEach((stage) => {
        // Фильтруем только фактические загрузки
        const factLoadings = stage.loadings.filter((loading) => !loading.type || loading.type === "Fact")

        factLoadings.forEach((loading) => {
          const userId = loading.user_id || loading.executorId

          // Проверяем, принадлежит ли сотрудник выбранному отделу
          const profile = mockProfiles.find((p) => p.user_id === userId)
          if (!profile || profile.department_id !== departmentId) return

          const startDate = new Date(loading.date_start || loading.startDate)
          const endDate = new Date(loading.date_end || loading.endDate)

          // Для каждого дня в диапазоне загрузки
          workingDays.forEach((day) => {
            if (day >= startDate && day <= endDate) {
              const dateKey = formatDate(day)

              // Суммируем ставки
              if (!workloads[userId][dateKey]) {
                workloads[userId][dateKey] = 0
              }

              workloads[userId][dateKey] += loading.rate
            }
          })
        })
      })
    })

    return workloads
  }, [project, departmentId, workingDays])

  // Если нет выбранного отдела или это не режим отдела, не отображаем компонент
  if (!departmentId || !selectedDepartment) {
    return null
  }

  // Получаем название выбранной команды для отображения
  const selectedTeamName = selectedTeamId ? employeesByTeam.find((team) => team.id === selectedTeamId)?.team_name : null

  // Форматируем название команды (убираем "Команда " из названия)
  const formattedTeamName = selectedTeamName ? selectedTeamName.replace(/^Команда\s+/i, "") : null

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t-2 border-primary/30 dark:border-primary/20 shadow-lg z-10">
      {/* Заголовок с возможностью сворачивания и фильтром по командам */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-100 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center cursor-pointer" onClick={() => setIsCollapsed(!isCollapsed)}>
          <div className="w-1 h-5 bg-primary rounded-full mr-2"></div>
          <h3 className="font-medium text-slate-800 dark:text-slate-200">
            Загрузка сотрудников: {selectedDepartment.department_name}
          </h3>
          <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">
            ({employeesByTeam.reduce((acc, team) => acc + team.employees.length, 0)} сотрудников)
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Фильтр по командам */}
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-white dark:bg-slate-900 rounded-md border border-slate-200 dark:border-slate-700 h-8">
              <div className="px-2 flex items-center gap-1">
                <Filter size={14} className="text-slate-500 dark:text-slate-400" />
                <span className="text-xs text-slate-600 dark:text-slate-300">Команда:</span>
              </div>
              <Select value={selectedTeamId || "all"} onValueChange={handleTeamChange}>
                <SelectTrigger className="border-0 h-full min-w-[120px] focus:ring-0 focus:ring-offset-0 text-xs">
                  <SelectValue placeholder="Все команды" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">
                    Все команды
                  </SelectItem>
                  {employeesByTeam.map((team) => (
                    <SelectItem key={team.id} value={team.id} className="text-xs">
                      {team.team_name.replace(/^Команда\s+/i, "")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedTeamId && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-full w-8 p-0 hover:bg-slate-100 dark:hover:bg-slate-800"
                  onClick={handleClearTeamFilter}
                >
                  <X size={14} className="text-slate-500 dark:text-slate-400" />
                </Button>
              )}
            </div>
          </div>

          {/* Индикатор активного фильтра */}
          {selectedTeamId && (
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs">
              {formattedTeamName}
              <X size={12} className="ml-1 cursor-pointer" onClick={handleClearTeamFilter} />
            </Badge>
          )}

          {/* Кнопка сворачивания/разворачивания */}
          <button
            className="p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-primary"
            onClick={() => setIsCollapsed(!isCollapsed)}
          >
            {isCollapsed ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {/* Содержимое таблицы */}
      {!isCollapsed && (
        <div className="max-h-[300px] overflow-auto bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
          <div className="flex">
            {/* Левая панель с именами сотрудников */}
            <div
              className="sticky left-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 z-10 shadow-md"
              style={{
                width: `${sidebarWidth + responsibleColumnWidth}px`,
                minWidth: `${sidebarWidth + responsibleColumnWidth}px`,
              }}
            >
              {/* Список команд и сотрудников */}
              <div>
                {filteredTeams.map((team) => (
                  <TeamGroup
                    key={team.id}
                    team={team}
                    workloads={employeeWorkloads}
                    isExpanded={expandedTeams[team.id]}
                    onExpandToggle={handleTeamExpandToggle}
                  />
                ))}
              </div>
            </div>

            {/* Правая панель с датами и загрузкой */}
            <div className="flex-1 overflow-x-auto">
              {/* Строки с загрузкой сотрудников */}
              <div>
                {filteredTeams.map((team) => (
                  <div key={team.id}>
                    {/* Строка для заголовка команды */}
                    <div className="flex border-b border-slate-200 dark:border-slate-800" style={{ height: "32px" }}>
                      {workingDays.map((day, index) => (
                        <div
                          key={index}
                          className={cn(
                            "border-r border-slate-200 dark:border-slate-800",
                            day.getDay() === 0 || day.getDay() === 6 ? "bg-slate-50 dark:bg-slate-800/30" : "",
                          )}
                          style={{ width: `${CELL_WIDTH}px`, minWidth: `${CELL_WIDTH}px`, height: "100%" }}
                        ></div>
                      ))}
                    </div>

                    {/* Строки сотрудников - показываем только если команда развернута */}
                    {expandedTeams[team.id] &&
                      team.employees.map((employee) => (
                        <div
                          key={employee.user_id}
                          className="flex border-b border-slate-200 dark:border-slate-800"
                          style={{ height: "40px" }}
                        >
                          {workingDays.map((day, index) => {
                            const dateKey = formatDate(day)
                            const workload = employeeWorkloads[employee.user_id]?.[dateKey] || 0
                            const isWeekend = day.getDay() === 0 || day.getDay() === 6

                            // Определяем цвет ячейки в зависимости от загрузки
                            let bgColor = "bg-yellow-50 dark:bg-yellow-900/20" // По умолчанию желтый (0)
                            let textColor = "text-yellow-700 dark:text-yellow-300"

                            if (workload > 0 && workload < 0.8) {
                              bgColor = "bg-blue-50 dark:bg-blue-900/20"
                              textColor = "text-blue-700 dark:text-blue-300"
                            } else if (workload >= 0.8 && workload <= 1.1) {
                              bgColor = "bg-green-50 dark:bg-green-900/20"
                              textColor = "text-green-700 dark:text-green-300"
                            } else if (workload > 1.1) {
                              bgColor = "bg-red-50 dark:bg-red-900/20"
                              textColor = "text-red-700 dark:text-red-300"
                            }

                            return (
                              <div
                                key={index}
                                className={cn(
                                  "flex items-center justify-center border-r border-slate-200 dark:border-slate-800",
                                  isWeekend ? "bg-slate-50 dark:bg-slate-800/30" : "",
                                  workload > 0 ? bgColor : "",
                                )}
                                style={{ width: `${CELL_WIDTH}px`, minWidth: `${CELL_WIDTH}px`, height: "100%" }}
                              >
                                {workload > 0 && (
                                  <span className={cn("text-xs font-medium", textColor)}>{workload.toFixed(1)}</span>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

