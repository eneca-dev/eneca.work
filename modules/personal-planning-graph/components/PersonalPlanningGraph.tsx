"use client"

import { useState, useMemo, useCallback } from "react"
import { ChevronRight, Calendar, Layers, Clock, CheckCircle2, PlayCircle, CircleDashed, PauseCircle, Search, Inbox, User, ListTodo, FolderKanban, Box, Building2, Diamond, ArrowRightFromLine, ArrowLeftToLine, FileCheck, Flag, Users, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { useTheme } from "next-themes"
import { mockProjects, mockEmployees, mockTeams, getTeamMembers, getEmployeeByName, type MockEmployee, type MockTeam } from "../mock-data"
import type { Project, ProjectStage, PlanningObject, PlanningSection, DecompositionStage, DecompositionTask, TimelineRange, Loading, WorkLog, StageStatus, Milestone, MilestoneType } from "../types"
import {
  format,
  differenceInDays,
  parseISO,
  addDays,
  startOfDay,
  getDay,
} from "date-fns"
import { ru } from "date-fns/locale"

// Timeline config: 2 weeks before + 4 weeks after = 6 weeks total
const DAYS_BEFORE_TODAY = 14
const DAYS_AFTER_TODAY = 28
const DAYS_TO_SHOW = DAYS_BEFORE_TODAY + DAYS_AFTER_TODAY

// Calculate timeline range: 2 weeks before today + 4 weeks after
function calculateTimelineRange(): TimelineRange {
  const today = startOfDay(new Date())
  const start = addDays(today, -DAYS_BEFORE_TODAY)
  const end = addDays(today, DAYS_AFTER_TODAY - 1)

  return {
    start,
    end,
    totalDays: DAYS_TO_SHOW,
  }
}

// Calculate bar position and width as percentages
function calculateBarPosition(
  startDate: string | null,
  endDate: string | null,
  range: TimelineRange
): { left: number; width: number } | null {
  if (!startDate || !endDate) return null

  const start = startOfDay(parseISO(startDate))
  const end = startOfDay(parseISO(endDate))

  // Check if bar is within visible range
  if (end < range.start || start > range.end) return null

  // Clamp dates to visible range
  const visibleStart = start < range.start ? range.start : start
  const visibleEnd = end > range.end ? range.end : end

  const dayFromStart = differenceInDays(visibleStart, range.start)
  const duration = differenceInDays(visibleEnd, visibleStart) + 1

  // Return as percentages
  const left = (dayFromStart / range.totalDays) * 100
  const width = (duration / range.totalDays) * 100

  return { left, width }
}

// Format date for display
function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—"
  return format(parseISO(dateStr), "d MMM", { locale: ru })
}

// Check if date is a weekend (Saturday = 6, Sunday = 0)
function isWeekend(date: Date): boolean {
  const day = getDay(date)
  return day === 0 || day === 6
}

// Snap start date to next weekday (if weekend, move to Monday)
function snapStartToWeekday(date: Date): Date {
  const day = getDay(date)
  if (day === 0) return addDays(date, 1) // Sunday -> Monday
  if (day === 6) return addDays(date, 2) // Saturday -> Monday
  return date
}

// Snap end date to previous weekday (if weekend, move to Friday)
function snapEndToWeekday(date: Date): Date {
  const day = getDay(date)
  if (day === 0) return addDays(date, -2) // Sunday -> Friday
  if (day === 6) return addDays(date, -1) // Saturday -> Friday
  return date
}

// Calculate bar position with weekend snapping
function calculateBarPositionSnapped(
  startDate: string | null,
  endDate: string | null,
  range: TimelineRange
): { left: number; width: number } | null {
  if (!startDate || !endDate) return null

  let start = snapStartToWeekday(startOfDay(parseISO(startDate)))
  let end = snapEndToWeekday(startOfDay(parseISO(endDate)))

  // Ensure end is not before start after snapping
  if (end < start) return null

  // Check if bar is within visible range
  if (end < range.start || start > range.end) return null

  // Clamp dates to visible range
  const visibleStart = start < range.start ? range.start : start
  const visibleEnd = end > range.end ? range.end : end

  const dayFromStart = differenceInDays(visibleStart, range.start)
  const duration = differenceInDays(visibleEnd, visibleStart) + 1

  // Return as percentages
  const left = (dayFromStart / range.totalDays) * 100
  const width = (duration / range.totalDays) * 100

  return { left, width }
}

// Count working days between two dates (excluding weekends)
function countWorkingDays(startDate: string, endDate: string): number {
  const start = startOfDay(parseISO(startDate))
  const end = startOfDay(parseISO(endDate))
  let count = 0

  for (let d = start; d <= end; d = addDays(d, 1)) {
    if (!isWeekend(d)) {
      count++
    }
  }

  return count
}

// Stage status info mapping
interface StageStatusInfo {
  label: string
  icon: typeof CheckCircle2
  colorClass: string
  bgClass: string
}

const stageStatusConfig: Record<StageStatus, StageStatusInfo> = {
  backlog: {
    label: "Бэклог",
    icon: Inbox,
    colorClass: "text-slate-400",
    bgClass: "bg-slate-400/20",
  },
  plan: {
    label: "План",
    icon: CircleDashed,
    colorClass: "text-violet-500",
    bgClass: "bg-violet-500/20",
  },
  in_progress: {
    label: "В работе",
    icon: PlayCircle,
    colorClass: "text-blue-500",
    bgClass: "bg-blue-500/20",
  },
  paused: {
    label: "Пауза",
    icon: PauseCircle,
    colorClass: "text-amber-500",
    bgClass: "bg-amber-500/20",
  },
  review: {
    label: "Проверка",
    icon: Search,
    colorClass: "text-cyan-500",
    bgClass: "bg-cyan-500/20",
  },
  done: {
    label: "Готово",
    icon: CheckCircle2,
    colorClass: "text-green-500",
    bgClass: "bg-green-500/20",
  },
}

function getStageStatusInfo(status: StageStatus): StageStatusInfo {
  return stageStatusConfig[status]
}

// Stage colors palette
const stageColors = [
  { bg: "bg-emerald-500/80", border: "border-emerald-400", text: "text-emerald-100" },
  { bg: "bg-cyan-500/80", border: "border-cyan-400", text: "text-cyan-100" },
  { bg: "bg-violet-500/80", border: "border-violet-400", text: "text-violet-100" },
  { bg: "bg-amber-500/80", border: "border-amber-400", text: "text-amber-100" },
  { bg: "bg-rose-500/80", border: "border-rose-400", text: "text-rose-100" },
  { bg: "bg-indigo-500/80", border: "border-indigo-400", text: "text-indigo-100" },
]

