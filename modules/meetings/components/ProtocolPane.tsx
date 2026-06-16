'use client'

import { useEffect, useState } from 'react'
import { FileText, Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { MeetingProtocol } from '../types'
import { MeetingsSearchBar } from './MeetingsSearchBar'
import { ProtocolRow } from './ProtocolRow'
import { InlineInput } from './InlineInput'

interface ProtocolPaneProps {
  protocols: MeetingProtocol[]
  selectedProtocolId: string | null
  searchQuery: string
  isSearching: boolean
  /** Имя проекта по id — для подписи в режиме поиска. */
  projectNameById: Record<string, string>
  /** Выбранный проект (null в режиме поиска / без выбора). */
  selectedProjectId: string | null
  onSearchChange: (query: string) => void
  onSelectProtocol: (protocolId: string) => void
  onAddProtocol: (title: string) => void
  onDeleteProtocol: (protocolId: string) => void
}

export function ProtocolPane({
  protocols,
  selectedProtocolId,
  searchQuery,
  isSearching,
  projectNameById,
  selectedProjectId,
  onSearchChange,
  onSelectProtocol,
  onAddProtocol,
  onDeleteProtocol,
}: ProtocolPaneProps) {
  const [isAdding, setIsAdding] = useState(false)
  const [draft, setDraft] = useState('')

  const canAdd = !isSearching && selectedProjectId !== null

  // Закрываем форму добавления, если добавление стало недоступно (смена фильтра / поиск).
  useEffect(() => {
    if (!canAdd) {
      setIsAdding(false)
      setDraft('')
    }
  }, [canAdd])

  const commitAdd = () => {
    const trimmed = draft.trim()
    if (trimmed) onAddProtocol(trimmed)
    setDraft('')
    setIsAdding(false)
  }

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-2 border-b border-border p-3">
        <MeetingsSearchBar value={searchQuery} onChange={onSearchChange} />
        <div className="flex items-center justify-between px-1">
          <span className="text-xs text-muted-foreground">
            {isSearching ? 'Найдено' : 'Протоколов'}: {protocols.length}
          </span>
          {canAdd && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-muted-foreground hover:text-foreground"
              onClick={() => setIsAdding((v) => !v)}
            >
              <Plus className="mr-1 h-4 w-4" />
              Протокол
            </Button>
          )}
        </div>
        {isAdding && canAdd && (
          <InlineInput
            value={draft}
            onChange={setDraft}
            onCommit={commitAdd}
            onCancel={() => {
              setDraft('')
              setIsAdding(false)
            }}
            placeholder="Название протокола"
            ariaLabel="Название нового протокола"
          />
        )}
      </div>

      {protocols.length === 0 ? (
        <EmptyProtocols isSearching={isSearching} selectedProjectId={selectedProjectId} />
      ) : (
        <ul className="flex-1 space-y-1 overflow-y-auto p-2">
          {protocols.map((protocol) => (
            <li key={protocol.id}>
              <ProtocolRow
                protocol={protocol}
                isActive={protocol.id === selectedProtocolId}
                query={searchQuery}
                projectName={
                  selectedProjectId === null ? projectNameById[protocol.projectId] : undefined
                }
                onSelect={onSelectProtocol}
                onDelete={onDeleteProtocol}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function EmptyProtocols({
  isSearching,
  selectedProjectId,
}: {
  isSearching: boolean
  selectedProjectId: string | null
}) {
  const Icon = isSearching ? Search : FileText
  const message = isSearching
    ? 'Ничего не найдено'
    : selectedProjectId
      ? 'В этом проекте пока нет протоколов'
      : 'Пока нет протоколов'

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center text-muted-foreground">
      <Icon className="h-9 w-9 opacity-40" />
      <p className="text-sm">{message}</p>
    </div>
  )
}
