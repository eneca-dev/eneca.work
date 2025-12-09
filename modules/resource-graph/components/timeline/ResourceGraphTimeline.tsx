'use client'

import { useMemo, useRef } from 'react'
import { addDays, startOfDay } from 'date-fns'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Project, TimelineRange } from '../../types'
import { TimelineHeader, generateDayCells } from './TimelineHeader'
import { ProjectRow } from './TimelineRow'
import { SIDEBAR_WIDTH } from '../../constants'

// Конфигурация timeline
const DAYS_BEFORE_TODAY = 7 // Неделя до сегодня
const DAYS_AFTER_TODAY = 45 // ~1.5 месяца после
const TOTAL_DAYS = DAYS_BEFORE_TODAY + DAYS_AFTER_TODAY

/**
 * Вычисляет диапазон timeline
 */
function calculateTimelineRange(): TimelineRange {
  const today = startOfDay(new Date())
  const start = addDays(today, -DAYS_BEFORE_TODAY)
  const end = addDays(today, DAYS_AFTER_TODAY - 1)

  return {
    start,
    end,
    totalDays: TOTAL_DAYS,
  }
}

interface ResourceGraphTimelineProps {
  projects: Project[]
  isLoading?: boolean
  className?: string
}

/**
 * Главный компонент графика ресурсов с timeline
 *
 * Отображает иерархическую структуру проектов с временной шкалой:
 * - Project → Stage → Object → Section → DecompositionStage
 * - Бары для Section и DecompositionStage (у них есть даты)
 */
export function ResourceGraphTimeline({
  projects,
  isLoading,
  className,
}: ResourceGraphTimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  // Вычисляем диапазон timeline
  const range = useMemo(() => calculateTimelineRange(), [])

  // Генерируем ячейки дней
  const dayCells = useMemo(() => generateDayCells(range), [range])

  if (isLoading) {
    return (
      <div className={cn('flex items-center justify-center h-96', className)}>
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (projects.length === 0) {
    return (
      <div className={cn('flex items-center justify-center h-96 text-muted-foreground', className)}>
        Нет данных для отображения
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className={cn('flex flex-col border border-border rounded-lg overflow-hidden bg-background', className)}
    >
      {/* Header area */}
      <div className="flex border-b border-border">
        {/* Sidebar header */}
        <div
          className="shrink-0 flex items-center px-3 py-2 border-r border-border bg-muted/30"
          style={{ width: SIDEBAR_WIDTH }}
        >
          <span className="text-sm font-medium text-muted-foreground">Структура</span>
        </div>

        {/* Timeline header */}
        <div className="flex-1 overflow-hidden">
          <TimelineHeader dayCells={dayCells} />
        </div>
      </div>

      {/* Content area - scrollable */}
      <div className="flex-1 overflow-auto">
        {projects.map((project) => (
          <ProjectRow
            key={project.id}
            project={project}
            dayCells={dayCells}
            range={range}
          />
        ))}
      </div>
    </div>
  )
}