// Milestone type configuration
interface MilestoneConfig {
  label: string
  icon: typeof Diamond
  bgClass: string
  borderClass: string
  textClass: string
}

const milestoneConfig: Record<MilestoneType, MilestoneConfig> = {
  expertise_submission: {
    label: "Экспертиза",
    icon: FileCheck,
    bgClass: "bg-purple-500",
    borderClass: "border-purple-400",
    textClass: "text-purple-500",
  },
  task_transfer_out: {
    label: "Выдача",
    icon: ArrowRightFromLine,
    bgClass: "bg-orange-500",
    borderClass: "border-orange-400",
    textClass: "text-orange-500",
  },
  task_transfer_in: {
    label: "Приём",
    icon: ArrowLeftToLine,
    bgClass: "bg-sky-500",
    borderClass: "border-sky-400",
    textClass: "text-sky-500",
  },
  approval: {
    label: "Согласование",
    icon: CheckCircle2,
    bgClass: "bg-emerald-500",
    borderClass: "border-emerald-400",
    textClass: "text-emerald-500",
  },
  deadline: {
    label: "Дедлайн",
    icon: Flag,
    bgClass: "bg-red-500",
    borderClass: "border-red-400",
    textClass: "text-red-500",
  },
}

// Calculate milestone position as percentage
function calculateMilestonePosition(
  date: string,
  range: TimelineRange
): number | null {
  const milestoneDate = startOfDay(parseISO(date))

  // Check if milestone is within visible range
  if (milestoneDate < range.start || milestoneDate > range.end) return null

  const dayFromStart = differenceInDays(milestoneDate, range.start)
  return ((dayFromStart + 0.5) / range.totalDays) * 100 // Center on the day
}

// Day cell interface
interface DayCell {
  date: Date
  dayOfMonth: number
  dayOfWeek: string
  isWeekend: boolean
  isToday: boolean
  isMonthStart: boolean
  monthName: string
}

// Generate day cells for timeline
function generateDayCells(range: TimelineRange): DayCell[] {
  const cells: DayCell[] = []
  const today = startOfDay(new Date())

  for (let i = 0; i < range.totalDays; i++) {
    const date = addDays(range.start, i)
    const dayOfWeek = getDay(date)

    cells.push({
      date,
      dayOfMonth: date.getDate(),
      dayOfWeek: format(date, "EEEEEE", { locale: ru }),
      isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
      isToday: differenceInDays(date, today) === 0,
      isMonthStart: date.getDate() === 1,
      monthName: format(date, "LLLL", { locale: ru }),
    })
  }

  return cells
}

