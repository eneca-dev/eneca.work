import { useRoadmap } from "../../context/roadmap-context"
import { cn } from "@/lib/utils"
import { ProjectSelector } from "@/components/project-selector"
import type { Project } from "@/types/project-types"

interface DaysHeaderProps {
  projects: Project[]
  selectedProjectId: string | null
  onProjectChange: (projectId: string) => void
}

export function DaysHeader({ projects, selectedProjectId, onProjectChange }: DaysHeaderProps) {
  const { workingDays, CELL_WIDTH } = useRoadmap()

  return (
    <div className="flex bg-white">
      <div className="w-64 min-w-64 p-3 border-r bg-white">
        <ProjectSelector projects={projects} selectedProjectId={selectedProjectId} onProjectChange={onProjectChange} />
      </div>
      <div className="flex-1 flex">
        {workingDays.map((day, index) => {
          const isWeekend = day.getDay() === 0 || day.getDay() === 6
          const isToday = new Date().toDateString() === day.toDateString()

          return (
            <div
              key={index}
              className={cn(
                "text-center text-xs border-r flex items-center justify-center",
                isWeekend ? "bg-gray-50" : "",
                isToday ? "bg-[#e6f0ee]" : "",
              )}
              style={{ width: `${CELL_WIDTH}px`, minWidth: `${CELL_WIDTH}px` }}
            >
              <span
                className={cn(
                  "rounded-full w-6 h-6 flex items-center justify-center",
                  isToday ? "bg-[#1e7260] text-white" : "",
                )}
              >
                {day.getDate()}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

