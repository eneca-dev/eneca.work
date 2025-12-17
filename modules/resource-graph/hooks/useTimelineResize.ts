'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { addDays, format, parseISO, differenceInDays } from 'date-fns'
import { DAY_CELL_WIDTH } from '../constants'
import type { TimelineRange } from '../types'

export type ResizeEdge = 'left' | 'right'

export interface UseTimelineResizeOptions {
  /** Начальная дата элемента */
  startDate: string
  /** Конечная дата элемента */
  endDate: string
  /** Диапазон timeline */
  range: TimelineRange
  /** Callback при завершении resize */
  onResize: (newStartDate: string, newEndDate: string) => void
  /** Минимальная длительность в днях (по умолчанию 1) */
  minDays?: number
  /** Отключить resize */
  disabled?: boolean
}

export interface UseTimelineResizeReturn {
  /** Обработчики для левого края */
  leftHandleProps: {
    onMouseDown: (e: React.MouseEvent) => void
    style: React.CSSProperties
  }
  /** Обработчики для правого края */
  rightHandleProps: {
    onMouseDown: (e: React.MouseEvent) => void
    style: React.CSSProperties
  }
  /** Идёт ли сейчас resize */
  isResizing: boolean
  /** Какой край тянут */
  resizingEdge: ResizeEdge | null
  /** Preview позиция во время resize (для визуального feedback) */
  previewPosition: { left: number; width: number } | null
  /** Preview даты во время resize */
  previewDates: { startDate: string; endDate: string } | null
}

/**
 * Хук для drag-to-resize элементов на timeline
 *
 * Позволяет тянуть левый или правый край элемента для изменения дат.
 * Автоматически привязывает к сетке дней (snap to grid).
 *
 * @example
 * ```tsx
 * const { leftHandleProps, rightHandleProps, isResizing, previewPosition } = useTimelineResize({
 *   startDate: '2024-01-01',
 *   endDate: '2024-01-10',
 *   range,
 *   onResize: (start, end) => updateDates(start, end),
 * })
 *
 * return (
 *   <div style={previewPosition ?? originalPosition}>
 *     <div {...leftHandleProps} />
 *     <div {...rightHandleProps} />
 *   </div>
 * )
 * ```
 */