// Timeline header with days
function TimelineHeader({
  dayCells,
  theme,
}: {
  dayCells: DayCell[]
  theme: string
}) {
  // Group cells by week for week number display
  const weeks = useMemo(() => {
    const result: { weekNum: number; startIdx: number; endIdx: number; daysCount: number }[] = []
    let currentWeekStart = 0
    let weekCounter = 1

    dayCells.forEach((cell, idx) => {
      // New week starts on Monday (dayOfWeek === 1) or at the beginning
      const dayNum = getDay(cell.date)
      if (dayNum === 1 && idx > 0) {
        result.push({
          weekNum: weekCounter,
          startIdx: currentWeekStart,
          endIdx: idx - 1,
          daysCount: idx - currentWeekStart,
        })
        weekCounter++
        currentWeekStart = idx
      }
    })

    // Add last week
    result.push({
      weekNum: weekCounter,
      startIdx: currentWeekStart,
      endIdx: dayCells.length - 1,
      daysCount: dayCells.length - currentWeekStart,
    })

    return result
  }, [dayCells])

  return (
    <div className="flex flex-col h-full">
      {/* Week numbers row */}
      <div className="flex h-6">
        {weeks.map((week, i) => (
          <div
            key={i}
            className={cn(
              "flex items-center justify-center text-[10px] font-medium box-border",
              theme === "dark"
                ? "text-slate-400 bg-slate-800/50"
                : "text-slate-500 bg-slate-100/50"
            )}
            style={{
              flex: week.daysCount,
              borderRight: i < weeks.length - 1 ? `1px solid ${theme === "dark" ? "rgba(51, 65, 85, 0.5)" : "rgba(226, 232, 240, 1)"}` : "none"
            }}
          >
            Неделя {week.weekNum}
          </div>
        ))}
      </div>

      {/* Days row */}
      <div className="flex flex-1">
        {dayCells.map((cell, i) => (
          <div
            key={i}
            className={cn(
              "flex-1 flex flex-col items-center justify-center text-[10px] min-w-0 box-border",
              cell.isWeekend &&
                (theme === "dark" ? "bg-slate-800/70" : "bg-slate-100"),
              cell.isToday &&
                (theme === "dark"
                  ? "bg-teal-600/30"
                  : "bg-teal-100")
            )}
            style={{
              borderRight: i < dayCells.length - 1 ? `1px solid ${theme === "dark" ? "rgba(51, 65, 85, 0.5)" : "rgba(226, 232, 240, 1)"}` : "none"
            }}
          >
            <span
              className={cn(
                "font-medium",
                cell.isToday
                  ? theme === "dark"
                    ? "text-teal-300"
                    : "text-teal-700"
                  : cell.isWeekend
                  ? theme === "dark"
                    ? "text-slate-500"
                    : "text-slate-400"
                  : theme === "dark"
                  ? "text-slate-300"
                  : "text-slate-700"
              )}
            >
              {cell.dayOfMonth}
            </span>
            <span
              className={cn(
                "uppercase",
                cell.isWeekend
                  ? theme === "dark"
                    ? "text-slate-600"
                    : "text-slate-400"
                  : theme === "dark"
                  ? "text-slate-500"
                  : "text-slate-500"
              )}
            >
              {cell.dayOfWeek}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// Timeline grid background (for rows)
function TimelineGridBackground({
  dayCells,
  theme,
}: {
  dayCells: DayCell[]
  theme: string
}) {
  const cellWidth = 100 / dayCells.length

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {/* Weekend and today highlights */}
      {dayCells.map((cell, i) => {
        if (!cell.isWeekend && !cell.isToday) return null
        return (
          <div
            key={i}
            className={cn(
              "absolute top-0 bottom-0",
              cell.isToday
                ? theme === "dark" ? "bg-teal-600/10" : "bg-teal-50/50"
                : cell.isWeekend
                ? theme === "dark" ? "bg-slate-800/40" : "bg-slate-100/80"
                : ""
            )}
            style={{
              left: `${i * cellWidth}%`,
              width: `${cellWidth}%`,
            }}
          />
        )
      })}
      {/* Vertical grid lines */}
      {dayCells.slice(0, -1).map((_, i) => (
        <div
          key={`line-${i}`}
          className={cn(
            "absolute top-0 bottom-0 w-px",
            theme === "dark" ? "bg-slate-800" : "bg-slate-100"
          )}
          style={{
            left: `${(i + 1) * cellWidth}%`,
          }}
        />
      ))}
    </div>
  )
}

// Project row component (top level)
function ProjectRow({
  project,
  range,
  dayCells,
  theme,
  isExpanded,
  onToggle,
  expandedProjectStages,
  toggleProjectStage,
  expandedObjects,
  toggleObject,
  expandedSections,
  toggleSection,
  expandedStages,
  toggleStage,
}: {
  project: Project
  range: TimelineRange
  dayCells: DayCell[]
  theme: string
  isExpanded: boolean
  onToggle: () => void
  expandedProjectStages: Record<string, boolean>
  toggleProjectStage: (id: string) => void
  expandedObjects: Record<string, boolean>
  toggleObject: (id: string) => void
  expandedSections: Record<string, boolean>
  toggleSection: (id: string) => void
  expandedStages: Record<string, boolean>
  toggleStage: (id: string) => void
}) {
  // Calculate project stats
  const stats = useMemo(() => {
    let totalPlannedHours = 0
    let totalLoggedHours = 0
    let totalSections = 0
    let doneSections = 0

    project.stages.forEach(stage => {
      stage.objects.forEach(obj => {
        obj.sections.forEach(section => {
          totalSections++
          const sectionPlanned = section.stages.reduce((sum, s) => sum + s.plannedHours, 0)
          const sectionLogged = section.stages.reduce(
            (sum, s) => sum + s.workLogs.reduce((ws, log) => ws + log.hours, 0),
            0
          )
          totalPlannedHours += sectionPlanned
          totalLoggedHours += sectionLogged
          if (section.stages.every(s => s.status === "done")) doneSections++
        })
      })
    })

    return {
      totalPlannedHours,
      totalLoggedHours,
      progressPercent: totalPlannedHours > 0 ? Math.min((totalLoggedHours / totalPlannedHours) * 100, 100) : 0,
      totalSections,
      doneSections,
      stagesCount: project.stages.length,
      objectsCount: project.stages.reduce((sum, s) => sum + s.objects.length, 0),
    }
  }, [project])

  return (
    <div className={cn(
      "group",
      theme === "dark"
        ? "[&:not(:first-child)]:border-t [&:not(:first-child)]:border-slate-600"
        : "[&:not(:first-child)]:border-t [&:not(:first-child)]:border-slate-300"
    )}>
      {/* Project header */}
      <div
        className={cn(
          "relative flex cursor-pointer transition-colors h-11",
          theme === "dark"
            ? "bg-slate-800/80 hover:bg-slate-800"
            : "bg-slate-100 hover:bg-slate-200/80"
        )}
        onClick={onToggle}
      >
        {/* Left info panel */}
        <div
          className={cn(
            "w-96 flex-shrink-0 pl-3 pr-4 border-r flex items-center gap-2",
            theme === "dark"
              ? "border-slate-600 bg-slate-800"
              : "border-slate-300 bg-slate-200/50"
          )}
        >
          <ChevronRight
            className={cn(
              "w-4 h-4 flex-shrink-0 transition-transform duration-200",
              theme === "dark" ? "text-teal-400" : "text-teal-500",
              isExpanded && "rotate-90"
            )}
          />
          <FolderKanban className={cn(
            "w-4 h-4 flex-shrink-0",
            theme === "dark" ? "text-teal-400" : "text-teal-600"
          )} />
          <h2
            className={cn(
              "font-semibold text-sm truncate flex-1",
              theme === "dark" ? "text-slate-50" : "text-slate-900"
            )}
            title={project.name}
          >
            {project.name}
          </h2>
          <span
            className={cn(
              "text-xs tabular-nums flex-shrink-0",
              stats.progressPercent >= 100
                ? "text-green-500"
                : stats.progressPercent >= 50
                ? "text-teal-500"
                : stats.progressPercent > 0
                ? "text-blue-500"
                : theme === "dark" ? "text-slate-500" : "text-slate-400"
            )}
          >
            {stats.totalLoggedHours}/{stats.totalPlannedHours}ч
          </span>
        </div>

        {/* Timeline area */}
        <div className={cn(
          "flex-1 relative",
          theme === "dark" ? "bg-slate-800/50" : "bg-slate-100/50"
        )}>
          <TimelineGridBackground dayCells={dayCells} theme={theme} />
        </div>
      </div>

      {/* Expanded project stages */}
      <div
        className={cn(
          "grid transition-all duration-300 ease-in-out",
          isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        )}
      >
        <div className="overflow-hidden">
          {project.stages.map((pStage, idx) => (
            <ProjectStageRow
              key={pStage.id}
              projectStage={pStage}
              range={range}
              dayCells={dayCells}
              theme={theme}
              index={idx}
              isVisible={isExpanded}
              isExpanded={expandedProjectStages[pStage.id] ?? false}
              onToggle={() => toggleProjectStage(pStage.id)}
              expandedObjects={expandedObjects}
              toggleObject={toggleObject}
              expandedSections={expandedSections}
              toggleSection={toggleSection}
              expandedStages={expandedStages}
              toggleStage={toggleStage}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// Project stage row component (e.g., "Стадия П", "Стадия Р")
function ProjectStageRow({
  projectStage,
  range,
  dayCells,
  theme,
  index,
  isVisible,
  isExpanded,
  onToggle,
  expandedObjects,
  toggleObject,
  expandedSections,
  toggleSection,
  expandedStages,
  toggleStage,
}: {
  projectStage: ProjectStage
  range: TimelineRange
  dayCells: DayCell[]
  theme: string
  index: number
  isVisible: boolean
  isExpanded: boolean
  onToggle: () => void
  expandedObjects: Record<string, boolean>
  toggleObject: (id: string) => void
  expandedSections: Record<string, boolean>
  toggleSection: (id: string) => void
  expandedStages: Record<string, boolean>
  toggleStage: (id: string) => void
}) {
  // Calculate stage stats
  const stats = useMemo(() => {
    let totalPlannedHours = 0
    let totalLoggedHours = 0
    let totalSections = 0

    projectStage.objects.forEach(obj => {
      obj.sections.forEach(section => {
        totalSections++
        totalPlannedHours += section.stages.reduce((sum, s) => sum + s.plannedHours, 0)
        totalLoggedHours += section.stages.reduce(
          (sum, s) => sum + s.workLogs.reduce((ws, log) => ws + log.hours, 0),
          0
        )
      })
    })

    return {
      totalPlannedHours,
      totalLoggedHours,
      progressPercent: totalPlannedHours > 0 ? Math.min((totalLoggedHours / totalPlannedHours) * 100, 100) : 0,
      totalSections,
      objectsCount: projectStage.objects.length,
    }
  }, [projectStage])

  return (
    <div
      className={cn(
        "transition-all duration-300",
        isVisible ? "translate-x-0 opacity-100" : "-translate-x-4 opacity-0",
        theme === "dark" ? "border-t border-slate-700" : "border-t border-slate-200"
      )}
      style={{ transitionDelay: `${index * 40}ms` }}
    >
      {/* Project stage header */}
      <div
        className={cn(
          "relative flex cursor-pointer transition-colors h-10",
          theme === "dark"
            ? "hover:bg-slate-800/70"
            : "hover:bg-slate-100"
        )}
        onClick={onToggle}
      >
        {/* Left info panel */}
        <div
          className={cn(
            "w-96 flex-shrink-0 pl-9 pr-4 border-r flex items-center gap-2",
            theme === "dark"
              ? "border-slate-700/50 bg-slate-900/50"
              : "border-slate-200 bg-slate-50"
          )}
        >
          <ChevronRight
            className={cn(
              "w-3.5 h-3.5 flex-shrink-0 transition-transform duration-200",
              theme === "dark" ? "text-violet-400" : "text-violet-500",
              isExpanded && "rotate-90"
            )}
          />
          <Layers className={cn(
            "w-3.5 h-3.5 flex-shrink-0",
            theme === "dark" ? "text-violet-400" : "text-violet-500"
          )} />
          <h3
            className={cn(
              "text-sm truncate flex-1",
              theme === "dark" ? "text-slate-200" : "text-slate-800"
            )}
            title={projectStage.name}
          >
            {projectStage.name}
          </h3>
          <span
            className={cn(
              "text-xs tabular-nums flex-shrink-0",
              stats.progressPercent >= 100
                ? "text-green-500"
                : stats.progressPercent >= 50
                ? "text-teal-500"
                : stats.progressPercent > 0
                ? "text-blue-500"
                : theme === "dark" ? "text-slate-500" : "text-slate-400"
            )}
          >
            {stats.totalLoggedHours}/{stats.totalPlannedHours}ч
          </span>
        </div>

        {/* Timeline area */}
        <div className={cn(
          "flex-1 relative",
          theme === "dark" ? "bg-slate-900/30" : "bg-white"
        )}>
          <TimelineGridBackground dayCells={dayCells} theme={theme} />
        </div>
      </div>

      {/* Expanded objects */}
      <div
        className={cn(
          "grid transition-all duration-300 ease-in-out",
          isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        )}
      >
        <div className="overflow-hidden">
          {projectStage.objects.map((obj, objIdx) => (
            <ObjectRow
              key={obj.id}
              object={obj}
              range={range}
              dayCells={dayCells}
              theme={theme}
              index={objIdx}
              isVisible={isExpanded}
              isExpanded={expandedObjects[obj.id] ?? false}
              onToggle={() => toggleObject(obj.id)}
              expandedSections={expandedSections}
              toggleSection={toggleSection}
              expandedStages={expandedStages}
              toggleStage={toggleStage}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// Object row component (e.g., "Корпус А", "Здание 1")
function ObjectRow({
  object,
  range,
  dayCells,
  theme,
  index,
  isVisible,
  isExpanded,
  onToggle,
  expandedSections,
  toggleSection,
  expandedStages,
  toggleStage,
}: {
  object: PlanningObject
  range: TimelineRange
  dayCells: DayCell[]
  theme: string
  index: number
  isVisible: boolean
  isExpanded: boolean
  onToggle: () => void
  expandedSections: Record<string, boolean>
  toggleSection: (id: string) => void
  expandedStages: Record<string, boolean>
  toggleStage: (id: string) => void
}) {
  // Calculate object stats
  const stats = useMemo(() => {
    let totalPlannedHours = 0
    let totalLoggedHours = 0

    object.sections.forEach(section => {
      totalPlannedHours += section.stages.reduce((sum, s) => sum + s.plannedHours, 0)
      totalLoggedHours += section.stages.reduce(
        (sum, s) => sum + s.workLogs.reduce((ws, log) => ws + log.hours, 0),
        0
      )
    })

    return {
      totalPlannedHours,
      totalLoggedHours,
      progressPercent: totalPlannedHours > 0 ? Math.min((totalLoggedHours / totalPlannedHours) * 100, 100) : 0,
      sectionsCount: object.sections.length,
    }
  }, [object])

  return (
    <div
      className={cn(
        "transition-all duration-300",
        isVisible ? "translate-x-0 opacity-100" : "-translate-x-4 opacity-0",
        theme === "dark" ? "border-t border-slate-700/70" : "border-t border-slate-200/80"
      )}
      style={{ transitionDelay: `${index * 30}ms` }}
    >
      {/* Object header */}
      <div
        className={cn(
          "relative flex cursor-pointer transition-colors h-9",
          theme === "dark"
            ? "hover:bg-slate-800/50"
            : "hover:bg-slate-50"
        )}
        onClick={onToggle}
      >
        {/* Left info panel */}
        <div
          className={cn(
            "w-96 flex-shrink-0 pl-[60px] pr-4 border-r flex items-center gap-2",
            theme === "dark"
              ? "border-slate-700/50"
              : "border-slate-200"
          )}
        >
          <ChevronRight
            className={cn(
              "w-3 h-3 flex-shrink-0 transition-transform duration-200",
              theme === "dark" ? "text-amber-400" : "text-amber-500",
              isExpanded && "rotate-90"
            )}
          />
          <Building2 className={cn(
            "w-3.5 h-3.5 flex-shrink-0",
            theme === "dark" ? "text-amber-400" : "text-amber-500"
          )} />
          <h4
            className={cn(
              "text-sm truncate flex-1",
              theme === "dark" ? "text-slate-300" : "text-slate-700"
            )}
            title={object.name}
          >
            {object.name}
          </h4>
          <span
            className={cn(
              "text-xs tabular-nums flex-shrink-0",
              stats.progressPercent >= 100
                ? "text-green-500"
                : stats.progressPercent >= 50
                ? "text-teal-500"
                : stats.progressPercent > 0
                ? "text-blue-500"
                : theme === "dark" ? "text-slate-500" : "text-slate-400"
            )}
          >
            {stats.totalLoggedHours}/{stats.totalPlannedHours}ч
          </span>
        </div>

        {/* Timeline area */}
        <div className={cn(
          "flex-1 relative",
          theme === "dark" ? "bg-slate-900" : "bg-white"
        )}>
          <TimelineGridBackground dayCells={dayCells} theme={theme} />
        </div>
      </div>

      {/* Expanded sections */}
      <div
        className={cn(
          "grid transition-all duration-300 ease-in-out",
          isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        )}
      >
        <div className="overflow-hidden">
          {object.sections.map((section) => (
            <SectionRow
              key={section.id}
              section={section}
              range={range}
              dayCells={dayCells}
              theme={theme}
              isExpanded={expandedSections[section.id] ?? false}
              onToggle={() => toggleSection(section.id)}
              expandedStages={expandedStages}
              toggleStage={toggleStage}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// Section row component
function SectionRow({
  section,
  range,
  dayCells,
  theme,
  isExpanded,
  onToggle,
  expandedStages,
  toggleStage,
}: {
  section: PlanningSection
  range: TimelineRange
  dayCells: DayCell[]
  theme: string
  isExpanded: boolean
  onToggle: () => void
  expandedStages: Record<string, boolean>
  toggleStage: (stageId: string) => void
}) {
  const sectionBar = calculateBarPosition(section.startDate, section.endDate, range)
  const sortedStages = useMemo(
    () => [...section.stages].sort((a, b) => a.order - b.order),
    [section.stages]
  )

  // Calculate section progress
  const { totalPlannedHours, totalLoggedHours, progressPercent, doneStages, totalStages } = useMemo(() => {
    const totalPlanned = section.stages.reduce((sum, stage) => sum + stage.plannedHours, 0)
    const totalLogged = section.stages.reduce(
      (sum, stage) => sum + stage.workLogs.reduce((s, log) => s + log.hours, 0),
      0
    )
    const done = section.stages.filter(s => s.status === "done").length
    return {
      totalPlannedHours: totalPlanned,
      totalLoggedHours: totalLogged,
      progressPercent: totalPlanned > 0 ? Math.min((totalLogged / totalPlanned) * 100, 100) : 0,
      doneStages: done,
      totalStages: section.stages.length,
    }
  }, [section.stages])

  return (
    <div className={cn(
      "group",
      theme === "dark"
        ? "border-t border-slate-700"
        : "border-t border-slate-200"
    )}>
      {/* Section header */}
      <div
        className={cn(
          "relative flex cursor-pointer transition-colors h-10",
          theme === "dark"
            ? "hover:bg-slate-800/50"
            : "hover:bg-slate-50"
        )}
        onClick={onToggle}
      >
        {/* Left info panel */}
        <div
          className={cn(
            "w-96 flex-shrink-0 pl-[84px] pr-4 border-r flex items-center gap-2",
            theme === "dark"
              ? "border-slate-700/50 bg-slate-900/50"
              : "border-slate-200 bg-slate-50/50"
          )}
        >
          <ChevronRight
            className={cn(
              "w-3 h-3 flex-shrink-0 transition-transform duration-200",
              theme === "dark" ? "text-cyan-400" : "text-cyan-500",
              isExpanded && "rotate-90"
            )}
          />
          <Box className={cn(
            "w-3.5 h-3.5 flex-shrink-0",
            theme === "dark" ? "text-cyan-400" : "text-cyan-500"
          )} />
          <h3
            className={cn(
              "text-sm truncate flex-1",
              theme === "dark" ? "text-slate-200" : "text-slate-800"
            )}
            title={section.name}
          >
            {section.name}
          </h3>
          <span
            className={cn(
              "text-[11px] flex-shrink-0",
              theme === "dark" ? "text-slate-500" : "text-slate-400"
            )}
          >
            {formatDate(section.startDate)}—{formatDate(section.endDate)}
          </span>
          <span
            className={cn(
              "text-xs tabular-nums flex-shrink-0",
              progressPercent >= 100
                ? "text-green-500"
                : progressPercent >= 50
                ? "text-teal-500"
                : progressPercent > 0
                ? "text-blue-500"
                : theme === "dark" ? "text-slate-500" : "text-slate-400"
            )}
          >
            {totalLoggedHours}/{totalPlannedHours}ч
          </span>
        </div>

        {/* Timeline area */}
        <div className={cn(
          "flex-1 relative",
          theme === "dark" ? "bg-slate-900" : "bg-white"
        )}>
          <TimelineGridBackground dayCells={dayCells} theme={theme} />
          {sectionBar && (
            <div
              className={cn(
                "absolute top-1/2 -translate-y-1/2 h-4 z-10 overflow-hidden",
                theme === "dark"
                  ? "bg-slate-700/50 border border-slate-600/50"
                  : "bg-slate-200 border border-slate-300"
              )}
              style={{
                left: `${sectionBar.left}%`,
                width: `${sectionBar.width}%`,
                minWidth: "20px",
              }}
              title={`${totalLoggedHours}/${totalPlannedHours}ч (${Math.round(progressPercent)}%) • ${doneStages}/${totalStages} этапов завершено`}
            >
              {/* Progress fill */}
              <div
                className={cn(
                  "absolute inset-y-0 left-0 transition-all duration-500",
                  progressPercent >= 100
                    ? "bg-green-500"
                    : progressPercent >= 50
                    ? "bg-teal-500"
                    : progressPercent > 0
                    ? "bg-blue-500"
                    : ""
                )}
                style={{ width: `${progressPercent}%` }}
              />
              {/* Progress text */}
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={cn(
                  "text-[10px] font-bold drop-shadow-sm",
                  progressPercent > 50
                    ? "text-white"
                    : theme === "dark" ? "text-slate-300" : "text-slate-600"
                )}>
                  {Math.round(progressPercent)}%
                </span>
              </div>
            </div>
          )}

          {/* Milestone markers */}
          {section.milestones?.map((milestone) => {
            const position = calculateMilestonePosition(milestone.date, range)
            if (position === null) return null

            const config = milestoneConfig[milestone.type]
            const MilestoneIcon = config.icon

            return (
              <div
                key={milestone.id}
                className="absolute top-1/2 -translate-y-1/2 z-20 group/milestone"
                style={{ left: `${position}%` }}
              >
                {/* Milestone diamond marker */}
                <div
                  className={cn(
                    "w-5 h-5 -ml-2.5 flex items-center justify-center transition-all duration-200",
                    "rotate-45 border-2",
                    milestone.isCompleted
                      ? cn(config.bgClass, config.borderClass)
                      : cn(
                          theme === "dark" ? "bg-slate-800" : "bg-white",
                          config.borderClass
                        )
                  )}
                >
                  <MilestoneIcon
                    className={cn(
                      "w-2.5 h-2.5 -rotate-45",
                      milestone.isCompleted
                        ? "text-white"
                        : config.textClass
                    )}
                  />
                </div>

                {/* Hover tooltip */}
                <div
                  className={cn(
                    "absolute left-1/2 -translate-x-1/2 bottom-full mb-2 opacity-0 pointer-events-none",
                    "group-hover/milestone:opacity-100 group-hover/milestone:pointer-events-auto",
                    "transition-opacity duration-200 z-50"
                  )}
                >
                  <div
                    className={cn(
                      "px-3 py-2 text-xs whitespace-nowrap border shadow-lg",
                      theme === "dark"
                        ? "bg-slate-800 border-slate-700 text-slate-200"
                        : "bg-white border-slate-200 text-slate-800"
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <MilestoneIcon className={cn("w-3.5 h-3.5", config.textClass)} />
                      <span className="font-semibold">{milestone.title}</span>
                      {milestone.isCompleted && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-green-500/20 text-green-500">
                          Выполнено
                        </span>
                      )}
                    </div>
                    <div className={cn(
                      "text-[11px] mb-1",
                      theme === "dark" ? "text-slate-400" : "text-slate-500"
                    )}>
                      {format(parseISO(milestone.date), "d MMMM yyyy", { locale: ru })}
                    </div>
                    <div className={cn(
                      "text-[11px] max-w-[250px]",
                      theme === "dark" ? "text-slate-400" : "text-slate-500"
                    )}>
                      {milestone.description}
                    </div>
                    {milestone.relatedSectionName && (
                      <div className={cn(
                        "text-[10px] mt-1 pt-1 border-t flex items-center gap-1",
                        theme === "dark" ? "border-slate-700 text-slate-500" : "border-slate-200 text-slate-400"
                      )}>
                        <span>Связан с:</span>
                        <span className={config.textClass}>{milestone.relatedSectionName}</span>
                      </div>
                    )}
                  </div>
                  {/* Tooltip arrow */}
                  <div
                    className={cn(
                      "absolute left-1/2 -translate-x-1/2 top-full w-0 h-0",
                      "border-l-[6px] border-l-transparent",
                      "border-r-[6px] border-r-transparent",
                      "border-t-[6px]",
                      theme === "dark" ? "border-t-slate-700" : "border-t-slate-200"
                    )}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Expanded stages */}
      <div
        className={cn(
          "grid transition-all duration-300 ease-in-out",
          isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        )}
      >
        <div className="overflow-hidden">
          {sortedStages.map((stage, stageIndex) => (
            <StageRow
              key={stage.id}
              stage={stage}
              range={range}
              dayCells={dayCells}
              theme={theme}
              colorIndex={stageIndex % stageColors.length}
              index={stageIndex}
              isVisible={isExpanded}
              isExpanded={expandedStages[stage.id] ?? false}
              onToggle={() => toggleStage(stage.id)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// Circular progress component
function CircularProgress({
  progress,
  size = 24,
  strokeWidth = 3,
  theme,
}: {
  progress: number
  size?: number
  strokeWidth?: number
  theme: string
}) {
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const offset = circumference - (progress / 100) * circumference

  const progressColor = progress >= 100
    ? "stroke-green-500"
    : progress >= 50
    ? "stroke-teal-500"
    : progress > 0
    ? "stroke-blue-500"
    : theme === "dark" ? "stroke-slate-700" : "stroke-slate-300"

  return (
    <svg width={size} height={size} className="flex-shrink-0 -rotate-90">
      {/* Background circle */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        strokeWidth={strokeWidth}
        className={theme === "dark" ? "stroke-slate-700" : "stroke-slate-200"}
      />
      {/* Progress circle */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        className={cn("transition-all duration-500", progressColor)}
        style={{
          strokeDasharray: circumference,
          strokeDashoffset: offset,
        }}
      />
    </svg>
  )
}

// Task row component
function TaskRow({
  task,
  theme,
  index,
  isVisible,
}: {
  task: DecompositionTask
  theme: string
  index: number
  isVisible: boolean
}) {
  const progressColor = task.progress >= 100
    ? "text-green-500"
    : task.progress >= 50
    ? "text-teal-500"
    : task.progress > 0
    ? "text-blue-500"
    : theme === "dark" ? "text-slate-600" : "text-slate-400"

  return (
    <div
      className={cn(
        "relative flex h-9 transition-all duration-300",
        isVisible ? "translate-x-0 opacity-100" : "-translate-x-4 opacity-0",
        theme === "dark" ? "border-t border-slate-800" : "border-t border-slate-100"
      )}
      style={{ transitionDelay: `${index * 30}ms` }}
    >
      {/* Left panel */}
      <div
        className={cn(
          "w-96 flex-shrink-0 pl-[132px] pr-4 border-r flex items-center gap-2",
          theme === "dark"
            ? "border-slate-700/50"
            : "border-slate-200"
        )}
      >
        <CircularProgress progress={task.progress} size={18} strokeWidth={2} theme={theme} />
        <span className={cn("text-xs tabular-nums w-8", progressColor)}>
          {task.progress}%
        </span>
        <span
          className={cn(
            "text-xs truncate flex-1",
            theme === "dark" ? "text-slate-400" : "text-slate-600"
          )}
          title={task.description}
        >
          {task.description}
        </span>
        <span
          className={cn(
            "text-[11px] tabular-nums flex-shrink-0",
            theme === "dark" ? "text-slate-500" : "text-slate-400"
          )}
        >
          {task.plannedHours}ч
        </span>
      </div>

      {/* Timeline area */}
      <div className={cn(
        "flex-1 relative flex items-center px-4",
        theme === "dark" ? "bg-slate-900/30" : "bg-slate-50/30"
      )}>
        {task.responsibleName && (
          <span className={cn(
            "text-xs",
            theme === "dark" ? "text-slate-500" : "text-slate-400"
          )}>
            {task.responsibleName}
          </span>
        )}
      </div>
    </div>
  )
}

// Stage row component
function StageRow({
  stage,
  range,
  dayCells,
  theme,
  colorIndex,
  index,
  isVisible,
  isExpanded,
  onToggle,
}: {
  stage: DecompositionStage
  range: TimelineRange
  dayCells: DayCell[]
  theme: string
  colorIndex: number
  index: number
  isVisible: boolean
  isExpanded: boolean
  onToggle: () => void
}) {
  // Use snapped positions to avoid weekends
  const plannedBar = calculateBarPositionSnapped(stage.startDate, stage.finishDate, range)
  const colors = stageColors[colorIndex]

  // Get stage status info
  const statusInfo = getStageStatusInfo(stage.status)
  const StatusIcon = statusInfo.icon

  // Calculate loading bars (also snapped)
  const loadingBars = stage.loadings
    .map((loading) => ({
      ...loading,
      position: calculateBarPositionSnapped(loading.startDate, loading.endDate, range),
    }))
    .filter((l) => l.position !== null)

  // Sort tasks by order
  const sortedTasks = useMemo(
    () => [...stage.tasks].sort((a, b) => a.order - b.order),
    [stage.tasks]
  )
  const hasTasks = sortedTasks.length > 0

  // Calculate stage duration in working days (excluding weekends)
  const workingDays = stage.startDate && stage.finishDate
    ? countWorkingDays(stage.startDate, stage.finishDate)
    : 0
  const avgHoursPerDay = workingDays > 0 ? stage.plannedHours / workingDays : 0
  const totalLoggedHours = stage.workLogs.reduce((sum, log) => sum + log.hours, 0)

  // Calculate fill height percentage based on planned hours (8h = 100%)
  const plannedFillPercent = Math.min((avgHoursPerDay / 8) * 100, 100)

  return (
    <div
      className={cn(
        "transition-all duration-300",
        isVisible ? "translate-x-0 opacity-100" : "-translate-x-4 opacity-0",
        // Horizontal divider between stages
        theme === "dark" ? "border-t border-slate-700/70" : "border-t border-slate-200"
      )}
      style={{ transitionDelay: `${index * 50}ms` }}
    >
      {/* Stage header row */}
      <div
        className={cn(
          "relative flex min-h-14",
          hasTasks && "cursor-pointer",
          hasTasks && (theme === "dark" ? "hover:bg-slate-800/30" : "hover:bg-slate-100/50")
        )}
        onClick={hasTasks ? onToggle : undefined}
      >
        {/* Left info panel */}
        <div
          className={cn(
            "w-96 flex-shrink-0 pl-[108px] pr-4 py-2 border-r flex items-start gap-2",
            theme === "dark"
              ? "border-slate-700/50 bg-slate-900/30"
              : "border-slate-200 bg-slate-50/30"
          )}
        >
          {/* Expand chevron if has tasks */}
          {hasTasks ? (
            <ChevronRight
              className={cn(
                "w-3 h-3 flex-shrink-0 transition-transform duration-200 mt-1",
                theme === "dark" ? "text-slate-500" : "text-slate-400",
                isExpanded && "rotate-90"
              )}
            />
          ) : (
            <div className="w-3 mt-1" />
          )}
          <div
            className={cn("w-2 h-2 rounded-full flex-shrink-0 mt-1.5", colors.bg.replace("/80", ""))}
          />
          <div className="flex-1 min-w-0">
            <h4
              className={cn(
                "text-sm leading-tight line-clamp-2",
                theme === "dark" ? "text-slate-300" : "text-slate-700"
              )}
              title={stage.name}
            >
              {stage.name}
            </h4>
          </div>
          {/* Status badge */}
          <div
            className={cn(
              "flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium flex-shrink-0 mt-0.5",
              statusInfo.bgClass,
              statusInfo.colorClass
            )}
            title={statusInfo.label}
          >
            <StatusIcon className="w-3 h-3" />
          </div>
          <span
            className={cn(
              "text-xs tabular-nums flex-shrink-0 mt-0.5",
              totalLoggedHours >= stage.plannedHours
                ? "text-green-500"
                : totalLoggedHours > 0
                ? "text-amber-500"
                : theme === "dark" ? "text-slate-600" : "text-slate-400"
            )}
          >
            {totalLoggedHours}/{stage.plannedHours}ч
          </span>
        </div>

      {/* Timeline area */}
      <div className={cn(
        "flex-1 relative",
        theme === "dark" ? "bg-slate-900" : "bg-white"
      )}>
        <TimelineGridBackground dayCells={dayCells} theme={theme} />

        {/* Stage area with planned hours fill */}
        {plannedBar && (
          <div
            className={cn(
              "absolute top-0 bottom-0 transition-all duration-300 overflow-hidden",
              isVisible ? "opacity-100" : "opacity-0"
            )}
            style={{
              left: `${plannedBar.left}%`,
              width: `${plannedBar.width}%`,
              minWidth: "4px",
              transitionDelay: `${index * 50 + 50}ms`,
            }}
          >
            {/* Planned hours fill (from bottom) */}
            <div
              className={cn(
                "absolute left-0 right-0 bottom-0 transition-all duration-500",
                theme === "dark"
                  ? "bg-slate-700/50"
                  : "bg-slate-200/70"
              )}
              style={{
                height: `${plannedFillPercent}%`,
                transitionDelay: `${index * 50 + 100}ms`,
              }}
            />
            {/* Left boundary line */}
            <div className={cn(
              "absolute left-0 top-0 bottom-0 w-0.5",
              colors.bg.replace("/80", "")
            )} />
            {/* Right boundary line */}
            <div className={cn(
              "absolute right-0 top-0 bottom-0 w-0.5",
              colors.bg.replace("/80", "")
            )} />
            {/* Top edge accent */}
            <div
              className={cn(
                "absolute left-0 right-0 top-0 h-0.5",
                colors.bg.replace("/80", "/40")
              )}
            />
          </div>
        )}

        {/* Loading bar (employee assignment) */}
        {loadingBars.map((loading, loadingIndex) => (
          <div
            key={loading.id}
            className={cn(
              "absolute top-1.5 h-6 z-20 transition-all duration-300 flex items-center overflow-hidden shadow-sm",
              colors.bg,
              isVisible ? "scale-x-100 opacity-100" : "scale-x-0 opacity-0"
            )}
            style={{
              left: `calc(${loading.position!.left}% + 2px)`,
              width: `calc(${loading.position!.width}% - 4px)`,
              minWidth: "60px",
              transformOrigin: "left center",
              transitionDelay: `${index * 50 + 100 + loadingIndex * 30}ms`,
              opacity: loading.rate < 1 ? 0.7 + loading.rate * 0.3 : 1,
            }}
            title={`${loading.employeeName} • ${Math.round(loading.rate * 100)}%`}
          >
            {(() => {
              const emp = getEmployeeByName(loading.employeeName)
              return emp?.avatarUrl ? (
                <img
                  src={emp.avatarUrl}
                  alt={loading.employeeName}
                  className="w-5 h-5 flex-shrink-0 ml-1"
                />
              ) : (
                <User className="w-4 h-4 flex-shrink-0 ml-1.5 opacity-70" />
              )
            })()}
            <span className={cn(
              "text-[11px] font-medium px-1.5 truncate whitespace-nowrap",
              colors.text
            )}>
              {loading.employeeName}
            </span>
            {loading.rate < 1 && (
              <span className={cn(
                "text-[10px] px-1.5 py-0.5 mr-1 ml-auto",
                theme === "dark" ? "bg-black/20 text-white/80" : "bg-white/30 text-white"
              )}>
                {Math.round(loading.rate * 100)}%
              </span>
            )}
          </div>
        ))}

        {/* Daily work logs */}
        {stage.startDate && stage.finishDate && (() => {
          const stageStart = parseISO(stage.startDate)
          const stageEnd = parseISO(stage.finishDate)
          const markers = []

          for (let d = stageStart; d <= stageEnd; d = addDays(d, 1)) {
            // Skip weekends
            if (isWeekend(d)) continue
            // Skip if outside visible range
            if (d < range.start || d > range.end) continue

            const dayIndex = differenceInDays(d, range.start)
            const leftPercent = (dayIndex / range.totalDays) * 100
            const widthPercent = (1 / range.totalDays) * 100
            const dateStr = format(d, "yyyy-MM-dd")

            // Find work log for this day
            const dayLog = stage.workLogs.find(log => log.date === dateStr)
            const loggedHours = dayLog?.hours || 0

            if (loggedHours === 0) continue // Only show days with logged hours

            // Color based on comparison with planned average
            const isAboveAvg = loggedHours >= avgHoursPerDay
            const isBelowAvg = loggedHours < avgHoursPerDay * 0.8

            markers.push(
              <div
                key={dateStr}
                className={cn(
                  "absolute bottom-1.5 z-30 h-5 flex items-center justify-center transition-all duration-300",
                  isAboveAvg
                    ? "bg-emerald-500"
                    : isBelowAvg
                    ? "bg-amber-500"
                    : "bg-emerald-400",
                  isVisible ? "opacity-100" : "opacity-0"
                )}
                style={{
                  left: `calc(${leftPercent}% + 2px)`,
                  width: `calc(${widthPercent}% - 4px)`,
                  minWidth: "20px",
                  transitionDelay: `${index * 50 + 200}ms`,
                }}
                title={`${dayLog?.employeeName} • ${loggedHours}ч • ${format(d, "d MMM", { locale: ru })}`}
              >
                <span className="text-[10px] font-bold text-white">
                  {loggedHours}
                </span>
              </div>
            )
          }

          return markers
        })()}

        {/* Anomaly markers - work logs OUTSIDE planned stage dates (red) */}
        {stage.startDate && stage.finishDate && (() => {
          const stageStart = parseISO(stage.startDate)
          const stageEnd = parseISO(stage.finishDate)

          // Find work logs outside stage period
          const anomalousLogs = stage.workLogs.filter(log => {
            const logDate = parseISO(log.date)
            return logDate < stageStart || logDate > stageEnd
          })

          return anomalousLogs.map(log => {
            const logDate = parseISO(log.date)

            // Skip if outside visible range
            if (logDate < range.start || logDate > range.end) return null

            const dayIndex = differenceInDays(logDate, range.start)
            const leftPercent = (dayIndex / range.totalDays) * 100
            const widthPercent = (1 / range.totalDays) * 100

            const maxHeight = 24
            const actualHeightPx = Math.min(Math.max((log.hours / 8) * maxHeight, 8), maxHeight)

            const isBefore = logDate < stageStart
            const anomalyType = isBefore ? "ДО начала" : "ПОСЛЕ окончания"

            return (
              <div
                key={`anomaly-${log.id}`}
                className="absolute bottom-1 z-30"
                style={{
                  left: `calc(${leftPercent}% + 1px)`,
                  width: `calc(${widthPercent}% - 2px)`,
                  minWidth: "14px",
                }}
              >
                {/* Red anomaly marker */}
                <div
                  className={cn(
                    "absolute bottom-0 left-0 right-0 border-2 flex items-center justify-center overflow-hidden transition-all duration-300",
                    theme === "dark"
                      ? "bg-red-500/90 border-red-400"
                      : "bg-red-500/80 border-red-600",
                    isVisible ? "opacity-100" : "opacity-0"
                  )}
                  style={{
                    height: `${actualHeightPx}px`,
                    transitionDelay: `${index * 50 + 200}ms`,
                  }}
                  title={`⚠️ АНОМАЛИЯ: ${log.employeeName} • ${log.hours}ч • ${anomalyType} этапа • ${format(logDate, "d MMM", { locale: ru })}`}
                >
                  <span className="text-[9px] font-bold text-white drop-shadow-sm">
                    {log.hours}
                  </span>
                </div>
              </div>
            )
          })
        })()}
      </div>
      </div>

      {/* Expanded tasks section */}
      {hasTasks && (
        <div
          className={cn(
            "grid transition-all duration-300 ease-in-out",
            isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
          )}
        >
          <div className="overflow-hidden">
            {sortedTasks.map((task, taskIndex) => (
              <TaskRow
                key={task.id}
                task={task}
                theme={theme}
                index={taskIndex}
                isVisible={isExpanded}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

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
                    // Include stage if employee has loadings or work logs
                    stage.loadings.some((l) => employeeNames.includes(l.employeeName)) ||
                    stage.workLogs.some((w) => employeeNames.includes(w.employeeName)) ||
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
