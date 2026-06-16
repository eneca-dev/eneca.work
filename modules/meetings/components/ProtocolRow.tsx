'use client'

import { FileText, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { MeetingProtocol } from '../types'
import { formatMeetingDate } from '../utils'
import { HighlightedText } from './HighlightedText'
import { ConfirmDialog } from './ConfirmDialog'

interface ProtocolRowProps {
  protocol: MeetingProtocol
  isActive: boolean
  query: string
  /** В режиме поиска — имя проекта под названием. */
  projectName?: string
  onSelect: (protocolId: string) => void
  onDelete: (protocolId: string) => void
}

export function ProtocolRow({
  protocol,
  isActive,
  query,
  projectName,
  onSelect,
  onDelete,
}: ProtocolRowProps) {
  return (
    <div
      className={cn(
        'group flex items-center gap-1 rounded-md pr-1 transition-colors',
        isActive ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted',
      )}
    >
      <button
        type="button"
        onClick={() => onSelect(protocol.id)}
        className="flex min-w-0 flex-1 items-start gap-3 px-3 py-2.5 text-left"
      >
        <FileText className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1">
          <HighlightedText
            text={protocol.title}
            query={query}
            className="block truncate text-sm font-medium"
          />
          {projectName && (
            <span className="block truncate text-xs text-primary/80">{projectName}</span>
          )}
          <span className="block truncate text-xs text-muted-foreground">
            {formatMeetingDate(protocol.meetingDate)}
          </span>
        </span>
      </button>

      <ConfirmDialog
        title="Удалить протокол?"
        description={`Протокол «${protocol.title}» будет удалён.`}
        onConfirm={() => onDelete(protocol.id)}
        trigger={
          <button
            type="button"
            aria-label="Удалить протокол"
            className="flex-shrink-0 rounded p-1.5 text-muted-foreground opacity-0 transition-opacity hover:text-destructive focus:opacity-100 group-hover:opacity-100"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        }
      />
    </div>
  )
}
