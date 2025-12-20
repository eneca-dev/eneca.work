'use client'

import { useState, useMemo } from 'react'
import { ChevronRight, MessageSquareText, Loader2, Plus, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'
import { format, parseISO, differenceInDays } from 'date-fns'
import { ru } from 'date-fns/locale'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ProjectReportModal } from '@/modules/modals'
import { useStageReports, useSaveStageReport, useDeleteStageReport } from '../hooks'
import type { ProjectReport } from '../types'
import type { DayCell } from '@/modules/resource-graph/components/timeline/TimelineHeader'
import type { TimelineRange } from '@/modules/resource-graph/types'
import { TimelineGrid } from '@/modules/resource-graph/components/timeline/TimelineRow'
import { SIDEBAR_WIDTH, DAY_CELL_WIDTH } from '@/modules/resource-graph/constants'
import { getInitials } from '../utils'

// ============================================================================
// Constants
// ============================================================================

const REPORT_ROW_HEIGHT = 28
const MAX_COMMENT_PREVIEW_LENGTH = 60

// ============================================================================
// Types
// ============================================================================

interface ProjectReportsRowProps {
  stageId: string
  projectName: string
  stageName: string
  dayCells: DayCell[]
  depth: number
  range: TimelineRange
}

// ============================================================================
// Component
// ============================================================================

/**
 * Строка отчетов проекта — разворачивается и показывает список отчетов
 * В строке "Отчеты" показываются маленькие точки на датах отчетов
 */
export function ProjectReportsRow({
  stageId,
  projectName,
  stageName,
  dayCells,
  depth,
  range,
}: ProjectReportsRowProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

  const timelineWidth = dayCells.length * DAY_CELL_WIDTH
  const totalWidth = SIDEBAR_WIDTH + timelineWidth

  // Data fetching
  const { data: reports, isLoading } = useStageReports(stageId, { enabled: true })
  const saveMutation = useSaveStageReport()
  const reportCount = reports?.length ?? 0

  // Рассчитываем позиции маркеров отчетов
  const reportMarkers = useMemo(() => {
    if (!reports || reports.length === 0) return []

    return reports
      .map((report) => {
        const reportDate = parseISO(report.createdAt)
        const dayIndex = differenceInDays(reportDate, range.start)

        // Пропускаем если вне диапазона
        if (dayIndex < 0 || dayIndex >= dayCells.length) return null

        return {
          report,
          x: dayIndex * DAY_CELL_WIDTH,
          dayIndex,
        }
      })
      .filter((m): m is NonNullable<typeof m> => m !== null)
  }, [reports, range.start, dayCells.length])

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
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            aria-expanded={isExpanded}
            aria-label={isExpanded ? 'Свернуть отчеты' : 'Развернуть отчеты'}
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
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setIsCreateModalOpen(true)
                  }}
                  aria-label="Создать отчет"
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

        {/* Timeline с маркерами отчетов */}
        <div className="relative" style={{ width: timelineWidth }}>
          <TimelineGrid dayCells={dayCells} />

          {/* Report markers - маленькие точки на датах отчетов */}
          {reportMarkers.length > 0 && (
            <TooltipProvider delayDuration={0}>
              <div className="absolute inset-0 pointer-events-none flex items-center">
                {/* Показываем ВСЕ точки */}
                {reportMarkers.map(({ report, x }) => (
                  <ReportDotMarker key={report.id} report={report} x={x} />
                ))}
              </div>
            </TooltipProvider>
          )}
        </div>
      </div>

      {/* Развёрнутый список отчетов */}
      {isExpanded && reports && reports.length > 0 && (
        <>
          {reports.map((report) => (
            <ProjectReportItemRow
              key={report.id}
              report={report}
              projectName={projectName}
              stageName={stageName}
              dayCells={dayCells}
              depth={depth + 1}
              timelineWidth={timelineWidth}
              totalWidth={totalWidth}
              range={range}
            />
          ))}
        </>
      )}

      {/* Модалка создания отчета */}
      <ProjectReportModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => setIsCreateModalOpen(false)}
        stageId={stageId}
        projectName={projectName}
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
// Report Dot Marker (маленькие точки в строке "Отчеты")
// ============================================================================

