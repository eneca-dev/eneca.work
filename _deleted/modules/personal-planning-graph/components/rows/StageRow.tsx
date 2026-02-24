"use client"

import { useMemo } from "react"
import { cn } from "@/lib/utils"
import { ChevronRight, User } from "lucide-react"
import type { DecompositionStage, TimelineRange } from "../../types"
import type { DayCell } from "../../utils"
import { calculateBarPositionSnapped, countWorkingDays } from "../../utils"
import { stageColors, getStageStatusInfo } from "../../config"
import { TimelineGridBackground } from "../TimelineGridBackground"
import { TaskRow } from "./TaskRow"
import { getEmployeeByName } from "../../mock-data"

interface StageRowProps {
  stage: DecompositionStage
  range: TimelineRange
  dayCells: DayCell[]
  theme: string
  colorIndex: number
  index: number
  isVisible: boolean
  isExpanded: boolean
  onToggle: () => void
}

export function StageRow({
  stage,
  range,
  dayCells,
  theme,
  colorIndex,
  index,
  isVisible,
  isExpanded,
  onToggle,
}: StageRowProps) {
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
  const totalLoggedHours = stage.tasks.reduce((sum, t) => sum + (t.workLogs || []).reduce((ws, log) => ws + log.hours, 0), 0)

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

        {/* Loading bar (employee assignment) - positioned at top to avoid overlap with start/finish */}
        {loadingBars.map((loading, loadingIndex) => (
          <div
            key={loading.id}
            className={cn(
              "absolute top-0.5 h-5 z-20 transition-all duration-300 flex items-center overflow-hidden shadow-sm rounded-sm",
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
                  className="w-4 h-4 flex-shrink-0 ml-1 rounded-sm"
                />
              ) : (
                <User className="w-3.5 h-3.5 flex-shrink-0 ml-1 opacity-70" />
              )
            })()}
            <span className={cn(
              "text-[10px] font-medium px-1 truncate whitespace-nowrap",
              colors.text
            )}>
              {loading.employeeName}
            </span>
            {loading.rate < 1 && (
              <span className={cn(
                "text-[9px] px-1 py-0.5 mr-0.5 ml-auto rounded-sm",
                theme === "dark" ? "bg-black/20 text-white/80" : "bg-white/30 text-white"
              )}>
                {Math.round(loading.rate * 100)}%
              </span>
            )}
          </div>
        ))}

        {/* Separator line for stage bar */}
        {plannedBar && (
          <div
            className={cn(
              "absolute top-1/2 -translate-y-1/2 h-px z-10",
              theme === "dark" ? "bg-slate-600/50" : "bg-slate-300/70"
            )}
            style={{
              left: `${plannedBar.left}%`,
              width: `${plannedBar.width}%`,
            }}
          />
        )}
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
                range={range}
                dayCells={dayCells}
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
