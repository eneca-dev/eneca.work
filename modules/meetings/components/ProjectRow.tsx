'use client'

import { useState } from 'react'
import { FolderKanban, Pencil, Trash2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { PersonalProject } from '../types'
import { formatRelative } from '../utils'
import { pluralizeProtocols } from '../plural'
import { ConfirmDialog } from './ConfirmDialog'

interface ProjectRowProps {
  project: PersonalProject
  isActive: boolean
  protocolCount: number
  onSelect: (projectId: string) => void
  onRename: (projectId: string, name: string) => void
  onDelete: (projectId: string) => void
}

export function ProjectRow({
  project,
  isActive,
  protocolCount,
  onSelect,
  onRename,
  onDelete,
}: ProjectRowProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState(project.name)

  const commitRename = () => {
    const trimmed = draft.trim()
    if (trimmed && trimmed !== project.name) onRename(project.id, trimmed)
    else setDraft(project.name)
    setIsEditing(false)
  }

  if (isEditing) {
    return (
      <div className="p-1">
        <Input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitRename()
            if (e.key === 'Escape') {
              setDraft(project.name)
              setIsEditing(false)
            }
          }}
          className="h-9"
          aria-label="Название проекта"
        />
      </div>
    )
  }

  return (
    <div
      className={cn(
        'group flex items-center gap-2 rounded-md pr-1 transition-colors',
        isActive ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted',
      )}
    >
      <button
        type="button"
        onClick={() => onSelect(project.id)}
        className="flex min-w-0 flex-1 items-start gap-3 px-3 py-2 text-left"
      >
        <FolderKanban className="mt-0.5 h-5 w-5 flex-shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{project.name}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {protocolCount} {pluralizeProtocols(protocolCount)} · {formatRelative(project.updatedAt)}
          </span>
        </span>
      </button>

      <div className="flex flex-shrink-0 items-center opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
        <button
          type="button"
          onClick={() => {
            setDraft(project.name)
            setIsEditing(true)
          }}
          aria-label="Переименовать проект"
          className="rounded p-1.5 text-muted-foreground hover:text-foreground"
        >
          <Pencil className="h-4 w-4" />
        </button>
        <ConfirmDialog
          title="Удалить проект?"
          description={`Проект «${project.name}» и все его протоколы будут удалены.`}
          onConfirm={() => onDelete(project.id)}
          trigger={
            <button
              type="button"
              aria-label="Удалить проект"
              className="rounded p-1.5 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          }
        />
      </div>
    </div>
  )
}
