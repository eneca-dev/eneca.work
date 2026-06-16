'use client'

import { useMemo } from 'react'
import { useMediaQuery } from 'usehooks-ts'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useMeetingsStore } from '../store'
import { searchProtocols } from '../search'
import { ProjectFilterBar } from './ProjectFilterBar'
import { ProtocolPane } from './ProtocolPane'
import { ProtocolViewer } from './ProtocolViewer'

export function MeetingsPanel() {
  const projects = useMeetingsStore((s) => s.projects)
  const protocols = useMeetingsStore((s) => s.protocols)
  const selectedProjectId = useMeetingsStore((s) => s.selectedProjectId)
  const selectedProtocolId = useMeetingsStore((s) => s.selectedProtocolId)
  const searchQuery = useMeetingsStore((s) => s.searchQuery)

  const selectProtocol = useMeetingsStore((s) => s.selectProtocol)
  const setSearchQuery = useMeetingsStore((s) => s.setSearchQuery)
  const addProtocol = useMeetingsStore((s) => s.addProtocol)
  const deleteProtocol = useMeetingsStore((s) => s.deleteProtocol)

  // initializeWithValue: false — на сервере и при первом клиентском рендере возвращает false,
  // значение обновляется после монтирования (без рассинхрона гидрации).
  const isLargeScreen = useMediaQuery('(min-width: 1024px)', { initializeWithValue: false })
  const isSearching = searchQuery.trim().length > 0

  const projectNameById = useMemo(() => {
    return projects.reduce<Record<string, string>>((acc, p) => {
      acc[p.id] = p.name
      return acc
    }, {})
  }, [projects])

  // Список протоколов: фильтр по проекту (null = все), затем поиск внутри отфильтрованного.
  const baseProtocols = useMemo(
    () =>
      selectedProjectId
        ? protocols.filter((p) => p.projectId === selectedProjectId)
        : protocols,
    [protocols, selectedProjectId],
  )

  const listProtocols = useMemo(
    () => (isSearching ? searchProtocols(baseProtocols, searchQuery) : baseProtocols),
    [baseProtocols, isSearching, searchQuery],
  )

  const selectedProtocol = useMemo(
    () => protocols.find((p) => p.id === selectedProtocolId) ?? null,
    [protocols, selectedProtocolId],
  )

  const viewerProjectName = selectedProtocol
    ? projectNameById[selectedProtocol.projectId] ?? null
    : null

  const listPane = (
    <div className="flex h-full flex-col">
      <ProjectFilterBar />
      <div className="min-h-0 flex-1">
        <ProtocolPane
          protocols={listProtocols}
          selectedProtocolId={selectedProtocolId}
          searchQuery={searchQuery}
          isSearching={isSearching}
          projectNameById={projectNameById}
          selectedProjectId={selectedProjectId}
          onSearchChange={setSearchQuery}
          onSelectProtocol={selectProtocol}
          onAddProtocol={(title) => {
            if (selectedProjectId) addProtocol(selectedProjectId, title)
          }}
          onDeleteProtocol={deleteProtocol}
        />
      </div>
    </div>
  )

  const viewerPane = (
    <ProtocolViewer
      protocol={selectedProtocol}
      projectName={viewerProjectName}
      query={searchQuery}
    />
  )

  // Десктоп: две панели с перетаскиваемой границей (ширины сохраняются в localStorage).
  if (isLargeScreen) {
    return (
      <PanelGroup
        direction="horizontal"
        autoSaveId="meetings-panels-v2"
        className="h-full bg-background"
      >
        <Panel defaultSize={36} minSize={24} maxSize={55}>
          {listPane}
        </Panel>
        <ResizeHandle />
        <Panel minSize={35}>{viewerPane}</Panel>
      </PanelGroup>
    )
  }

  // Мобайл: drill-down список → текст протокола.
  if (selectedProtocol) {
    return (
      <div className="flex h-full flex-col bg-background">
        <MobileBackHeader label="К списку протоколов" onBack={() => selectProtocol(null)} />
        <div className="min-h-0 flex-1">{viewerPane}</div>
      </div>
    )
  }

  return <div className="h-full bg-background">{listPane}</div>
}

function ResizeHandle() {
  return (
    <PanelResizeHandle className="w-1.5 bg-border/40 transition-colors hover:bg-primary/40 data-[resize-handle-state=drag]:bg-primary/60" />
  )
}

function MobileBackHeader({ label, onBack }: { label: string; onBack: () => void }) {
  return (
    <div className="border-b border-border p-2">
      <Button variant="ghost" size="sm" onClick={onBack} className="text-muted-foreground">
        <ArrowLeft className="mr-2 h-4 w-4" />
        {label}
      </Button>
    </div>
  )
}
