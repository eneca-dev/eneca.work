"use client"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { Project } from "@/types/project-types"

interface ProjectSelectorProps {
  projects: Project[]
  selectedProjectId: string | null
  onProjectChange: (projectId: string) => void
}

export function ProjectSelector({ projects, selectedProjectId, onProjectChange }: ProjectSelectorProps) {
  return (
    <div className="w-full">
      <Select value={selectedProjectId || ""} onValueChange={onProjectChange}>
        <SelectTrigger className="w-full bg-white border-0 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary py-1 h-9">
          <SelectValue placeholder="Select a project" />
        </SelectTrigger>
        <SelectContent className="bg-white border-0 shadow-lg rounded-lg overflow-hidden">
          {projects.map((project) => (
            <SelectItem key={project.id} value={project.id} className="cursor-pointer hover:bg-primary/5">
              {project.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