export function useTimelineResize({
  startDate,
  endDate,
  range,
  onResize,
  minDays = 1,
  disabled = false,
}: UseTimelineResizeOptions): UseTimelineResizeReturn {
  const [isResizing, setIsResizing] = useState(false)
  const [resizingEdge, setResizingEdge] = useState<ResizeEdge | null>(null)
  const [previewDates, setPreviewDates] = useState<{ startDate: string; endDate: string } | null>(null)
  // Флаг: ждём обновления props после завершения resize
  const [waitingForUpdate, setWaitingForUpdate] = useState(false)
  // Сохраняем ожидаемые даты для сравнения
  const pendingDatesRef = useRef<{ startDate: string; endDate: string } | null>(null)

  // Refs для хранения состояния во время drag
  const initialMouseXRef = useRef(0)
  const initialStartDateRef = useRef<Date | null>(null)
  const initialEndDateRef = useRef<Date | null>(null)

  // Очищаем preview когда props обновились до ожидаемых значений
  useEffect(() => {
    if (waitingForUpdate && pendingDatesRef.current) {
      if (
        startDate === pendingDatesRef.current.startDate &&
        endDate === pendingDatesRef.current.endDate
      ) {
        // Props обновились — очищаем preview
        setPreviewDates(null)
        setWaitingForUpdate(false)
        pendingDatesRef.current = null
      }
    }
  }, [startDate, endDate, waitingForUpdate])

  // Fallback: очищаем preview через 3 секунды если props не обновились
  // (например, если мутация упала или сервер не ответил)
  useEffect(() => {
    if (!waitingForUpdate) return

    const timeout = setTimeout(() => {
      setPreviewDates(null)
      setWaitingForUpdate(false)
      pendingDatesRef.current = null
    }, 3000)

    return () => clearTimeout(timeout)
  }, [waitingForUpdate])

  /**
   * Конвертирует смещение в пикселях в количество дней (с привязкой к сетке)
   */
  const pixelsToDays = useCallback((pixels: number): number => {
    return Math.round(pixels / DAY_CELL_WIDTH)
  }, [])

  /**
   * Форматирует дату в ISO строку
   */
  const formatDate = useCallback((date: Date): string => {
    return format(date, 'yyyy-MM-dd')
  }, [])

  /**
   * Начало resize
   */
  const handleMouseDown = useCallback(
    (edge: ResizeEdge) => (e: React.MouseEvent) => {
      if (disabled) return

      e.preventDefault()
      e.stopPropagation()

      setIsResizing(true)
      setResizingEdge(edge)
      initialMouseXRef.current = e.clientX
      initialStartDateRef.current = parseISO(startDate)
      initialEndDateRef.current = parseISO(endDate)
      setPreviewDates({ startDate, endDate })
    },
    [disabled, startDate, endDate]
  )

  /**
   * Обработка движения мыши
   */
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizing || !resizingEdge) return
      if (!initialStartDateRef.current || !initialEndDateRef.current) return

      const deltaX = e.clientX - initialMouseXRef.current
      const deltaDays = pixelsToDays(deltaX)

      let newStartDate = initialStartDateRef.current
      let newEndDate = initialEndDateRef.current

      if (resizingEdge === 'left') {
        // Тянем левый край — меняем startDate
        newStartDate = addDays(initialStartDateRef.current, deltaDays)

        // Ограничение: start не может быть позже end - minDays
        const maxStartDate = addDays(newEndDate, -minDays + 1)
        if (newStartDate > maxStartDate) {
          newStartDate = maxStartDate
        }

        // Ограничение: не раньше начала timeline
        if (newStartDate < range.start) {
          newStartDate = range.start
        }
      } else {
        // Тянем правый край — меняем endDate
        newEndDate = addDays(initialEndDateRef.current, deltaDays)

        // Ограничение: end не может быть раньше start + minDays
        const minEndDate = addDays(newStartDate, minDays - 1)
        if (newEndDate < minEndDate) {
          newEndDate = minEndDate
        }

        // Ограничение: не позже конца timeline
        if (newEndDate > range.end) {
          newEndDate = range.end
        }
      }

      setPreviewDates({
        startDate: formatDate(newStartDate),
        endDate: formatDate(newEndDate),
      })
    },
    [isResizing, resizingEdge, range, minDays, pixelsToDays, formatDate]
  )

  /**
   * Завершение resize
   */
  const handleMouseUp = useCallback(() => {
    if (!isResizing || !previewDates) return

    const datesChanged = previewDates.startDate !== startDate || previewDates.endDate !== endDate

    // Вызываем callback только если даты изменились
    if (datesChanged) {
      // Сохраняем ожидаемые даты и ждём обновления props
      pendingDatesRef.current = { ...previewDates }
      setWaitingForUpdate(true)
      onResize(previewDates.startDate, previewDates.endDate)
    } else {
      // Даты не изменились — просто очищаем preview
      setPreviewDates(null)
    }

    setIsResizing(false)
    setResizingEdge(null)
    // НЕ очищаем previewDates здесь — это сделает useEffect когда props обновятся
    initialMouseXRef.current = 0
    initialStartDateRef.current = null
    initialEndDateRef.current = null
  }, [isResizing, previewDates, startDate, endDate, onResize])

  // Глобальные обработчики событий мыши
  useEffect(() => {
    if (!isResizing) return

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    // Добавляем класс к body для предотвращения выделения текста
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'ew-resize'

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
    }
  }, [isResizing, handleMouseMove, handleMouseUp])

  /**
   * Вычисляет preview позицию на основе preview дат
   */
  const previewPosition = previewDates
    ? (() => {
        const start = parseISO(previewDates.startDate)
        const end = parseISO(previewDates.endDate)

        const dayFromStart = differenceInDays(start, range.start)
        const duration = differenceInDays(end, start) + 1

        return {
          left: dayFromStart * DAY_CELL_WIDTH,
          width: duration * DAY_CELL_WIDTH,
        }
      })()
    : null

  // Стили для resize handles
  const handleStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 8,
    cursor: disabled ? 'default' : 'ew-resize',
    zIndex: 10,
  }

  return {
    leftHandleProps: {
      onMouseDown: handleMouseDown('left'),
      style: {
        ...handleStyle,
        left: -4,
      },
    },
    rightHandleProps: {
      onMouseDown: handleMouseDown('right'),
      style: {
        ...handleStyle,
        right: -4,
      },
    },
    isResizing,
    resizingEdge,
    previewPosition,
    previewDates,
  }
}
