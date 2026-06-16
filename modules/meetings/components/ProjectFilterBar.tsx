'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useMeetingsStore } from '../store'
import { ProjectsManagerDialog } from './ProjectsManagerDialog'

/** Сентинел для пункта «Все проекты» (radix Select не допускает пустое значение). */
const ALL_PROJECTS = '__all__'

export function ProjectFilterBar() {
  const projects = useMeetingsStore((s) => s.projects)
  const selectedProjectId = useMeetingsStore((s) => s.selectedProjectId)
  const selectProject = useMeetingsStore((s) => s.selectProject)

  return (
    <div className="flex items-center gap-2 border-b border-border p-3">
      <Select
        value={selectedProjectId ?? ALL_PROJECTS}
        onValueChange={(value) => selectProject(value === ALL_PROJECTS ? null : value)}
      >
        <SelectTrigger className="h-9 flex-1" aria-label="Фильтр по проекту">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_PROJECTS}>Все проекты</SelectItem>
          {projects.map((project) => (
            <SelectItem key={project.id} value={project.id}>
              {project.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <ProjectsManagerDialog />
    </div>
  )
}
