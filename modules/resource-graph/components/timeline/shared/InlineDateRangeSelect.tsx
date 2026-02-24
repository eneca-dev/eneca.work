'use client'

/**
 * InlineDateRangeSelect - Компактный инлайн-селект диапазона дат
 *
 * Показывает даты если они установлены, или кнопку "Разместить"
 * для разделов без дат.
 *
 * Поведение:
 * - Если даты есть: отображает их (клик - открывает модалку раздела через onOpenModal)
 * - Если дат нет: кнопка "Разместить" автоматически устанавливает today → today+10
 * - Optimistic update: даты показываются мгновенно, откат при ошибке
 */

import { useState, useCallback, useEffect } from 'react'
import { addDays } from 'date-fns'
import { Calendar, MapPin, Loader2 } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import { formatDateShort } from '../../../utils'
import { formatMinskDate, getTodayMinsk } from '@/lib/timezone-utils'
import { useUpdateSection } from '@/modules/modals/hooks/useUpdateSection'
import { createReadinessCheckpoint } from '@/modules/modals/actions/readinessCheckpoints'
import { queryKeys } from '@/modules/cache'

// ============================================================================
// Types
// ============================================================================

/** Оптимистичная контрольная точка плана */
export interface OptimisticCheckpoint {
  date: string
  value: number
}

interface InlineDateRangeSelectProps {
  sectionId: string
  startDate: string | null
  endDate: string | null
  onSuccess?: () => void
  /** Открыть модалку раздела (для редактирования дат) */
  onOpenModal?: () => void
  /** Callback при оптимистичном размещении (для обновления рамки периода) */
  onOptimisticPlace?: (startDate: string, endDate: string) => void
  /** Callback при ошибке (для отката) */
  onOptimisticRollback?: () => void
  /** Callback для оптимистичного плана (контрольные точки 0% и 100%) */
  onOptimisticPlan?: (checkpoints: OptimisticCheckpoint[]) => void
}

// ============================================================================
// Component
// ============================================================================

export function InlineDateRangeSelect({
  sectionId,
  startDate,
  endDate,
  onSuccess,
  onOpenModal,
  onOptimisticPlace,
  onOptimisticRollback,
  onOptimisticPlan,
}: InlineDateRangeSelectProps) {
  const updateMutation = useUpdateSection()
  const queryClient = useQueryClient()
  const isSaving = updateMutation.isPending

  // Оптимистичные даты (показываются мгновенно при "Разместить")
  const [optimisticDates, setOptimisticDates] = useState<{
    start: string
    end: string
  } | null>(null)

  // Сбрасываем optimistic state когда приходят реальные данные
  useEffect(() => {
    if (startDate && endDate) {
      setOptimisticDates(null)
    }
  }, [startDate, endDate])

  // Эффективные даты для отображения (optimistic или реальные)
  const displayStartDate = optimisticDates?.start ?? startDate
  const displayEndDate = optimisticDates?.end ?? endDate
  const hasDates = displayStartDate && displayEndDate

  /**
   * Автоматическое размещение раздела: today → today + 10 дней
   * С оптимистичным обновлением UI
   */
  const handleQuickPlace = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation()

    const today = getTodayMinsk()
    const newStartDate = formatMinskDate(today)
    const newEndDate = formatMinskDate(addDays(today, 10))

    // Оптимистичное обновление - показываем даты и план сразу
    setOptimisticDates({ start: newStartDate, end: newEndDate })
    onOptimisticPlace?.(newStartDate, newEndDate)
    onOptimisticPlan?.([
      { date: newStartDate, value: 0 },
      { date: newEndDate, value: 100 },
    ])

    try {
      await updateMutation.mutateAsync({
        sectionId,
        data: {
          startDate: newStartDate,
          endDate: newEndDate,
        },
      })

      // Автоматически создаём контрольные точки плана (0% на первый день, 100% на последний)
      // Ждём завершения и инвалидируем кеш
      try {
        await Promise.all([
          createReadinessCheckpoint({
            sectionId,
            date: newStartDate,
            plannedReadiness: 0,
          }),
          createReadinessCheckpoint({
            sectionId,
            date: newEndDate,
            plannedReadiness: 100,
          }),
        ])
        // Инвалидируем кеш resource graph для обновления плана
        queryClient.invalidateQueries({
          queryKey: queryKeys.resourceGraph.lists(),
        })
      } catch (err) {
        // Ошибка создания чекпоинтов не критична - логируем и продолжаем
        console.warn('[InlineDateRangeSelect] Failed to create plan checkpoints:', err)
      }

      onSuccess?.()
    } catch (error) {
      console.error('[InlineDateRangeSelect] Quick place error:', error)
      // Откат оптимистичного обновления при ошибке
      setOptimisticDates(null)
      onOptimisticRollback?.()
    }
  }, [sectionId, updateMutation, onSuccess, onOptimisticPlace, onOptimisticRollback, onOptimisticPlan, queryClient])

  /**
   * Клик по датам - открыть модалку раздела для редактирования
   */
  const handleDatesClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onOpenModal?.()
  }, [onOpenModal])

  return (
    <div className="relative">
      {hasDates ? (
        // Показать даты - клик открывает модалку
        <button
          type="button"
          onClick={handleDatesClick}
          disabled={isSaving}
          className={cn(
            'text-[11px] text-muted-foreground flex items-center gap-1 shrink-0',
            'hover:text-foreground transition-colors',
            isSaving && 'opacity-50'
          )}
        >
          {isSaving ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Calendar className="w-3 h-3" />
          )}
          {formatDateShort(displayStartDate)} — {formatDateShort(displayEndDate)}
        </button>
      ) : (
        // Кнопка "Разместить" - мгновенное сохранение дат
        <button
          type="button"
          onClick={handleQuickPlace}
          disabled={isSaving}
          className={cn(
            'text-[10px] px-2 py-0.5 rounded',
            'bg-amber-500/10 text-amber-500 hover:bg-amber-500/20',
            'flex items-center gap-1 transition-colors',
            isSaving && 'opacity-50 cursor-wait'
          )}
        >
          {isSaving ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <MapPin className="w-3 h-3" />
          )}
          Разместить
        </button>
      )}
    </div>
  )
}