interface ReportDotMarkerProps {
  report: ProjectReport
  x: number
}

function ReportDotMarker({ report, x }: ReportDotMarkerProps) {
  // Инициалы автора
  const initials = getInitials(report.createdBy.firstName, report.createdBy.lastName)

  // Краткий комментарий
  const shortComment =
    report.comment.length > MAX_COMMENT_PREVIEW_LENGTH
      ? report.comment.substring(0, MAX_COMMENT_PREVIEW_LENGTH) + '...'
      : report.comment

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className="absolute pointer-events-auto cursor-default"
          style={{
            left: x + DAY_CELL_WIDTH / 2 - 3,
            top: '50%',
            transform: 'translateY(-50%)',
          }}
        >
          {/* Маленькая точка */}
          <div
            className="w-1.5 h-1.5 rounded-full bg-blue-500"
            style={{
              boxShadow: '0 0 3px rgba(59, 130, 246, 0.4)',
            }}
          />
        </div>
      </TooltipTrigger>

      <TooltipContent
        side="top"
        align="center"
        sideOffset={6}
        className="bg-zinc-900/95 backdrop-blur-xl border border-white/10 shadow-xl shadow-black/40 rounded-lg px-3 py-2.5 max-w-[200px]"
      >
        <div className="space-y-2">
          {/* Автор с аватаром */}
          <div className="flex items-center gap-2">
            <Avatar className="w-6 h-6">
              <AvatarImage src={report.createdBy.avatarUrl || undefined} />
              <AvatarFallback className="text-[9px] bg-zinc-700 text-white/80">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="text-sm font-medium text-white">
                {report.createdBy.name || 'Неизвестный автор'}
              </div>
              <div className="text-[10px] text-white/50">
                {format(parseISO(report.createdAt), 'd MMM yyyy, HH:mm', { locale: ru })}
              </div>
            </div>
          </div>

          {/* Метрики */}
          {(report.actualReadiness !== null || report.plannedReadiness !== null || report.budgetSpent !== null) && (
            <div className="flex items-center gap-1.5">
              {report.actualReadiness !== null && (
                <div className="flex items-center gap-0.5 px-1 py-0.5 rounded bg-blue-500/10 border border-blue-500/20">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  <span className="text-[9px] font-medium text-blue-500 tabular-nums">
                    {report.actualReadiness}%
                  </span>
                </div>
              )}

              {report.plannedReadiness !== null && (
                <div className="flex items-center gap-0.5 px-1 py-0.5 rounded bg-green-500/10 border border-green-500/20">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                  <span className="text-[9px] font-medium text-green-500 tabular-nums">
                    {report.plannedReadiness}%
                  </span>
                </div>
              )}

              {report.budgetSpent !== null && (
                <div className="flex items-center gap-0.5 px-1 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  <span className="text-[9px] font-medium text-amber-500 tabular-nums">
                    {report.budgetSpent}%
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Комментарий */}
          {shortComment && (
            <div className="pt-1 border-t border-white/10">
              <p className="text-[11px] text-white/60 leading-relaxed line-clamp-2">
                {shortComment}
              </p>
            </div>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  )
}

// ============================================================================
// Project Report Item Row (строка отдельного отчета в списке)
// ============================================================================

interface ProjectReportItemRowProps {
  report: ProjectReport
  projectName: string
  stageName: string
  dayCells: DayCell[]
  depth: number
  timelineWidth: number
  totalWidth: number
  range: TimelineRange
}

function ProjectReportItemRow({
  report,
  projectName,
  stageName,
  dayCells,
  depth,
  timelineWidth,
  totalWidth,
  range,
}: ProjectReportItemRowProps) {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const saveMutation = useSaveStageReport()
  const deleteMutation = useDeleteStageReport()

  // Краткий текст отчета
  const shortComment =
    report.comment.length > MAX_COMMENT_PREVIEW_LENGTH
      ? report.comment.substring(0, MAX_COMMENT_PREVIEW_LENGTH) + '...'
      : report.comment

  // Инициалы автора
  const initials = getInitials(report.createdBy.firstName, report.createdBy.lastName)

  // Рассчитываем позицию маркера на основе даты создания отчета
  const reportDate = parseISO(report.createdAt)
  const dayIndex = differenceInDays(reportDate, range.start)
  const markerX =
    dayIndex >= 0 && dayIndex < dayCells.length ? dayIndex * DAY_CELL_WIDTH : null

  return (
    <>
      <div
        className="flex border-b border-border/30 hover:bg-blue-500/5 transition-colors cursor-pointer"
        style={{ height: REPORT_ROW_HEIGHT, minWidth: totalWidth }}
        onClick={() => setIsEditModalOpen(true)}
      >
        {/* Sidebar - аватар, метки и дата */}
        <div
          className="flex items-center gap-1.5 shrink-0 border-r border-border px-2 sticky left-0 z-20 bg-background"
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
              {initials}
            </AvatarFallback>
          </Avatar>

          {/* Метки с показателями */}
          <div className="flex items-center gap-1">
            {report.actualReadiness !== null && (
              <TooltipProvider delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-0.5 px-1 py-0.5 rounded bg-blue-500/10 border border-blue-500/20">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                      <span className="text-[9px] font-medium text-blue-500 tabular-nums">
                        {report.actualReadiness}%
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    Фактическая готовность
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {report.plannedReadiness !== null && (
              <TooltipProvider delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-0.5 px-1 py-0.5 rounded bg-green-500/10 border border-green-500/20">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                      <span className="text-[9px] font-medium text-green-500 tabular-nums">
                        {report.plannedReadiness}%
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    Плановая готовность
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {report.budgetSpent !== null && (
              <TooltipProvider delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-0.5 px-1 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                      <span className="text-[9px] font-medium text-amber-500 tabular-nums">
                        {report.budgetSpent}%
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    Расход бюджета
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>

          {/* Иконка календаря и дата создания */}
          <div className="flex items-center gap-1">
            <Calendar className="w-3 h-3 text-muted-foreground/60" />
            <span className="text-[11px] text-muted-foreground font-medium">
              {format(parseISO(report.createdAt), 'dd.MM.yyyy', { locale: ru })}
            </span>
          </div>
        </div>

        {/* Timeline - с маркером и комментарием */}
        <div className="relative flex items-center" style={{ width: timelineWidth }}>
          <TimelineGrid dayCells={dayCells} />

          {/* Маркер даты создания отчета + комментарий */}
          {markerX !== null && (
            <div
              className="absolute inset-y-0 flex items-center gap-2 pointer-events-none"
              style={{ left: markerX + DAY_CELL_WIDTH / 2 - 3 }}
            >
              {/* Точка */}
              <div
                className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0"
                style={{
                  boxShadow: '0 0 3px rgba(59, 130, 246, 0.4)',
                }}
              />

              {/* Комментарий */}
              <span className="text-[10px] text-muted-foreground truncate">
                {shortComment}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      <ProjectReportModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSuccess={() => setIsEditModalOpen(false)}
        stageId={report.stageId}
        projectName={projectName}
        stageName={stageName}
        mode="edit"
        editData={{
          reportId: report.id,
          comment: report.comment,
          createdAt: report.createdAt,
          authorName: report.createdBy.name || 'Неизвестный автор',
          actualReadiness: report.actualReadiness,
          plannedReadiness: report.plannedReadiness,
          budgetSpent: report.budgetSpent,
        }}
        onSave={async (data) => {
          await saveMutation.mutateAsync({
            stageId: report.stageId,
            comment: data.comment,
            reportId: data.reportId,
          })
        }}
        onDelete={async () => {
          await deleteMutation.mutateAsync({
            reportId: report.id,
            stageId: report.stageId,
          })
        }}
      />
    </>
  )
}
