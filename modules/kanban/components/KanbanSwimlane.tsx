'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ChevronDown, ChevronRight, AlertTriangle, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { SectionModal } from '@/modules/modals'
import { queryKeys } from '@/modules/cache/keys/query-keys'
import type { Section } from '@/modules/resource-graph/types'
import type { KanbanSection, StageStatus } from '../types'
import { KANBAN_COLUMNS } from '../constants'
import { KanbanDropZone } from './KanbanDropZone'
import { useKanbanFiltersStore } from '../stores'

interface DraggedCard {
  stageId: string
  sectionId: string
}

interface KanbanSwimlaneProps {
  section: KanbanSection
  isCollapsed: boolean
  onToggleCollapse: () => void
  // HTML5 Drag and Drop
  draggedCard: DraggedCard | null
  onDragStart: (stageId: string, sectionId: string, e: React.DragEvent) => void
  onDragOver: (targetSectionId: string, e: React.DragEvent) => void
  onDrop: (targetSectionId: string, targetStatus: StageStatus, e: React.DragEvent) => void
  onDragEnd: () => void
}

// Circular progress component - упрощённый нейтральный стиль
function CircularProgress({ progress }: { progress: number }) {
  const radius = 16
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (progress / 100) * circumference

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg className="w-10 h-10 -rotate-90">
        {/* Background circle */}
        <circle
          cx="20"
          cy="20"
          r={radius}
          stroke="currentColor"
          strokeWidth="2.5"
          fill="none"
          className="text-border"
        />
        {/* Progress circle */}
        <circle
          cx="20"
          cy="20"
          r={radius}
          stroke="currentColor"
          strokeWidth="2.5"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="text-foreground/60 transition-all duration-500"
          strokeLinecap="round"
        />
      </svg>
      {/* Percentage text */}
      <span className="absolute text-[10px] font-medium text-muted-foreground">
        {progress}%
      </span>
    </div>
  )
}

