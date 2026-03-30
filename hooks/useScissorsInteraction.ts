'use client'

import { useCallback, useRef, useState } from 'react'
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
  const splitDateRef = useRef<string | null>(null)

  const totalDays = differenceInCalendarDays(parseISO(endDate), parseISO(startDate)) + 1

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isActive) return

      const rect = e.currentTarget.getBoundingClientRect()
      const relativeX = e.clientX - rect.left

      // Вычисляем смещение в днях от начала бара
      const dayOffset = Math.floor(relativeX / dayCellWidth)

      // splitDate = startDate + dayOffset (это дата начала ВТОРОЙ части)
      const splitDate = format(addDays(parseISO(startDate), dayOffset), 'yyyy-MM-dd')

      // Валидация: splitDate должна быть строго внутри диапазона
      // (не на первый день — иначе первая часть будет пустой,
      //  и не позже последнего дня — иначе вторая часть будет пустой)
      const valid = dayOffset >= 1 && dayOffset < totalDays

      // Позиция линии — привязана к границе дня
      const linePos = dayOffset * dayCellWidth

      setCutLinePosition(linePos)
      setIsValidCut(valid)
      splitDateRef.current = valid ? splitDate : null
    },
    [isActive, dayCellWidth, startDate, totalDays]
  )

  const handleMouseLeave = useCallback(() => {
    setCutLinePosition(null)
    setIsValidCut(false)
    splitDateRef.current = null
  }, [])

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!isActive || !splitDateRef.current) return

      e.stopPropagation()
      e.preventDefault()
      onSplit(loadingId, splitDateRef.current)

      // Сброс после клика
      setCutLinePosition(null)
      setIsValidCut(false)
      splitDateRef.current = null
    },
    [isActive, loadingId, onSplit]
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
