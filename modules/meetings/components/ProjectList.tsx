'use client'

import { useState } from 'react'
import { FolderKanban, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { PersonalProject } from '../types'
import { ProjectRow } from './ProjectRow'
import { InlineInput } from './InlineInput'

interface ProjectListProps {
  projects: PersonalProject[]
  selectedProjectId: string | null
  protocolCountByProject: Record<string, number>
  onSelect: (projectId: string) => void
  onAdd: (name: string) => void
  onRename: (projectId: string, name: string) => void
  onDelete: (projectId: string) => void
}

export function ProjectList({
  projects,
  selectedProjectId,
  protocolCountByProject,
  onSelect,
  onAdd,
  onRename,
  onDelete,
}: ProjectListProps) {
  const [isAdding, setIsAdding] = useState(false)
  const [draft, setDraft] = useState('')

  const commitAdd = () => {
    const trimmed = draft.trim()
    if (trimmed) onAdd(trimmed)
    setDraft('')
    setIsAdding(false)
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">Проекты</h2>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          onClick={() => setIsAdding((v) => !v)}
          aria-label="Добавить проект"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {isAdding && (
        <div className="border-b border-border p-2">
          <InlineInput
            value={draft}
            onChange={setDraft}
            onCommit={commitAdd}
            onCancel={() => {
              setDraft('')
              setIsAdding(false)
            }}
            placeholder="Название проекта"
            ariaLabel="Название нового проекта"
          />
        </div>
      )}

      {projects.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center text-muted-foreground">
          <FolderKanban className="h-9 w-9 opacity-40" />
          <p className="text-sm">Пока нет проектов</p>
          <Button variant="outline" size="sm" onClick={() => setIsAdding(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Создать первый проект
          </Button>
        </div>
      ) : (
        <ul className="flex-1 space-y-1 overflow-y-auto p-2">
          {projects.map((project) => (
            <li key={project.id}>
              <ProjectRow
                project={project}
                isActive={project.id === selectedProjectId}
                protocolCount={protocolCountByProject[project.id] ?? 0}
                onSelect={onSelect}
                onRename={onRename}
                onDelete={onDelete}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
