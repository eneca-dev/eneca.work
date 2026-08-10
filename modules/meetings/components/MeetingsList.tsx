'use client'

import type { ReactNode } from 'react'
import { Loader2, AlertCircle, Inbox, Search } from 'lucide-react'
import type { MeetingReport } from '../types'
import { MeetingsSearchBar } from './MeetingsSearchBar'
import { MeetingReportRow } from './MeetingReportRow'

interface MeetingsListProps {
  meetings: MeetingReport[]
  selectedReportId: string | null
  searchQuery: string
  isLoading: boolean
  isError: boolean
  errorMessage?: string
  onSearchChange: (query: string) => void
  onSelect: (id: string) => void
}

export function MeetingsList({
  meetings,
  selectedReportId,
  searchQuery,
  isLoading,
  isError,
  errorMessage,
  onSearchChange,
  onSelect,
}: MeetingsListProps) {
  const isSearching = searchQuery.trim().length > 0

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-2 border-b border-border p-3">
        <MeetingsSearchBar value={searchQuery} onChange={onSearchChange} />
        {!isLoading && !isError && (
          <p className="px-1 text-xs text-muted-foreground">
            {isSearching ? 'Найдено' : 'Созвонов'}: {meetings.length}
          </p>
        )}
      </div>

      {isLoading ? (
        <Centered>
          <Loader2 className="h-6 w-6 animate-spin opacity-60" />
          <p className="text-sm">Загрузка созвонов…</p>
        </Centered>
      ) : isError ? (
        <Centered>
          <AlertCircle className="h-8 w-8 text-destructive opacity-70" />
          <p className="text-sm">{errorMessage || 'Не удалось загрузить созвоны'}</p>
        </Centered>
      ) : meetings.length === 0 ? (
        <Centered>
          {isSearching ? <Search className="h-8 w-8 opacity-40" /> : <Inbox className="h-8 w-8 opacity-40" />}
          <p className="text-sm">{isSearching ? 'Ничего не найдено' : 'Созвонов пока нет'}</p>
        </Centered>
      ) : (
        <ul className="flex-1 space-y-1 overflow-y-auto p-2">
          {meetings.map((meeting) => (
            <li key={meeting.id}>
              <MeetingReportRow
                meeting={meeting}
                isActive={meeting.id === selectedReportId}
                query={searchQuery}
                onSelect={onSelect}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Centered({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center text-muted-foreground">
      {children}
    </div>
  )
}