export function KanbanSwimlane({
  section,
  isCollapsed,
  onToggleCollapse,
  draggedCard,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: KanbanSwimlaneProps) {
  // Локальное состояние для отслеживания наведения на этот swimlane
  const [isOver, setIsOver] = useState(false)
  const [isSectionModalOpen, setIsSectionModalOpen] = useState(false)
  const [modalInitialTab, setModalInitialTab] = useState<'overview' | 'tasks' | 'readiness'>('overview')

  // Для инвалидации кеша после успешного сохранения
  const queryClient = useQueryClient()
  const { getQueryParams } = useKanbanFiltersStore()

  // Проверяем, активен ли drag из другого раздела (для показа предупреждения)
  const isDragFromOtherSection = draggedCard !== null && draggedCard.sectionId !== section.id

  // Преобразуем KanbanSection в Section для модалки
  const getSectionForModal = (): Section => ({
    id: section.id,
    name: section.name,
    description: section.description || null,
    startDate: null, // Нет в KanbanSection
    endDate: null, // Нет в KanbanSection
    responsible: {
      id: section.responsible?.userId || null,
      firstName: section.responsible?.firstName || null,
      lastName: section.responsible?.lastName || null,
      name: null,
      avatarUrl: null,
    },
    status: {
      id: null, // Нет в KanbanSection (есть только строка)
      name: section.status,
      color: null,
    },
    readinessCheckpoints: [],
    actualReadiness: [],
    budgetSpending: [],
    decompositionStages: [], // SectionModal загрузит их через свои хуки
  })

  // Обработчики для отслеживания наведения на весь swimlane
  const handleDragEnter = (e: React.DragEvent) => {
    if (isDragFromOtherSection) {
      e.preventDefault()
      setIsOver(true)
    }
  }

  const handleDragLeave = (e: React.DragEvent) => {
    // Проверяем, что действительно покинули swimlane (не просто перешли на дочерний элемент)
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX
    const y = e.clientY

    if (x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom) {
      setIsOver(false)
    }
  }

  // Get initials for avatar
  const getInitials = () => {
    if (!section.responsible) return section.name.substring(0, 2).toUpperCase()
    const { firstName, lastName } = section.responsible
    return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase()
  }

  return (
    <div
      className={cn(
        'border-b border-border last:border-b-0',
        'transition-all duration-300 ease-out'
      )}
    >
      {/* Swimlane Header */}
      <div
        className={cn(
          'group',
          'flex items-center gap-3 px-4 py-3',
          'bg-background hover:bg-muted/30',
          'cursor-pointer select-none',
          'transition-colors duration-150'
        )}
        onClick={onToggleCollapse}
      >
        {/* Collapse Toggle */}
        <button
          className="flex-shrink-0 p-0.5 rounded hover:bg-muted transition-colors"
          onClick={(e) => {
            e.stopPropagation()
            onToggleCollapse()
          }}
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </button>

        {/* Avatar - нейтральный стиль */}
        <Avatar className="h-8 w-8 flex-shrink-0">
          <AvatarFallback className="bg-muted text-muted-foreground text-xs font-medium">
            {getInitials()}
          </AvatarFallback>
        </Avatar>

        {/* Section Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3
              className="font-medium text-sm text-foreground cursor-pointer hover:underline transition-colors"
              onClick={(e) => {
                e.stopPropagation()
                setModalInitialTab('overview')
                setIsSectionModalOpen(true)
              }}
            >
              {section.name}
            </h3>
            <span className="text-xs text-muted-foreground">
              {section.stages.length} этапов
            </span>

            {/* Кнопка быстрого добавления задачи */}
            <button
              className={cn(
                'flex-shrink-0 h-5 w-5 flex items-center justify-center rounded',
                'text-muted-foreground hover:text-foreground',
                'hover:bg-muted',
                'transition-all duration-150',
                'opacity-0 group-hover:opacity-100'
              )}
              onClick={(e) => {
                e.stopPropagation()
                setModalInitialTab('tasks')
                setIsSectionModalOpen(true)
              }}
              title="Добавить задачу"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="text-xs text-muted-foreground/70 truncate mt-0.5">
            {section.projectName} • {section.stageName} • {section.objectName}
          </p>
        </div>

        {/* Stats - Right side */}
        <div className="flex items-center gap-4 flex-shrink-0">
          {/* Hours */}
          <div className="text-right">
            <div className="text-[10px] text-muted-foreground/70">Факт/План</div>
            <div className="text-sm font-medium text-foreground">
              {section.totalActualHours}/{section.totalPlannedHours} ч
            </div>
          </div>

          {/* Circular Progress */}
          <CircularProgress progress={section.overallProgress} />
        </div>
      </div>

      {/* Swimlane Content */}
      <div
        className={cn(
          'overflow-hidden transition-all duration-300 ease-out',
          isCollapsed ? 'max-h-0' : 'max-h-[800px]'
        )}
      >
        <div
          className="relative"
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
        >
          <div className="flex items-stretch gap-0 min-h-[100px] p-2">
            {KANBAN_COLUMNS.map((column) => (
              <KanbanDropZone
                key={column.id}
                column={column}
                sectionId={section.id}
                stages={section.stages}
                section={section}
                draggedCard={draggedCard}
                onDragStart={onDragStart}
                onDragOver={onDragOver}
                onDrop={onDrop}
                onDragEnd={onDragEnd}
              />
            ))}
          </div>

          {/* Полоска-предупреждение при попытке переноса в другой раздел */}
          {isDragFromOtherSection && isOver && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-destructive/5 backdrop-blur-[2px]">
              <div className="bg-destructive/90 text-destructive-foreground px-6 py-3 rounded-lg shadow-lg border-2 border-destructive flex items-center gap-3 animate-in fade-in zoom-in-95 duration-200">
                <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                <span className="font-medium text-sm">
                  Нельзя переносить карточки этапов между разными разделами
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Section Modal */}
      <SectionModal
        isOpen={isSectionModalOpen}
        onClose={() => setIsSectionModalOpen(false)}
        onSuccess={() => {
          setIsSectionModalOpen(false)

          // Инвалидируем кеш канбана - данные перезагрузятся с сервера
          // Это обновит название, статус, ответственного и другие поля раздела
          queryClient.invalidateQueries({
            queryKey: queryKeys.kanban.infinite(getQueryParams())
          })
        }}
        section={getSectionForModal()}
        sectionId={section.id}
        initialTab={modalInitialTab}
      />
    </div>
  )
}
