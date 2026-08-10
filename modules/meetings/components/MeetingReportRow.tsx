'use client'

import { FileText, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { MeetingReport } from '../types'
import { formatMeetingDate } from '../utils'
import { HighlightedText } from './HighlightedText'

interface MeetingReportRowProps {
  meeting: MeetingReport
  isActive: boolean
  query: string
  onSelect: (id: string) => void
}

export function MeetingReportRow({ meeting, isActive, query, onSelect }: MeetingReportRowProps) {
  const title = meeting.subject?.trim() || 'Созвон без темы'
  const dateIso = meeting.meeting_date ?? meeting.meeting_started_at
  const hasError = meeting.status === 'error'

  return (
    <button
      type="button"
      onClick={() => onSelect(meeting.id)}
      className={cn(
        'flex w-full items-start gap-3 rounded-md px-3 py-2.5 text-left transition-colors',
        isActive ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted',
      )}
    >
      <FileText className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1">
        <HighlightedText text={title} query={query} className="block truncate text-sm font-medium" />
        <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          {hasError && <AlertCircle className="h-3 w-3 flex-shrink-0 text-destructive" />}
          <span className="truncate">
            {dateIso ? formatMeetingDate(dateIso) : 'без даты'}
            {meeting.invited_by_name ? ` · ${meeting.invited_by_name}` : ''}
          </span>
        </span>
      </span>
    </button>
  )
}
