/**
 * DateRangePicker - Выбор диапазона дат с drag-and-drop
 *
 * Адаптированная версия из loading-modal-new:
 * - Два месяца рядом
 * - Выбор диапазона двумя кликами
 * - Перетаскивание граничных дат (from/to) для их изменения
 * - Автопрокрутка месяцев при drag на стрелки
 * - Интеграция с React Hook Form
 */

'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { Label } from '@/components/ui/label'

export type DateRange = { from: Date | null; to: Date | null }

interface DateRangePickerProps {
  startDate: string
  endDate: string
  onStartDateChange: (value: string) => void
  onEndDateChange: (value: string) => void
  startDateError?: string
  endDateError?: string
  disabled?: boolean
}

export function DateRangePicker({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  startDateError,
  endDateError,
  disabled,
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [draggedBoundary, setDraggedBoundary] = useState<'from' | 'to' | null>(null)
  const [dragOverDate, setDragOverDate] = useState<Date | null>(null)
  const autoScrollIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)

  // Convert string dates to DateRange
  const value = useMemo<DateRange>(() => {
    const from = startDate ? new Date(startDate) : null
    const to = endDate ? new Date(endDate) : null
    return { from, to }
  }, [startDate, endDate])

  // Handle date range change
  const onChange = (range: DateRange) => {
    if (range.from) {
      onStartDateChange(formatDate(range.from))
    }
    if (range.to) {
      onEndDateChange(formatDate(range.to))
    }
  }

  // Handle outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      const inWrapper = wrapperRef.current?.contains(target)
      const inPopup = popupRef.current?.contains(target)
      if (!inWrapper && !inPopup) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Reset selection state when closed
  useEffect(() => {
    if (!open) {
      setSelectedDate(null)
      setDraggedBoundary(null)
      setDragOverDate(null)
      // Очищаем автопрокрутку при закрытии календаря
      if (autoScrollIntervalRef.current) {
        clearInterval(autoScrollIntervalRef.current)
        autoScrollIntervalRef.current = null
      }
    }
  }, [open])

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (autoScrollIntervalRef.current) {
        clearInterval(autoScrollIntervalRef.current)
      }
    }
  }, [])

  const handleInputClick = () => {
    if (disabled) return
    setOpen(!open)
  }

  const [currentMonth, setCurrentMonth] = useState(() => {
    const today = new Date()
    return new Date(today.getFullYear(), today.getMonth(), 1)
  })

  const handlePrev = (e: React.MouseEvent<HTMLButtonElement>) => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))
    e.currentTarget.blur()
  }

  const handleNext = (e: React.MouseEvent<HTMLButtonElement>) => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))
    e.currentTarget.blur()
  }

  const normalizedRange = useMemo(() => {
    const from = value.from ? new Date(value.from.getFullYear(), value.from.getMonth(), value.from.getDate()) : null
    const to = value.to ? new Date(value.to.getFullYear(), value.to.getMonth(), value.to.getDate()) : null
    return { from, to }
  }, [value])

  const onSelectDate = (d: Date) => {
    const clicked = new Date(d.getFullYear(), d.getMonth(), d.getDate())

    // Первый клик — начинаем новый выбор
    if (!selectedDate) {
      setSelectedDate(clicked)
      return
    }

    // Второй клик — сохраняем диапазон и закрываем
    const fromTime = Math.min(selectedDate.getTime(), clicked.getTime())
    const toTime = Math.max(selectedDate.getTime(), clicked.getTime())

    onChange({ from: new Date(fromTime), to: new Date(toTime) })
    setSelectedDate(null)
    setOpen(false)
  }

  const saveAsStartDate = () => {
    if (!selectedDate) return
    onChange({ from: selectedDate, to: value.to })
    setSelectedDate(null)
    setOpen(false)
  }

  const saveAsEndDate = () => {
    if (!selectedDate) return
    onChange({ from: value.from, to: selectedDate })
    setSelectedDate(null)
    setOpen(false)
  }

  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, boundary: 'from' | 'to') => {
    setDraggedBoundary(boundary)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', boundary)
  }

  const handleDragEnd = () => {
    setDraggedBoundary(null)
    setDragOverDate(null)
    if (autoScrollIntervalRef.current) {
      clearInterval(autoScrollIntervalRef.current)
      autoScrollIntervalRef.current = null
    }
  }

  const handleDragOver = (e: React.DragEvent, date: Date) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverDate(date)
  }

  const handleDragLeave = () => {
    setDragOverDate(null)
  }

  const handleDrop = (e: React.DragEvent, targetDate: Date) => {
    e.preventDefault()

    if (!draggedBoundary || !normalizedRange) return

    const newDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate())

    if (draggedBoundary === 'from') {
      // Перетаскиваем начальную дату
      const newTo = normalizedRange.to
      if (newTo && newDate.getTime() > newTo.getTime()) {
        onChange({ from: newTo, to: newDate })
      } else {
        onChange({ from: newDate, to: newTo })
      }
    } else {
      // Перетаскиваем конечную дату
      const newFrom = normalizedRange.from
      if (newFrom && newDate.getTime() < newFrom.getTime()) {
        onChange({ from: newDate, to: newFrom })
      } else {
        onChange({ from: newFrom, to: newDate })
      }
    }

    setDraggedBoundary(null)
    setDragOverDate(null)
    if (autoScrollIntervalRef.current) {
      clearInterval(autoScrollIntervalRef.current)
      autoScrollIntervalRef.current = null
    }
    setOpen(false)
  }

  // Auto-scroll functions
  const startAutoScroll = (direction: 'prev' | 'next') => {
    if (!draggedBoundary) return

    if (autoScrollIntervalRef.current) {
      clearInterval(autoScrollIntervalRef.current)
    }

    autoScrollIntervalRef.current = setInterval(() => {
      if (direction === 'prev') {
        setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
      } else {
        setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
      }
    }, 1000)
  }

  const stopAutoScroll = () => {
    if (autoScrollIntervalRef.current) {
      clearInterval(autoScrollIntervalRef.current)
      autoScrollIntervalRef.current = null
    }
  }

  const renderMonth = (date: Date, showNavigation: 'left' | 'right' | 'none' = 'none') => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDayIndex = (new Date(year, month, 1).getDay() + 6) % 7
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const weeks: (Date | null)[][] = []
    let day = 1

    for (let w = 0; w < 6; w++) {
      const week: (Date | null)[] = []
      for (let d = 0; d < 7; d++) {
        if ((w === 0 && d < firstDayIndex) || day > daysInMonth) {
          week.push(null)
        } else {
          week.push(new Date(year, month, day++))
        }
      }
      weeks.push(week)
    }

    // Hide previous range visually when selecting new
    const from = selectedDate ? null : normalizedRange.from
    const to = selectedDate ? null : normalizedRange.to

    return (
      <div className="flex-1" key={`${year}-${month}`}>
        <div className="grid grid-cols-[28px_1fr_28px] items-center mb-1">
          {showNavigation === 'left' ? (
            <button
              type="button"
              className="cursor-pointer border-none bg-transparent text-sm text-foreground rounded p-1 hover:bg-muted transition-colors"
              onClick={handlePrev}
              onDragEnter={(e) => {
                if (draggedBoundary) {
                  e.preventDefault()
                  startAutoScroll('prev')
                }
              }}
              onDragLeave={(e) => {
                if (draggedBoundary) {
                  e.preventDefault()
                  stopAutoScroll()
                }
              }}
              onDragOver={(e) => {
                if (draggedBoundary) {
                  e.preventDefault()
                }
              }}
            >
              ←
            </button>
          ) : (
            <span className="w-[28px] h-[24px]" />
          )}
          <div className="text-center font-semibold text-foreground text-sm">
            {date.toLocaleString('ru-RU', { month: 'long', year: 'numeric' })}
          </div>
          {showNavigation === 'right' ? (
            <button
              type="button"
              className="cursor-pointer border-none bg-transparent text-sm text-foreground rounded p-1 hover:bg-muted transition-colors"
              onClick={handleNext}
              onDragEnter={(e) => {
                if (draggedBoundary) {
                  e.preventDefault()
                  startAutoScroll('next')
                }
              }}
              onDragLeave={(e) => {
                if (draggedBoundary) {
                  e.preventDefault()
                  stopAutoScroll()
                }
              }}
              onDragOver={(e) => {
                if (draggedBoundary) {
                  e.preventDefault()
                }
              }}
            >
              →
            </button>
          ) : (
            <span className="w-[28px] h-[24px]" />
          )}
        </div>
        <div className="grid grid-cols-7 text-center">
          {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((d) => (
            <div key={d} className="w-7 h-6 flex items-center justify-center font-semibold text-xs text-muted-foreground m-0.5">
              {d}
            </div>
          ))}
          {weeks.flat().map((cellDate, idx) => {
            if (!cellDate) {
              return <div key={idx} className="w-7 h-6 m-0.5" />
            }

            const currentDate = new Date(cellDate.getFullYear(), cellDate.getMonth(), cellDate.getDate())
            const isFrom = from && currentDate.getTime() === from.getTime()
            const isTo = to && currentDate.getTime() === to.getTime()
            const isBetween = from && to && currentDate.getTime() > from.getTime() && currentDate.getTime() < to.getTime()
            const isTempSelected = selectedDate && currentDate.getTime() === selectedDate.getTime()
            const isDragOver = dragOverDate && currentDate.getTime() === dragOverDate.getTime()
            const isDragging = draggedBoundary && ((isFrom && draggedBoundary === 'from') || (isTo && draggedBoundary === 'to'))
            const isToday = currentDate.toDateString() === new Date().toDateString()

            return (
              <div
                key={idx}
                draggable={!!(isFrom || isTo)}
                className={cn(
                  'w-7 h-7 flex items-center justify-center rounded-full border border-transparent text-xs m-0.5 transition-all',
                  'cursor-pointer hover:bg-accent/50',
                  // Active dates
                  (isFrom || isTo) && 'bg-primary text-primary-foreground border-primary shadow-sm cursor-grab active:cursor-grabbing',
                  // Range between dates
                  isBetween && 'bg-primary/10 text-primary border-primary/20',
                  // Temp selected
                  !from && !to && isTempSelected && 'bg-accent/50',
                  // Today
                  isToday && !isFrom && !isTo && !isBetween && 'border border-primary/50',
                  // Drag states
                  isDragging && 'opacity-50 cursor-grabbing',
                  isDragOver && 'ring-2 ring-primary ring-opacity-50 bg-primary/20'
                )}
                onClick={() => onSelectDate(cellDate)}
                onDragStart={(e) => {
                  if (isFrom) handleDragStart(e, 'from')
                  if (isTo) handleDragStart(e, 'to')
                }}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => handleDragOver(e, currentDate)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, currentDate)}
              >
                {cellDate.getDate()}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  let inputValue = ''
  if (value.from && value.to) {
    inputValue = `${formatDateDisplay(value.from)} — ${formatDateDisplay(value.to)}`
  } else if (value.from) {
    inputValue = `${formatDateDisplay(value.from)} — …`
  } else if (value.to) {
    inputValue = `… — ${formatDateDisplay(value.to)}`
  }

  const hasError = !!(startDateError || endDateError)

  return (
    <div className="space-y-2">
      <Label>Период *</Label>
      <div className="relative" ref={wrapperRef}>
        <input
          readOnly
          value={inputValue}
          placeholder="Выберите период"
          onClick={handleInputClick}
          disabled={disabled}
          aria-invalid={hasError}
          className={cn(
            'w-full px-3 py-2 border rounded-md bg-background text-foreground cursor-pointer',
            'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
            'placeholder:text-muted-foreground text-sm',
            'disabled:cursor-not-allowed disabled:opacity-50',
            hasError && 'border-destructive focus:ring-destructive'
          )}
        />
        {open && (
          <div
            ref={popupRef}
            className="absolute left-0 z-50 shadow-lg rounded-lg bg-background border border-border"
            style={{ bottom: '100%', marginBottom: '4px' }}
          >
            <div className="p-3" style={{ width: '540px' }}>
              <div className="flex gap-4">
                {renderMonth(currentMonth, 'left')}
                {renderMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1), 'right')}
              </div>
              {selectedDate && (
                <div className="flex gap-2 mt-3 pt-3 border-t border-border">
                  <button
                    type="button"
                    onClick={saveAsStartDate}
                    className="flex-1 px-3 py-1.5 text-xs bg-muted text-foreground rounded hover:bg-muted/80 transition-colors"
                  >
                    Сохранить как дату начала
                  </button>
                  <button
                    type="button"
                    onClick={saveAsEndDate}
                    className="flex-1 px-3 py-1.5 text-xs bg-muted text-foreground rounded hover:bg-muted/80 transition-colors"
                  >
                    Сохранить как дату окончания
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      {(startDateError || endDateError) && (
        <p className="text-xs text-destructive flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-full bg-destructive/20 flex items-center justify-center text-[10px]">!</span>
          {startDateError || endDateError}
        </p>
      )}
    </div>
  )
}

// Helper functions
function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatDateDisplay(date: Date): string {
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
