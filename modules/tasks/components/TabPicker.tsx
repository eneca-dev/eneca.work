'use client'

import { useMemo, useState, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import {
  Plus,
  LayoutGrid,
  GanttChart,
  Users,
  Wallet,
  FolderTree,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTasksTabsStore, type TaskTab, type TasksViewMode } from '../stores'
import { useTasksPrefetch } from '../hooks'
import { TabModal } from './TabModal'

const VIEW_MODE_ICON_MAP: Record<TasksViewMode, LucideIcon> = {
  kanban: LayoutGrid,
  timeline: GanttChart,
  departments: Users,
  budgets: Wallet,
  sections: FolderTree,
}

interface TabPickerCardProps {
  tab: TaskTab
  onOpen: (id: string) => void
  onPrefetch: (id: string) => void
}

function TabPickerCard({ tab, onOpen, onPrefetch }: TabPickerCardProps) {
  const Icon = VIEW_MODE_ICON_MAP[tab.viewMode]
  return (
    <button
      type="button"
      onClick={() => onOpen(tab.id)}
      onMouseEnter={() => onPrefetch(tab.id)}
      onFocus={() => onPrefetch(tab.id)}
      className={cn(
        'flex flex-col items-start gap-3 rounded-lg border border-border bg-card p-5 text-left',
        'transition-colors hover:border-primary hover:bg-accent/40',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary'
      )}
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </span>
      <span className="text-sm font-medium text-foreground">{tab.name}</span>
    </button>
  )
}

export function TabPicker() {
  const router = useRouter()
  const pathname = usePathname()

  const tabs = useTasksTabsStore((s) => s.tabs)
  const activeTabId = useTasksTabsStore((s) => s.activeTabId)

  const sortedTabs = useMemo(() => [...tabs].sort((a, b) => a.order - b.order), [tabs])

  // Префетч включён, пока показан пикер (этот компонент смонтирован)
  const { prefetchTab } = useTasksPrefetch({ tabs, activeTabId, enabled: true })

  const [modalOpen, setModalOpen] = useState(false)

  const handleOpen = useCallback(
    (id: string) => {
      router.push(`${pathname}?tab=${encodeURIComponent(id)}`)
    },
    [router, pathname]
  )

  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="w-full max-w-3xl">
        <div className="mb-6 text-center">
          <h2 className="text-lg font-semibold text-foreground">Выберите вкладку</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Содержимое загрузится после выбора — данные уже греются в фоне
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {sortedTabs.map((tab) => (
            <TabPickerCard
              key={tab.id}
              tab={tab}
              onOpen={handleOpen}
              onPrefetch={prefetchTab}
            />
          ))}

          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className={cn(
              'flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border p-5',
              'text-muted-foreground transition-colors hover:border-primary hover:text-foreground',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary'
            )}
          >
            <Plus className="h-5 w-5" />
            <span className="text-sm font-medium">Новая вкладка</span>
          </button>
        </div>
      </div>

      <TabModal open={modalOpen} onClose={() => setModalOpen(false)} editingTab={null} />
    </div>
  )
}
