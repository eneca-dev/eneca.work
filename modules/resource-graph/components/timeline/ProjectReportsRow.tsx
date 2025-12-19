'use client'

import { useState } from 'react'
import { ChevronRight, MessageSquareText, Loader2, Plus, Trash2, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { StageReportModal } from '../reports/StageReportModal'
import { useStageReports, useSaveStageReport, useDeleteStageReport } from '../../hooks'
import type { ProjectReport } from '../../types'
import type { DayCell } from './TimelineHeader'
import type { TimelineRange } from '../../types'
import { TimelineGrid } from './TimelineRow'
import { calculateBarPosition } from './TimelineBar'
import { SIDEBAR_WIDTH, DAY_CELL_WIDTH } from '../../constants'
import { formatDistanceToNow, differenceInDays, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'

// ============================================================================
// Constants
// ============================================================================

const REPORT_ROW_HEIGHT = 28

// ============================================================================
// Types
// ============================================================================

interface ProjectReportsRowProps {
  stageId: string
  stageName: string
  dayCells: DayCell[]
  depth: number
  range: TimelineRange
  /** Дата начала стадии для позиционирования (опционально) */
  stageStartDate?: string | null
  /** Дата окончания стадии для позиционирования (опционально) */
  stageEndDate?: string | null
}

// ============================================================================
// Component
// ============================================================================

/**
 * Строка отчетов проекта — свёрнутая по умолчанию
 * При развороте показывает список отчетов с маркерами в timeline
 */
export function ProjectReportsRow({
  stageId,
  stageName,
  dayCells,
  depth,
  range,
  stageStartDate,
  stageEndDate,
}: ProjectReportsRowProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

  const timelineWidth = dayCells.length * DAY_CELL_WIDTH
  const totalWidth = SIDEBAR_WIDTH + timelineWidth

  // Data fetching
  const { data: reports, isLoading } = useStageReports(stageId, { enabled: true })
  const saveMutation = useSaveStageReport()
  const reportCount = reports?.length ?? 0

  return (
    <>
      {/* Заголовок строки отчетов */}
      <div
        className="flex border-b border-border/50 hover:bg-muted/30 transition-colors"
        style={{ height: REPORT_ROW_HEIGHT, minWidth: totalWidth }}
      >
        {/* Sidebar */}
        <div
          className="flex items-center gap-1.5 shrink-0 border-r border-border px-2 sticky left-0 z-20 bg-background"
          style={{
            width: SIDEBAR_WIDTH,
            paddingLeft: 8 + depth * 16,
          }}
        >
          {/* Expand/Collapse */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-0.5 hover:bg-muted rounded transition-colors shrink-0"
          >
            <ChevronRight
              className={cn(
                'w-3 h-3 text-muted-foreground transition-transform',
                isExpanded && 'rotate-90'
              )}
            />
          </button>

          {/* Icon */}
          <MessageSquareText className="w-3.5 h-3.5 text-blue-500 shrink-0" />

          {/* Label */}
          <span className="text-[11px] text-muted-foreground font-medium shrink-0">
            Отчеты
          </span>

          {/* Loading */}
          {isLoading && (
            <Loader2 className="w-3 h-3 text-muted-foreground animate-spin ml-auto" />
          )}

          {/* Count */}
          {!isLoading && reportCount > 0 && (
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-[10px] font-medium ml-auto tabular-nums shrink-0 text-blue-500">
                    {reportCount}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  Всего отчетов: {reportCount}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {!isLoading && reportCount === 0 && (
            <span className="text-[10px] text-muted-foreground/50 ml-auto shrink-0">
              нет
            </span>
          )}

          {/* Add report button */}
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setIsCreateModalOpen(true)
                  }}
                  className={cn(
                    'p-0.5 rounded transition-all shrink-0',
                    'hover:bg-blue-500/10 hover:text-blue-500',
                    'text-muted-foreground/50',
                    reportCount === 0 ? 'ml-1' : 'ml-2'
                  )}
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                Создать отчет
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Timeline - пустая область для маркеров */}
        <div className="relative" style={{ width: timelineWidth }}>
          <TimelineGrid dayCells={dayCells} />
        </div>
      </div>

      {/* Развёрнутый список отчетов */}
      {isExpanded && reports && reports.length > 0 && (
        <>
          {reports.map((report) => (
            <ProjectReportItemRow
              key={report.id}
              report={report}
              stageName={stageName}
              dayCells={dayCells}
              depth={depth + 1}
              timelineWidth={timelineWidth}
              totalWidth={totalWidth}
              range={range}
              stageStartDate={stageStartDate}
              stageEndDate={stageEndDate}
            />
          ))}
        </>
      )}

      {/* Модалка создания отчета */}
      <StageReportModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => setIsCreateModalOpen(false)}
        stageId={stageId}
        stageName={stageName}
        mode="create"
        onSave={async (data) => {
          await saveMutation.mutateAsync({
            stageId,
            comment: data.comment,
          })
        }}
      />
    </>
  )
}

// ============================================================================
// Project Report Item Row
// ============================================================================

interface ProjectReportItemRowProps {
  report: ProjectReport
  stageName: string
  dayCells: DayCell[]
  depth: number
  timelineWidth: number
  totalWidth: number
  range: TimelineRange
  stageStartDate?: string | null
  stageEndDate?: string | null
}

function ProjectReportItemRow({
  report,
  stageName,
  dayCells,
  depth,
  timelineWidth,
  totalWidth,
  range,
  stageStartDate,
  stageEndDate,
}: ProjectReportItemRowProps) {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const deleteMutation = useDeleteStageReport()
  const saveMutation = useSaveStageReport()

  const handleDelete = () => {
    deleteMutation.mutate(
      { reportId: report.id, stageId: report.stageId },
      {
        onSuccess: () => {
          setIsDeleteDialogOpen(false)
        },
      }
    )
  }

  // Рассчитываем позицию маркера на основе даты создания отчета
  const markerPosition = calculateReportMarkerPosition(
    report.createdAt,
    range,
    dayCells.length
  )

  // Краткий текст отчета (первые 120 символов)
  const shortComment = report.comment.length > 120
    ? report.comment.substring(0, 120) + '...'
    : report.comment

  // Инициалы автора
  const getInitials = () => {
    const first = report.createdBy.firstName?.[0] || ''
    const last = report.createdBy.lastName?.[0] || ''
    return (first + last).toUpperCase() || '?'
  }

  // Относительное время
  const relativeTime = formatDistanceToNow(parseISO(report.createdAt), {
    addSuffix: true,
    locale: ru,
  })

  return (
    <>
      <div
        className="group flex border-b border-border/30 hover:bg-blue-500/5 transition-colors cursor-pointer"
        style={{ height: REPORT_ROW_HEIGHT, minWidth: totalWidth }}
        onClick={() => setIsEditModalOpen(true)}
      >
        {/* Sidebar - минимальная информация */}
        <div
          className="flex items-center gap-1.5 shrink-0 border-r border-border px-2 sticky left-0 z-20 bg-background group-hover:bg-blue-500/5"
          style={{
            width: SIDEBAR_WIDTH,
            paddingLeft: 8 + depth * 16,
          }}
        >
          {/* Spacer */}
          <div className="w-4 shrink-0" />

          {/* Avatar */}
          <Avatar className="w-5 h-5 shrink-0 border border-border">
            <AvatarImage src={report.createdBy.avatarUrl || undefined} />
            <AvatarFallback className="bg-blue-500/10 text-blue-600 text-[8px] font-semibold">
              {getInitials()}
            </AvatarFallback>
          </Avatar>

          {/* Author name */}
          <span className="text-[10px] text-muted-foreground truncate flex-1 min-w-0">
            {report.createdBy.name || 'Неизвестный автор'}
          </span>

          {/* Delete button */}
          <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <AlertDialogTrigger asChild>
                    <button
                      className={cn(
                        'p-0.5 rounded transition-all shrink-0',
                        'text-muted-foreground/40 hover:text-red-500 hover:bg-red-500/10',
                        'opacity-0 group-hover:opacity-100'
                      )}
                      onClick={(e) => {
                        e.stopPropagation()
                      }}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </AlertDialogTrigger>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  Удалить отчет
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <AlertDialogContent className="max-w-sm">
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2 text-base">
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                  Удалить отчет?
                </AlertDialogTitle>
                <AlertDialogDescription className="text-sm">
                  Отчет будет удален безвозвратно.
                  <br />
                  <span className="text-amber-600 dark:text-amber-400">
                    Это действие нельзя отменить.
                  </span>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="text-xs h-8">Отмена</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  disabled={deleteMutation.isPending}
                  className="bg-red-500 hover:bg-red-600 text-xs h-8"
                >
                  {deleteMutation.isPending ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin mr-1" />
                      Удаление...
                    </>
                  ) : (
                    'Удалить'
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        {/* Timeline - маркер и текст отчета */}
        <div className="relative" style={{ width: timelineWidth }}>
          <TimelineGrid dayCells={dayCells} />

          {/* Report marker with text */}
          {markerPosition !== null && (
            <div
              className="absolute inset-y-0 flex items-center pointer-events-auto"
              style={{
                left: markerPosition,
              }}
            >
              {/* Dot in center */}
              <div
                className="w-2 h-2 rounded-full bg-blue-500 ring-2 ring-blue-500/30 shrink-0 z-10"
                style={{
                  boxShadow: '0 0 6px rgba(59, 130, 246, 0.5)',
                }}
              />

              {/* Text block to the right */}
              <div className="ml-2 flex items-center gap-2 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-800 shadow-sm max-w-md">
                <MessageSquareText className="w-3 h-3 text-blue-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-slate-700 dark:text-slate-200 line-clamp-1">
                    {shortComment}
                  </p>
                </div>
                <TooltipProvider delayDuration={300}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-[9px] text-slate-400 dark:text-slate-500 tabular-nums shrink-0">
                        {relativeTime}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">
                      {new Date(report.createdAt).toLocaleString('ru-RU')}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      <StageReportModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSuccess={() => setIsEditModalOpen(false)}
        stageId={report.stageId}
        stageName={stageName}
        mode="edit"
        editData={{
          reportId: report.id,
          comment: report.comment,
          createdAt: report.createdAt,
          authorName: report.createdBy.name || 'Неизвестный автор',
        }}
        onSave={async (data) => {
          await saveMutation.mutateAsync({
            stageId: report.stageId,
            comment: data.comment,
            reportId: data.reportId,
          })
        }}
      />
    </>
  )
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Рассчитывает позицию маркера отчета в timeline
 * @param createdAt - Дата создания отчета
 * @param range - Видимый диапазон timeline
 * @param totalDays - Количество дней в timeline
 * @returns Позиция в пикселях от левого края или null если вне диапазона
 */
function calculateReportMarkerPosition(
  createdAt: string,
  range: TimelineRange,
  totalDays: number
): number | null {
  const reportDate = parseISO(createdAt)
  const daysDiff = differenceInDays(reportDate, range.start)

  // Если отчет вне видимого диапазона, не показываем маркер
  if (daysDiff < 0 || daysDiff >= totalDays) {
    return null
  }

  // Позиция: центр дня
  return daysDiff * DAY_CELL_WIDTH + DAY_CELL_WIDTH / 2
}
