"use client"

import { useMemo } from "react"
import { cn } from "@/lib/utils"
import { ChevronRight, Building2 } from "lucide-react"
import type { PlanningObject, TimelineRange } from "../../types"
import type { DayCell } from "../../utils"
import { TimelineGridBackground } from "../TimelineGridBackground"
import { SectionRow } from "./SectionRow"

interface ObjectRowProps {
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
}

export function ObjectRow({
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
}: ObjectRowProps) {
  // Calculate object stats
  const stats = useMemo(() => {
    let totalPlannedHours = 0
    let totalLoggedHours = 0

    object.sections.forEach(section => {
      totalPlannedHours += section.stages.reduce((sum, s) => sum + s.plannedHours, 0)
      totalLoggedHours += section.stages.reduce(
        (sum, s) => sum + s.tasks.reduce((ts, t) => ts + (t.workLogs || []).reduce((ws, log) => ws + log.hours, 0), 0),
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
