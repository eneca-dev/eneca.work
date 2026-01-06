"use client"

import { cn } from "@/lib/utils"
import { Banknote } from "lucide-react"
import { format, parseISO, addDays, differenceInDays } from "date-fns"
import { ru } from "date-fns/locale"
import type { DecompositionTask, TimelineRange } from "../../types"
import type { DayCell } from "../../utils"
import { calculateBarPositionSnapped, countWorkingDays, isWeekend, formatBudget } from "../../utils"
import { CircularProgress } from "../CircularProgress"

interface TaskRowProps {
  task: DecompositionTask
  range: TimelineRange
  dayCells: DayCell[]
  theme: string
  index: number
  isVisible: boolean
}

export function TaskRow({
  task,
  range,
  dayCells,
  theme,
  index,
  isVisible,
}: TaskRowProps) {
  const progressColor = task.progress >= 100
    ? "text-green-500"
    : task.progress >= 50
    ? "text-teal-500"
    : task.progress > 0
    ? "text-blue-500"
    : theme === "dark" ? "text-slate-600" : "text-slate-400"

  // Calculate task bar position
  const taskBar = calculateBarPositionSnapped(task.startDate || null, task.endDate || null, range)

  // Calculate working days and average hours per day for the task
  const workingDays = task.startDate && task.endDate
    ? countWorkingDays(task.startDate, task.endDate)
    : 0
  const avgHoursPerDay = workingDays > 0 ? task.plannedHours / workingDays : 0
  const totalLoggedHours = (task.workLogs || []).reduce((sum, log) => sum + log.hours, 0)

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
        {/* Task budget badge */}
        {task.budget && (() => {
          const budgetPercent = task.budget.amount > 0
            ? Math.round((task.budget.spent / task.budget.amount) * 100)
            : 0
          const isOverBudget = budgetPercent >= 100
          const isNearLimit = budgetPercent >= 80
          return (
            <div
              className={cn(
                "flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-medium flex-shrink-0",
                isOverBudget
                  ? "bg-red-500/20 text-red-500"
                  : isNearLimit
                  ? "bg-amber-500/20 text-amber-500"
                  : "bg-emerald-500/20 text-emerald-500"
              )}
              title={`Бюджет: ${formatBudget(task.budget.spent)} / ${formatBudget(task.budget.amount)} (${budgetPercent}%)`}
            >
              <Banknote className="w-2.5 h-2.5" />
              <span>{budgetPercent}%</span>
            </div>
          )
        })()}
      </div>

      {/* Timeline area with grid */}
      <div className={cn(
        "flex-1 relative",
        theme === "dark" ? "bg-slate-900/30" : "bg-slate-50/30"
      )}>
        {/* Day grid background */}
        <div className="absolute inset-0 flex">
          {dayCells.map((day, i) => (
            <div
              key={i}
              className={cn(
                "h-full border-r",
                day.isWeekend
                  ? theme === "dark"
                    ? "bg-slate-800/30 border-slate-700/30"
                    : "bg-slate-100/50 border-slate-200/50"
                  : theme === "dark"
                  ? "border-slate-800/50"
                  : "border-slate-200/30"
              )}
              style={{ width: `${100 / dayCells.length}%` }}
            />
          ))}
        </div>

        {/* Task duration bar (background) */}
        {taskBar && (
          <div
            className={cn(
              "absolute top-1 bottom-1 rounded-sm z-10 transition-all duration-500",
              theme === "dark" ? "bg-slate-700/40" : "bg-slate-200/60",
              isVisible ? "opacity-100" : "opacity-0"
            )}
            style={{
              left: `${taskBar.left}%`,
              width: `${taskBar.width}%`,
              transitionDelay: `${index * 30 + 100}ms`,
            }}
            title={`${task.startDate} → ${task.endDate}`}
          />
        )}

        {/* Progress bar within task duration */}
        {taskBar && task.progress > 0 && (
          <div
            className={cn(
              "absolute top-1 h-1 rounded-full z-20 transition-all duration-500",
              task.progress >= 100 ? "bg-green-500" : "bg-teal-500",
              isVisible ? "opacity-100" : "opacity-0"
            )}
            style={{
              left: `${taskBar.left}%`,
              width: `${taskBar.width * (task.progress / 100)}%`,
              transitionDelay: `${index * 30 + 150}ms`,
            }}
          />
        )}

        {/* Work logs markers */}
        {task.startDate && task.endDate && task.workLogs && (() => {
          const taskStart = parseISO(task.startDate)
          const taskEnd = parseISO(task.endDate)
          const markers = []

          for (let d = taskStart; d <= taskEnd; d = addDays(d, 1)) {
            // Skip weekends
            if (isWeekend(d)) continue
            // Skip if outside visible range
            if (d < range.start || d > range.end) continue

            const dayIndex = differenceInDays(d, range.start)
            const leftPercent = (dayIndex / range.totalDays) * 100
            const widthPercent = (1 / range.totalDays) * 100
            const dateStr = format(d, "yyyy-MM-dd")

            // Find work log for this day
            const dayLog = task.workLogs!.find(log => log.date === dateStr)
            const loggedHours = dayLog?.hours || 0

            if (loggedHours === 0) continue // Only show days with logged hours

            // Color based on comparison with planned average
            const isAboveAvg = loggedHours >= avgHoursPerDay
            const isBelowAvg = loggedHours < avgHoursPerDay * 0.8

            markers.push(
              <div
                key={dateStr}
                className={cn(
                  "absolute bottom-1 z-30 h-5 flex items-center justify-center transition-all duration-300 rounded-sm",
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
                  minWidth: "16px",
                  transitionDelay: `${index * 30 + 200}ms`,
                }}
                title={`${dayLog?.employeeName} • ${loggedHours}ч • ${format(d, "d MMM", { locale: ru })}`}
              >
                <span className="text-[9px] font-bold text-white">
                  {loggedHours}
                </span>
              </div>
            )
          }

          return markers
        })()}

        {/* Anomaly markers - work logs OUTSIDE task dates (red) */}
        {task.startDate && task.endDate && task.workLogs && (() => {
          const taskStart = parseISO(task.startDate)
          const taskEnd = parseISO(task.endDate)

          // Find work logs outside task period
          const anomalousLogs = task.workLogs!.filter(log => {
            const logDate = parseISO(log.date)
            return logDate < taskStart || logDate > taskEnd
          })

          return anomalousLogs.map(log => {
            const logDate = parseISO(log.date)

            // Skip if outside visible range
            if (logDate < range.start || logDate > range.end) return null

            const dayIndex = differenceInDays(logDate, range.start)
            const leftPercent = (dayIndex / range.totalDays) * 100
            const widthPercent = (1 / range.totalDays) * 100

            const isBefore = logDate < taskStart
            const anomalyType = isBefore ? "ДО начала" : "ПОСЛЕ окончания"

            return (
              <div
                key={`anomaly-${log.id}`}
                className={cn(
                  "absolute bottom-1 z-30 h-5 flex items-center justify-center rounded-sm transition-all duration-300",
                  theme === "dark"
                    ? "bg-red-500/90"
                    : "bg-red-500/80",
                  isVisible ? "opacity-100" : "opacity-0"
                )}
                style={{
                  left: `calc(${leftPercent}% + 2px)`,
                  width: `calc(${widthPercent}% - 4px)`,
                  minWidth: "14px",
                  transitionDelay: `${index * 30 + 200}ms`,
                }}
                title={`⚠️ АНОМАЛИЯ: ${log.employeeName} • ${log.hours}ч • ${anomalyType} задачи • ${format(logDate, "d MMM", { locale: ru })}`}
              >
                <span className="text-[8px] font-bold text-white">
                  {log.hours}
                </span>
              </div>
            )
          })
        })()}

        {/* Budget progress bar positioned at bottom */}
        {task.budget && task.budget.amount > 0 && (() => {
          const budgetPercent = Math.min((task.budget.spent / task.budget.amount) * 100, 100)
          const isOverBudget = task.budget.spent >= task.budget.amount
          const isNearLimit = task.budget.spent >= task.budget.amount * 0.8

          // Only show if task has a position on timeline
          if (!taskBar) return null

          return (
            <div
              className={cn(
                "absolute top-1 h-0.5 rounded-full z-15 transition-all duration-500",
                isOverBudget
                  ? "bg-red-400"
                  : isNearLimit
                  ? "bg-amber-400"
                  : "bg-emerald-400",
                isVisible ? "opacity-70" : "opacity-0"
              )}
              style={{
                left: `${taskBar.left}%`,
                width: `${taskBar.width * (budgetPercent / 100)}%`,
                top: "6px",
                transitionDelay: `${index * 30 + 180}ms`,
              }}
              title={`Бюджет: ${formatBudget(task.budget.spent)} / ${formatBudget(task.budget.amount)}`}
            />
          )
        })()}
      </div>
    </div>
  )
}
