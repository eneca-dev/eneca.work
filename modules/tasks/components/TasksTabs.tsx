'use client'

import { useState } from 'react'
import {
  Plus,
  Pencil,
  Trash2,
  MoreHorizontal,
  LayoutGrid,
  GanttChart,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { useTasksTabsStore, MAX_USER_TABS, type TaskTab, type TasksViewMode } from '../stores'
import { TabModal } from './TabModal'

// ============================================================================
// Icon Mapping
// ============================================================================

const VIEW_MODE_ICON_MAP: Record<TasksViewMode, LucideIcon> = {
  kanban: LayoutGrid,
  timeline: GanttChart,
  departments: Users,
  budgets: Wallet,
}

// ============================================================================
// Tab Item Component
// ============================================================================

interface TabItemProps {
  tab: TaskTab
  isActive: boolean
  onClick: () => void
  onEdit?: () => void
  onDelete?: () => void
}

function TabItem({ tab, isActive, onClick, onEdit, onDelete }: TabItemProps) {
  const Icon = VIEW_MODE_ICON_MAP[tab.viewMode]

  return (
    <div className="relative flex items-center group">
      <button
        onClick={onClick}
        className={cn(
          'flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors',
          isActive
            ? 'border-primary text-foreground'
            : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
        )}
      >
        <Icon className="h-4 w-4" />
        <span>{tab.name}</span>
      </button>

      {/* Dropdown menu for all tabs */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className={cn(
              'absolute -right-1 top-1/2 -translate-y-1/2 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity',
              'hover:bg-accent text-muted-foreground hover:text-foreground'
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-40">
          {/* Edit only for non-system tabs */}
          {!tab.isSystem && (
            <DropdownMenuItem onClick={onEdit}>
              <Pencil className="h-4 w-4 mr-2" />
              Изменить
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            onClick={onDelete}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Удалить
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

// ============================================================================
// Main Component
// ============================================================================

interface TasksTabsProps {
  className?: string
}

export function TasksTabs({ className }: TasksTabsProps) {
  const { tabs, activeTabId, setActiveTab, deleteTab } = useTasksTabsStore()

  const [modalOpen, setModalOpen] = useState(false)
  const [editingTab, setEditingTab] = useState<TaskTab | null>(null)

  const sortedTabs = [...tabs].sort((a, b) => a.order - b.order)
  const tabsCount = tabs.length
  const canAddMore = tabsCount < MAX_USER_TABS

  const handleAddClick = () => {
    setEditingTab(null)
    setModalOpen(true)
  }

  const handleEditClick = (tab: TaskTab) => {
    setEditingTab(tab)
    setModalOpen(true)
  }

  const handleDeleteClick = (tab: TaskTab) => {
    deleteTab(tab.id)
  }

  const handleModalClose = () => {
    setModalOpen(false)
    setEditingTab(null)
  }

  return (
    <>
      <nav className={cn('flex items-center -mb-px', className)}>
        {sortedTabs.map((tab) => (
          <TabItem
            key={tab.id}
            tab={tab}
            isActive={activeTabId === tab.id}
            onClick={() => setActiveTab(tab.id)}
            onEdit={() => handleEditClick(tab)}
            onDelete={() => handleDeleteClick(tab)}
          />
        ))}

        {/* Add tab button */}
        {canAddMore && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleAddClick}
            className="ml-1 h-8 px-2 text-muted-foreground hover:text-foreground"
            title={`Добавить вкладку (${tabsCount}/${MAX_USER_TABS})`}
          >
            <Plus className="h-4 w-4" />
          </Button>
        )}
      </nav>

      {/* Create/Edit Modal */}
      <TabModal
        open={modalOpen}
        onClose={handleModalClose}
        editingTab={editingTab}
      />
    </>
  )
}
