'use client'

import { Folder } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useMeetingsStore } from '../store'

/** Сентинел «Без папки». */
const NONE = '__none__'

/** Назначение открытого созвона в локальную папку. */
export function FolderAssignSelect({ reportId }: { reportId: string }) {
  const folders = useMeetingsStore((s) => s.folders)
  const assignments = useMeetingsStore((s) => s.assignments)
  const assignReport = useMeetingsStore((s) => s.assignReport)

  const current = assignments[reportId] ?? NONE

  return (
    <Select value={current} onValueChange={(value) => assignReport(reportId, value === NONE ? null : value)}>
      <SelectTrigger className="h-8 w-auto gap-1.5 text-xs" aria-label="Папка созвона">
        <Folder className="h-3.5 w-3.5" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>Без папки</SelectItem>
        {folders.map((folder) => (
          <SelectItem key={folder.id} value={folder.id}>
            {folder.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
