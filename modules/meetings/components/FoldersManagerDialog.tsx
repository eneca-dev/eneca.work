'use client'

import { useMemo, useState } from 'react'
import { FolderCog, Plus, Folder, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { useMeetingsStore } from '../store'
import type { MeetingFolder } from '../types'
import { InlineInput } from './InlineInput'
import { ConfirmDialog } from './ConfirmDialog'

/** Управление локальными папками (создать/переименовать/удалить). */
export function FoldersManagerDialog() {
  const folders = useMeetingsStore((s) => s.folders)
  const assignments = useMeetingsStore((s) => s.assignments)
  const addFolder = useMeetingsStore((s) => s.addFolder)
  const renameFolder = useMeetingsStore((s) => s.renameFolder)
  const deleteFolder = useMeetingsStore((s) => s.deleteFolder)

  const [isAdding, setIsAdding] = useState(false)
  const [draft, setDraft] = useState('')

  const countByFolder = useMemo(() => {
    const acc: Record<string, number> = {}
    for (const folderId of Object.values(assignments)) {
      acc[folderId] = (acc[folderId] ?? 0) + 1
    }
    return acc
  }, [assignments])

  const commitAdd = () => {
    const trimmed = draft.trim()
    if (trimmed) addFolder(trimmed)
    setDraft('')
    setIsAdding(false)
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" className="h-9 w-9 flex-shrink-0" aria-label="Управление папками">
          <FolderCog className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md">
        <DialogHeader className="px-4 pb-2 pt-4">
          <DialogTitle>Папки</DialogTitle>
          <DialogDescription>Создавайте папки и раскладывайте по ним созвоны.</DialogDescription>
        </DialogHeader>

        <div className="flex max-h-[60vh] flex-col border-t border-border">
          <div className="border-b border-border p-2">
            {isAdding ? (
              <InlineInput
                value={draft}
                onChange={setDraft}
                onCommit={commitAdd}
                onCancel={() => {
                  setDraft('')
                  setIsAdding(false)
                }}
                placeholder="Название папки"
                ariaLabel="Название новой папки"
              />
            ) : (
              <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => setIsAdding(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Новая папка
              </Button>
            )}
          </div>

          {folders.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">Папок пока нет</p>
          ) : (
            <ul className="space-y-1 overflow-y-auto p-2">
              {folders.map((folder) => (
                <li key={folder.id}>
                  <FolderRow
                    folder={folder}
                    count={countByFolder[folder.id] ?? 0}
                    onRename={(name) => renameFolder(folder.id, name)}
                    onDelete={() => deleteFolder(folder.id)}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function FolderRow({
  folder,
  count,
  onRename,
  onDelete,
}: {
  folder: MeetingFolder
  count: number
  onRename: (name: string) => void
  onDelete: () => void
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState(folder.name)

  const commit = () => {
    const trimmed = draft.trim()
    if (trimmed && trimmed !== folder.name) onRename(trimmed)
    else setDraft(folder.name)
    setIsEditing(false)
  }

  if (isEditing) {
    return (
      <InlineInput
        value={draft}
        onChange={setDraft}
        onCommit={commit}
        onCancel={() => {
          setDraft(folder.name)
          setIsEditing(false)
        }}
        ariaLabel="Название папки"
      />
    )
  }

  return (
    <div className={cn('group flex items-center gap-2 rounded-md px-3 py-2 hover:bg-muted')}>
      <Folder className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate text-sm">{folder.name}</span>
      <span className="text-xs text-muted-foreground">{count}</span>
      <div className="flex flex-shrink-0 items-center opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
        <button
          type="button"
          onClick={() => {
            setDraft(folder.name)
            setIsEditing(true)
          }}
          aria-label="Переименовать папку"
          className="rounded p-1.5 text-muted-foreground hover:text-foreground"
        >
          <Pencil className="h-4 w-4" />
        </button>
        <ConfirmDialog
          title="Удалить папку?"
          description={`Папка «${folder.name}» будет удалена. Созвоны останутся, но выйдут из папки.`}
          onConfirm={onDelete}
          trigger={
            <button
              type="button"
              aria-label="Удалить папку"
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
