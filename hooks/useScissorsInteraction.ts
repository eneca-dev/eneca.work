'use client'

import { useCallback, useState } from 'react'
import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns'

interface UseScissorsInteractionOptions {
  /** ID загрузки */
  loadingId: string
  /** Дата начала загрузки (YYYY-MM-DD) */
  startDate: string
  /** Дата окончания загрузки (YYYY-MM-DD) */
  endDate: string
  /** Ширина одной ячейки дня в пикселях */
  dayCellWidth: number
  /** Активен ли режим ножниц */
  isActive: boolean
  /** Callback при разрезании */
  onSplit: (loadingId: string, splitDate: string) => void
}

interface UseScissorsInteractionReturn {
  /** Позиция линии разреза (px от левого края бара), null если не показывать */
  cutLinePosition: number | null
  /** Допустимая ли позиция для разреза */
  isValidCut: boolean
  /** Обработчики событий для бара */
  handlers: {
    onMouseMove: (e: React.MouseEvent) => void
    onMouseLeave: () => void
    onClick: (e: React.MouseEvent) => void
  }
}

/**
 * Хук для взаимодействия "ножниц" с баром загрузки на таймлайне.
 *
 * Вычисляет позицию разреза из координат мыши, привязывает к сетке дней,
 * валидирует (splitDate строго между start и end), и вызывает onSplit при клике.
 */
export function useScissorsInteraction({
  loadingId,
  startDate,
  endDate,
  dayCellWidth,
  isActive,
  onSplit,
}: UseScissorsInteractionOptions): UseScissorsInteractionReturn {
  const [cutLinePosition, setCutLinePosition] = useState<number | null>(null)
  const [isValidCut, setIsValidCut] = useState(false)

  const totalDays = differenceInCalendarDays(parseISO(endDate), parseISO(startDate)) + 1

  const getCut = useCallback((e: React.MouseEvent) => {
    const relativeX = e.clientX - e.currentTarget.getBoundingClientRect().left
    const dayOffset = Math.floor(relativeX / dayCellWidth)
    return {
      position: dayOffset * dayCellWidth,
      date: dayOffset >= 1 && dayOffset < totalDays
        ? format(addDays(parseISO(startDate), dayOffset), 'yyyy-MM-dd') : null,
    }
  }, [dayCellWidth, startDate, totalDays])

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isActive) return

      const cut = getCut(e)
      setCutLinePosition(cut.position)
      setIsValidCut(cut.date !== null)
    },
    [isActive, getCut]
  )

  const handleMouseLeave = useCallback(() => {
    setCutLinePosition(null)
    setIsValidCut(false)
  }, [])

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!isActive) return
      // A remounted bar may receive a click before its first mousemove.
      // Use the actual click coordinates rather than a previous hover position.
      const cut = getCut(e)
      if (!cut.date) return

      e.stopPropagation()
      e.preventDefault()
      onSplit(loadingId, cut.date)

      // Сброс после клика
      setCutLinePosition(null)
      setIsValidCut(false)
    },
    [isActive, loadingId, onSplit, getCut]
  )

  if (!isActive) {
    return {
      cutLinePosition: null,
      isValidCut: false,
      handlers: {
        onMouseMove: () => {},
        onMouseLeave: () => {},
        onClick: () => {},
      },
    }
  }

  return {
    cutLinePosition,
    isValidCut,
    handlers: {
      onMouseMove: handleMouseMove,
      onMouseLeave: handleMouseLeave,
      onClick: handleClick,
    },
  }
}
