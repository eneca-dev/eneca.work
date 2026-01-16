"use client"

import { useMemo } from "react"
import { cn } from "@/lib/utils"
import { ChevronRight, Layers } from "lucide-react"
import type { ProjectStage, TimelineRange } from "../../types"
import type { DayCell } from "../../utils"
import { TimelineGridBackground } from "../TimelineGridBackground"
import { ObjectRow } from "./ObjectRow"

interface ProjectStageRowProps {
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
}

export function ProjectStageRow({
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
}: ProjectStageRowProps) {
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
          (sum, s) => sum + s.tasks.reduce((ts, t) => ts + (t.workLogs || []).reduce((ws, log) => ws + log.hours, 0), 0),
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
