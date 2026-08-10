'use client'

import { useEffect, useMemo } from 'react'
import { useMediaQuery } from 'usehooks-ts'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useMeetingsStore } from '../store'
import { useMeetingReports } from '../hooks/use-meeting-reports'
import { searchReports } from '../search'
import { UNFILED_FOLDER } from '../types'
import { MeetingsList } from './MeetingsList'
import { ReportViewer } from './ReportViewer'
import { FolderFilterBar } from './FolderFilterBar'

export function MeetingsPanel() {
  const selectedReportId = useMeetingsStore((s) => s.selectedReportId)
  const searchQuery = useMeetingsStore((s) => s.searchQuery)
  const selectedFolderId = useMeetingsStore((s) => s.selectedFolderId)
  const assignments = useMeetingsStore((s) => s.assignments)
  const selectReport = useMeetingsStore((s) => s.selectReport)
  const setSearchQuery = useMeetingsStore((s) => s.setSearchQuery)

  const { data: reports, isLoading, isError, error } = useMeetingReports()

  // Регидрация persist-стора папок после монтирования (см. skipHydration в store).
  useEffect(() => {
    useMeetingsStore.persist.rehydrate()
  }, [])

  // initializeWithValue: false — без рассинхрона гидрации (SSR → false → реальное после монтирования).
  const isLargeScreen = useMediaQuery('(min-width: 1024px)', { initializeWithValue: false })

  // Сначала фильтр по папке (null = все, UNFILED = без папки), затем поиск.
  const byFolder = useMemo(() => {
    const all = reports ?? []
    if (!selectedFolderId) return all
    if (selectedFolderId === UNFILED_FOLDER) return all.filter((r) => !assignments[r.id])
    return all.filter((r) => assignments[r.id] === selectedFolderId)
  }, [reports, selectedFolderId, assignments])

  const filtered = useMemo(() => searchReports(byFolder, searchQuery), [byFolder, searchQuery])

  const selectedReport = useMemo(
    () => (reports ?? []).find((r) => r.id === selectedReportId) ?? null,
    [reports, selectedReportId],
  )

  const listPane = (
    <div className="flex h-full flex-col">
      <FolderFilterBar />
      <div className="min-h-0 flex-1">
        <MeetingsList
          meetings={filtered}
          selectedReportId={selectedReportId}
          searchQuery={searchQuery}
          isLoading={isLoading}
          isError={isError}
          errorMessage={error?.message}
          onSearchChange={setSearchQuery}
          onSelect={selectReport}
        />
      </div>
    </div>
  )

  const viewerPane = <ReportViewer meeting={selectedReport} query={searchQuery} />

  // Десктоп: список + просмотр с перетаскиваемой границей.
  if (isLargeScreen) {
    return (
      <PanelGroup
        direction="horizontal"
        autoSaveId="meetings-panels-reports"
        className="h-full bg-background"
      >
        <Panel defaultSize={34} minSize={24} maxSize={55}>
          {listPane}
        </Panel>
        <ResizeHandle />
        <Panel minSize={40}>{viewerPane}</Panel>
      </PanelGroup>
    )
  }

  // Мобайл: drill-down список → протокол.
  if (selectedReport) {
    return (
      <div className="flex h-full flex-col bg-background">
        <div className="border-b border-border p-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => selectReport(null)}
            className="text-muted-foreground"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            К списку
          </Button>
        </div>
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
