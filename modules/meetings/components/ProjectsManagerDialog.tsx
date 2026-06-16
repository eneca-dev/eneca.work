'use client'

import { useMemo, useState } from 'react'
import { FolderCog } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { useMeetingsStore } from '../store'
import { ProjectList } from './ProjectList'

/** Управление проектами: добавление/переименование/удаление. Выбор проекта применяет фильтр и закрывает окно. */
export function ProjectsManagerDialog() {
  const [open, setOpen] = useState(false)

  const projects = useMeetingsStore((s) => s.projects)
  const protocols = useMeetingsStore((s) => s.protocols)
  const selectedProjectId = useMeetingsStore((s) => s.selectedProjectId)
  const selectProject = useMeetingsStore((s) => s.selectProject)
  const addProject = useMeetingsStore((s) => s.addProject)
  const renameProject = useMeetingsStore((s) => s.renameProject)
  const deleteProject = useMeetingsStore((s) => s.deleteProject)

  const protocolCountByProject = useMemo(() => {
    return protocols.reduce<Record<string, number>>((acc, p) => {
      acc[p.projectId] = (acc[p.projectId] ?? 0) + 1
      return acc
    }, {})
  }, [protocols])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9 flex-shrink-0"
          aria-label="Управление проектами"
        >
          <FolderCog className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md">
        <DialogHeader className="px-4 pb-2 pt-4">
          <DialogTitle>Управление проектами</DialogTitle>
          <DialogDescription>Добавляйте, переименовывайте и удаляйте проекты.</DialogDescription>
        </DialogHeader>
        <div className="h-[60vh] border-t border-border">
          <ProjectList
            projects={projects}
            selectedProjectId={selectedProjectId}
            protocolCountByProject={protocolCountByProject}
            onSelect={(projectId) => {
              selectProject(projectId)
              setOpen(false)
            }}
            onAdd={addProject}
            onRename={renameProject}
            onDelete={deleteProject}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
