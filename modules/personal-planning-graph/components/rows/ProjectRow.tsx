"use client"

import { useMemo } from "react"
import { cn } from "@/lib/utils"
import { ChevronRight, FolderKanban } from "lucide-react"
import type { Project, TimelineRange } from "../../types"
import type { DayCell } from "../../utils"
import { TimelineGridBackground } from "../TimelineGridBackground"
import { ProjectStageRow } from "./ProjectStageRow"

interface ProjectRowProps {
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
}

export function ProjectRow({
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
}: ProjectRowProps) {
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
            (sum, s) => sum + s.tasks.reduce((ts, t) => ts + (t.workLogs || []).reduce((ws, log) => ws + log.hours, 0), 0),
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
