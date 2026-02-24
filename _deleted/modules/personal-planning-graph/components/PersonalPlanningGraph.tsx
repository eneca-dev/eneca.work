"use client"

import { useState, useMemo, useCallback } from "react"
import { ChevronDown, Inbox, User, Users, CheckCircle2, PlayCircle, CircleDashed, PauseCircle, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { useTheme } from "next-themes"
import { format } from "date-fns"
import { ru } from "date-fns/locale"

// Import types
import type { Project } from "../types"

// Import mock data
import { mockProjects, mockEmployees, mockTeams, getTeamMembers } from "../mock-data"

// Import utils
import { calculateTimelineRange, generateDayCells } from "../utils"

// Import config
import { stageColors } from "../config"

// Import components
import { TimelineHeader } from "./TimelineHeader"
import { ProjectRow } from "./rows"

// View mode type
type ViewMode = "all" | "personal" | "team"

// Filter projects by employee name(s)
function filterProjectsByEmployees(projects: Project[], employeeNames: string[]): Project[] {
  if (employeeNames.length === 0) return projects

  return projects
    .map((project) => ({
      ...project,
      stages: project.stages
        .map((pStage) => ({
          ...pStage,
          objects: pStage.objects
            .map((obj) => ({
              ...obj,
              sections: obj.sections
                .map((section) => ({
                  ...section,
                  stages: section.stages.filter((stage) =>
                    // Include stage if employee has loadings, task work logs, or is responsible for tasks
                    stage.loadings.some((l) => employeeNames.includes(l.employeeName)) ||
                    stage.tasks.some((t) => (t.workLogs || []).some((w) => employeeNames.includes(w.employeeName))) ||
                    stage.tasks.some((t) => t.responsibleName && employeeNames.includes(t.responsibleName))
                  ),
                }))
                .filter((section) => section.stages.length > 0),
            }))
            .filter((obj) => obj.sections.length > 0),
        }))
        .filter((pStage) => pStage.objects.length > 0),
    }))
    .filter((project) => project.stages.length > 0)
}

export function PersonalPlanningGraph() {
  const { resolvedTheme } = useTheme()
  const theme = resolvedTheme === "dark" ? "dark" : "light"

  // View mode and filter state
  const [viewMode, setViewMode] = useState<ViewMode>("all")
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("")
  const [selectedTeamId, setSelectedTeamId] = useState<string>("")
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false)
  const [showTeamDropdown, setShowTeamDropdown] = useState(false)

  // Expanded state for each hierarchy level
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({})
  const [expandedProjectStages, setExpandedProjectStages] = useState<Record<string, boolean>>({})
  const [expandedObjects, setExpandedObjects] = useState<Record<string, boolean>>({})
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({})
  const [expandedStages, setExpandedStages] = useState<Record<string, boolean>>({})

  // Get selected employee/team info
  const selectedEmployee = useMemo(
    () => mockEmployees.find((e) => e.id === selectedEmployeeId),
    [selectedEmployeeId]
  )
  const selectedTeam = useMemo(
    () => mockTeams.find((t) => t.id === selectedTeamId),
    [selectedTeamId]
  )

  // Filter projects based on view mode
  const projects = useMemo(() => {
    if (viewMode === "personal" && selectedEmployee) {
      return filterProjectsByEmployees(mockProjects, [selectedEmployee.name])
    }
    if (viewMode === "team" && selectedTeam) {
      const teamMembers = getTeamMembers(selectedTeam.id)
      return filterProjectsByEmployees(mockProjects, teamMembers.map((m) => m.name))
    }
    return mockProjects
  }, [viewMode, selectedEmployee, selectedTeam])

  const timelineRange = useMemo(() => calculateTimelineRange(), [])
  const dayCells = useMemo(() => generateDayCells(timelineRange), [timelineRange])

  // Toggle functions for each level
  const toggleProject = useCallback((id: string) => {
    setExpandedProjects((prev) => ({ ...prev, [id]: !prev[id] }))
  }, [])

  const toggleProjectStage = useCallback((id: string) => {
    setExpandedProjectStages((prev) => ({ ...prev, [id]: !prev[id] }))
  }, [])

  const toggleObject = useCallback((id: string) => {
    setExpandedObjects((prev) => ({ ...prev, [id]: !prev[id] }))
  }, [])

  const toggleSection = useCallback((id: string) => {
    setExpandedSections((prev) => ({ ...prev, [id]: !prev[id] }))
  }, [])

  const toggleStage = useCallback((id: string) => {
    setExpandedStages((prev) => ({ ...prev, [id]: !prev[id] }))
  }, [])

  // Expand all projects
  const expandAll = useCallback(() => {
    const allProjects: Record<string, boolean> = {}
    projects.forEach((p) => (allProjects[p.id] = true))
    setExpandedProjects(allProjects)
  }, [projects])

  const collapseAll = useCallback(() => {
    setExpandedProjects({})
    setExpandedProjectStages({})
    setExpandedObjects({})
    setExpandedSections({})
    setExpandedStages({})
  }, [])

  const expandedCount = Object.values(expandedProjects).filter(Boolean).length

  // Calculate total stats
  const totalStats = useMemo(() => {
    let totalSections = 0
    let totalObjects = 0
    let totalProjectStages = 0

    projects.forEach(project => {
      totalProjectStages += project.stages.length
      project.stages.forEach(stage => {
        totalObjects += stage.objects.length
        stage.objects.forEach(obj => {
          totalSections += obj.sections.length
        })
      })
    })

    return { totalSections, totalObjects, totalProjectStages }
  }, [projects])

  return (
    <div
      className={cn(
        "flex flex-col h-full rounded-xl overflow-hidden border",
        theme === "dark" ? "bg-slate-900 border-slate-700/50" : "bg-white border-slate-200"
      )}
    >
      {/* Header */}
      <div
        className={cn(
          "flex items-center justify-between px-6 py-4 border-b",
          theme === "dark" ? "border-slate-700/50 bg-slate-900" : "border-slate-200 bg-slate-50"
        )}
      >
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            {viewMode === "personal" && selectedEmployee?.avatarUrl && (
              <img
                src={selectedEmployee.avatarUrl}
                alt={selectedEmployee.name}
                className="w-10 h-10"
              />
            )}
            <div>
              <h1
                className={cn(
                  "text-xl font-bold tracking-tight",
                  theme === "dark" ? "text-slate-100" : "text-slate-900"
                )}
              >
                {viewMode === "personal" && selectedEmployee
                  ? `График: ${selectedEmployee.name}`
                  : viewMode === "team" && selectedTeam
                  ? `Команда: ${selectedTeam.name}`
                  : "Персональный график"}
              </h1>
              <p className={cn("text-sm mt-0.5", theme === "dark" ? "text-slate-400" : "text-slate-500")}>
                {viewMode === "personal" && selectedEmployee
                  ? selectedEmployee.position
                  : viewMode === "team" && selectedTeam
                  ? `${selectedTeam.departmentName} • ${getTeamMembers(selectedTeam.id).length} сотрудников`
                  : `${format(timelineRange.start, "d MMMM", { locale: ru })} — ${format(timelineRange.end, "d MMMM yyyy", { locale: ru })}`}
              </p>
            </div>
          </div>

          {/* View mode tabs */}
          <div className={cn(
            "flex p-1",
            theme === "dark" ? "bg-slate-800" : "bg-slate-100"
          )}>
            <button
              onClick={() => {
                setViewMode("all")
                setSelectedEmployeeId("")
                setSelectedTeamId("")
              }}
              className={cn(
                "px-3 py-1.5 text-xs font-medium transition-colors",
                viewMode === "all"
                  ? theme === "dark"
                    ? "bg-slate-700 text-white"
                    : "bg-white text-slate-900 shadow-sm"
                  : theme === "dark"
                  ? "text-slate-400 hover:text-slate-200"
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              Все проекты
            </button>
            <button
              onClick={() => setViewMode("personal")}
              className={cn(
                "px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-1.5",
                viewMode === "personal"
                  ? theme === "dark"
                    ? "bg-slate-700 text-white"
                    : "bg-white text-slate-900 shadow-sm"
                  : theme === "dark"
                  ? "text-slate-400 hover:text-slate-200"
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              <User className="w-3.5 h-3.5" />
              Личный
            </button>
            <button
              onClick={() => setViewMode("team")}
              className={cn(
                "px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-1.5",
                viewMode === "team"
                  ? theme === "dark"
                    ? "bg-slate-700 text-white"
                    : "bg-white text-slate-900 shadow-sm"
                  : theme === "dark"
                  ? "text-slate-400 hover:text-slate-200"
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              <Users className="w-3.5 h-3.5" />
              Команда
            </button>
          </div>

          {/* Employee selector */}
          {viewMode === "personal" && (
            <div className="relative">
              <button
                onClick={() => {
                  setShowEmployeeDropdown(!showEmployeeDropdown)
                  setShowTeamDropdown(false)
                }}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 text-sm border transition-colors min-w-[200px]",
                  theme === "dark"
                    ? "bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700"
                    : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                )}
              >
                <User className="w-4 h-4 text-teal-500" />
                <span className="flex-1 text-left truncate">
                  {selectedEmployee ? selectedEmployee.name : "Выберите сотрудника"}
                </span>
                <ChevronDown className={cn(
                  "w-4 h-4 transition-transform",
                  showEmployeeDropdown && "rotate-180"
                )} />
              </button>

              {showEmployeeDropdown && (
                <div className={cn(
                  "absolute top-full left-0 mt-1 w-72 max-h-80 overflow-auto border shadow-lg z-50",
                  theme === "dark"
                    ? "bg-slate-800 border-slate-700"
                    : "bg-white border-slate-200"
                )}>
                  {mockTeams.map((team) => (
                    <div key={team.id}>
                      <div className={cn(
                        "px-3 py-2 text-xs font-semibold uppercase tracking-wider",
                        theme === "dark"
                          ? "bg-slate-900 text-slate-500"
                          : "bg-slate-50 text-slate-400"
                      )}>
                        {team.name}
                      </div>
                      {getTeamMembers(team.id).map((emp) => (
                        <button
                          key={emp.id}
                          onClick={() => {
                            setSelectedEmployeeId(emp.id)
                            setShowEmployeeDropdown(false)
                          }}
                          className={cn(
                            "w-full px-3 py-2 text-left text-sm flex items-center gap-2 transition-colors",
                            selectedEmployeeId === emp.id
                              ? theme === "dark"
                                ? "bg-teal-600/20 text-teal-300"
                                : "bg-teal-50 text-teal-700"
                              : theme === "dark"
                              ? "text-slate-300 hover:bg-slate-700"
                              : "text-slate-700 hover:bg-slate-50"
                          )}
                        >
                          {emp.avatarUrl ? (
                            <img
                              src={emp.avatarUrl}
                              alt={emp.name}
                              className="w-6 h-6 flex-shrink-0"
                            />
                          ) : (
                            <User className="w-4 h-4 flex-shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="truncate">{emp.name}</div>
                            <div className={cn(
                              "text-xs truncate",
                              theme === "dark" ? "text-slate-500" : "text-slate-400"
                            )}>
                              {emp.position}
                            </div>
                          </div>
                          {team.leaderId === emp.id && (
                            <span className={cn(
                              "text-[10px] px-1.5 py-0.5",
                              theme === "dark"
                                ? "bg-amber-500/20 text-amber-400"
                                : "bg-amber-100 text-amber-600"
                            )}>
                              Лид
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Team selector */}
          {viewMode === "team" && (
            <div className="relative">
              <button
                onClick={() => {
                  setShowTeamDropdown(!showTeamDropdown)
                  setShowEmployeeDropdown(false)
                }}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 text-sm border transition-colors min-w-[200px]",
                  theme === "dark"
                    ? "bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700"
                    : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                )}
              >
                <Users className="w-4 h-4 text-teal-500" />
                <span className="flex-1 text-left truncate">
                  {selectedTeam ? selectedTeam.name : "Выберите команду"}
                </span>
                <ChevronDown className={cn(
                  "w-4 h-4 transition-transform",
                  showTeamDropdown && "rotate-180"
                )} />
              </button>

              {showTeamDropdown && (
                <div className={cn(
                  "absolute top-full left-0 mt-1 w-72 border shadow-lg z-50",
                  theme === "dark"
                    ? "bg-slate-800 border-slate-700"
                    : "bg-white border-slate-200"
                )}>
                  {mockTeams.map((team) => {
                    const members = getTeamMembers(team.id)
                    const leader = mockEmployees.find((e) => e.id === team.leaderId)
                    return (
                      <button
                        key={team.id}
                        onClick={() => {
                          setSelectedTeamId(team.id)
                          setShowTeamDropdown(false)
                        }}
                        className={cn(
                          "w-full px-3 py-3 text-left text-sm transition-colors",
                          selectedTeamId === team.id
                            ? theme === "dark"
                              ? "bg-teal-600/20 text-teal-300"
                              : "bg-teal-50 text-teal-700"
                            : theme === "dark"
                            ? "text-slate-300 hover:bg-slate-700"
                            : "text-slate-700 hover:bg-slate-50"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4" />
                          <span className="font-medium">{team.name}</span>
                        </div>
                        <div className={cn(
                          "mt-1 text-xs flex items-center gap-2",
                          theme === "dark" ? "text-slate-500" : "text-slate-400"
                        )}>
                          <span>{team.departmentName}</span>
                          <span>•</span>
                          <span>{members.length} чел.</span>
                          {leader && (
                            <>
                              <span>•</span>
                              <span>Лид: {leader.name.split(" ")[0]}</span>
                            </>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={expandAll}
            className={cn(
              "px-3 py-1.5 text-xs font-medium transition-colors",
              theme === "dark"
                ? "bg-slate-800 text-slate-300 hover:bg-slate-700"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            )}
          >
            Развернуть все
          </button>
          <button
            onClick={collapseAll}
            className={cn(
              "px-3 py-1.5 text-xs font-medium transition-colors",
              theme === "dark"
                ? "bg-slate-800 text-slate-300 hover:bg-slate-700"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            )}
          >
            Свернуть все
          </button>
          <div
            className={cn(
              "px-3 py-1.5 text-xs font-medium",
              theme === "dark" ? "bg-teal-600/20 text-teal-300" : "bg-teal-100 text-teal-700"
            )}
          >
            {projects.length} проектов • {expandedCount} открыто
          </div>
        </div>
      </div>

      {/* Timeline container */}
      <div className="flex-1 overflow-auto relative">
        <div className="min-h-full">
          {/* Column headers */}
          <div
            className={cn(
              "sticky top-0 z-20 flex border-b",
              theme === "dark"
                ? "border-slate-700/50 bg-slate-900/95 backdrop-blur-sm"
                : "border-slate-200 bg-white/95 backdrop-blur-sm"
            )}
          >
            <div
              className={cn(
                "w-96 flex-shrink-0 pl-3 pr-4 border-r font-medium text-xs uppercase tracking-wider flex items-center",
                theme === "dark"
                  ? "border-slate-700/50 text-slate-400"
                  : "border-slate-200 text-slate-500"
              )}
              style={{ height: "64px" }}
            >
              Иерархия
            </div>
            <div className="flex-1 h-16">
              <TimelineHeader dayCells={dayCells} theme={theme} />
            </div>
          </div>

          {/* Team members bar for team view */}
          {viewMode === "team" && selectedTeam && (
            <div className={cn(
              "flex items-center gap-3 px-4 py-2 border-b",
              theme === "dark" ? "border-slate-700 bg-slate-800/50" : "border-slate-200 bg-slate-50"
            )}>
              <span className={cn(
                "text-xs font-medium",
                theme === "dark" ? "text-slate-400" : "text-slate-500"
              )}>
                Участники:
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                {getTeamMembers(selectedTeam.id).map((member) => {
                  const isLead = selectedTeam.leaderId === member.id
                  return (
                    <div
                      key={member.id}
                      className={cn(
                        "flex items-center gap-1.5 px-2 py-1 text-xs",
                        isLead
                          ? theme === "dark"
                            ? "bg-amber-500/20 text-amber-300"
                            : "bg-amber-100 text-amber-700"
                          : theme === "dark"
                          ? "bg-slate-700 text-slate-300"
                          : "bg-white text-slate-600 border border-slate-200"
                      )}
                    >
                      {member.avatarUrl ? (
                        <img
                          src={member.avatarUrl}
                          alt={member.name}
                          className="w-4 h-4 flex-shrink-0"
                        />
                      ) : (
                        <User className="w-3 h-3 flex-shrink-0" />
                      )}
                      <span>{member.name}</span>
                      {isLead && <span className="text-[10px] opacity-70">(лид)</span>}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Rows */}
          <div className="relative">
            {projects.length === 0 ? (
              <div className={cn(
                "flex flex-col items-center justify-center py-20",
                theme === "dark" ? "text-slate-400" : "text-slate-500"
              )}>
                <Inbox className="w-12 h-12 mb-4 opacity-50" />
                <p className="text-lg font-medium mb-1">
                  {viewMode === "personal" && !selectedEmployee
                    ? "Выберите сотрудника"
                    : viewMode === "team" && !selectedTeam
                    ? "Выберите команду"
                    : "Нет назначенных задач"}
                </p>
                <p className="text-sm opacity-70">
                  {viewMode === "personal" && !selectedEmployee
                    ? "Используйте выпадающий список выше для выбора"
                    : viewMode === "team" && !selectedTeam
                    ? "Используйте выпадающий список выше для выбора"
                    : viewMode === "personal" && selectedEmployee
                    ? `${selectedEmployee.name} не имеет загрузок в выбранном периоде`
                    : viewMode === "team" && selectedTeam
                    ? `Команда "${selectedTeam.name}" не имеет загрузок в выбранном периоде`
                    : ""}
                </p>
              </div>
            ) : (
              projects.map((project) => (
                <ProjectRow
                  key={project.id}
                  project={project}
                  range={timelineRange}
                  dayCells={dayCells}
                  theme={theme}
                  isExpanded={expandedProjects[project.id] ?? false}
                  onToggle={() => toggleProject(project.id)}
                  expandedProjectStages={expandedProjectStages}
                  toggleProjectStage={toggleProjectStage}
                  expandedObjects={expandedObjects}
                  toggleObject={toggleObject}
                  expandedSections={expandedSections}
                  toggleSection={toggleSection}
                  expandedStages={expandedStages}
                  toggleStage={toggleStage}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Footer legend */}
      <div
        className={cn(
          "flex items-center justify-between px-6 py-3 border-t",
          theme === "dark" ? "border-slate-700/50 bg-slate-900" : "border-slate-200 bg-slate-50"
        )}
      >
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "w-6 h-4 border border-dashed",
                theme === "dark" ? "border-slate-500" : "border-slate-400"
              )}
            />
            <span className={cn("text-xs", theme === "dark" ? "text-slate-400" : "text-slate-500")}>
              План
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className={cn("w-6 h-4", stageColors[0].bg.replace("/80", ""))} />
            <span className={cn("text-xs", theme === "dark" ? "text-slate-400" : "text-slate-500")}>
              Загрузка
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className={cn(
              "w-3 h-3 border border-dashed",
              theme === "dark" ? "border-slate-500" : "border-slate-400"
            )} />
            <span className={cn("text-xs", theme === "dark" ? "text-slate-400" : "text-slate-500")}>
              Ожидаемо
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className={cn(
              "w-3 h-3",
              theme === "dark" ? "bg-green-500" : "bg-green-500"
            )} />
            <span className={cn("text-xs", theme === "dark" ? "text-slate-400" : "text-slate-500")}>
              ≥ план
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className={cn(
              "w-3 h-3",
              theme === "dark" ? "bg-amber-500" : "bg-amber-500"
            )} />
            <span className={cn("text-xs", theme === "dark" ? "text-slate-400" : "text-slate-500")}>
              &lt; план
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className={cn(
              "w-3 h-3 border-2",
              theme === "dark" ? "bg-red-500 border-red-400" : "bg-red-500 border-red-600"
            )} />
            <span className={cn("text-xs", theme === "dark" ? "text-slate-400" : "text-slate-500")}>
              Вне плана
            </span>
          </div>
          <div className={cn("w-px h-4", theme === "dark" ? "bg-slate-700" : "bg-slate-300")} />
          {/* Milestone legend */}
          <div className="flex items-center gap-2">
            <div className={cn(
              "w-3 h-3 rotate-45 border-2",
              "bg-purple-500 border-purple-400"
            )} />
            <span className={cn("text-xs", theme === "dark" ? "text-slate-400" : "text-slate-500")}>
              Экспертиза
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className={cn(
              "w-3 h-3 rotate-45 border-2",
              "bg-orange-500 border-orange-400"
            )} />
            <span className={cn("text-xs", theme === "dark" ? "text-slate-400" : "text-slate-500")}>
              Выдача
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className={cn(
              "w-3 h-3 rotate-45 border-2",
              "bg-sky-500 border-sky-400"
            )} />
            <span className={cn("text-xs", theme === "dark" ? "text-slate-400" : "text-slate-500")}>
              Приём
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className={cn(
              "w-3 h-3 rotate-45 border-2",
              "bg-red-500 border-red-400"
            )} />
            <span className={cn("text-xs", theme === "dark" ? "text-slate-400" : "text-slate-500")}>
              Дедлайн
            </span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Inbox className="w-3 h-3 text-slate-400" />
            <span className={cn("text-xs", theme === "dark" ? "text-slate-400" : "text-slate-500")}>
              Бэклог
            </span>
          </div>
          <div className="flex items-center gap-2">
            <CircleDashed className="w-3 h-3 text-violet-500" />
            <span className={cn("text-xs", theme === "dark" ? "text-slate-400" : "text-slate-500")}>
              План
            </span>
          </div>
          <div className="flex items-center gap-2">
            <PlayCircle className="w-3 h-3 text-blue-500" />
            <span className={cn("text-xs", theme === "dark" ? "text-slate-400" : "text-slate-500")}>
              В работе
            </span>
          </div>
          <div className="flex items-center gap-2">
            <PauseCircle className="w-3 h-3 text-amber-500" />
            <span className={cn("text-xs", theme === "dark" ? "text-slate-400" : "text-slate-500")}>
              Пауза
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Search className="w-3 h-3 text-cyan-500" />
            <span className={cn("text-xs", theme === "dark" ? "text-slate-400" : "text-slate-500")}>
              Проверка
            </span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-3 h-3 text-green-500" />
            <span className={cn("text-xs", theme === "dark" ? "text-slate-400" : "text-slate-500")}>
              Готово
            </span>
          </div>
          <div className={cn("w-px h-4", theme === "dark" ? "bg-slate-700" : "bg-slate-300")} />
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "w-4 h-3",
                theme === "dark" ? "bg-slate-800" : "bg-slate-100"
              )}
            />
            <span className={cn("text-xs", theme === "dark" ? "text-slate-400" : "text-slate-500")}>
              Выходной
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "w-4 h-3 border",
                theme === "dark"
                  ? "bg-teal-600/30 border-teal-500"
                  : "bg-teal-100 border-teal-400"
              )}
            />
            <span className={cn("text-xs", theme === "dark" ? "text-slate-400" : "text-slate-500")}>
              Сегодня
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
