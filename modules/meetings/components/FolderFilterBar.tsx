'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useMeetingsStore } from '../store'
import { UNFILED_FOLDER } from '../types'
import { FoldersManagerDialog } from './FoldersManagerDialog'

/** Сентинел «Все созвоны» (radix Select не допускает пустое значение). */
const ALL = '__all__'

export function FolderFilterBar() {
  const folders = useMeetingsStore((s) => s.folders)
  const selectedFolderId = useMeetingsStore((s) => s.selectedFolderId)
  const selectFolder = useMeetingsStore((s) => s.selectFolder)

  return (
    <div className="flex items-center gap-2 border-b border-border p-3">
      <Select
        value={selectedFolderId ?? ALL}
        onValueChange={(value) => selectFolder(value === ALL ? null : value)}
      >
        <SelectTrigger className="h-9 flex-1" aria-label="Фильтр по папке">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Все созвоны</SelectItem>
          <SelectItem value={UNFILED_FOLDER}>Без папки</SelectItem>
          {folders.map((folder) => (
            <SelectItem key={folder.id} value={folder.id}>
              {folder.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <FoldersManagerDialog />
    </div>
  )
}
