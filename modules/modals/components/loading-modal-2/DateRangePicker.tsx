"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"
import { cn } from "@/lib/utils"

export type DateRange = { from: Date | null; to: Date | null }

interface DateRangePickerProps {
  value: DateRange | null
  onChange: (range: DateRange) => void
  placeholder?: string
  calendarWidth?: string
  inputWidth?: string
  inputClassName?: string
  renderToBody?: boolean
  hideSingleDateActions?: boolean
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  value,
  onChange,
  placeholder = "Выберите период",
  calendarWidth = "500px",
  inputWidth = "100%",
  inputClassName,
  renderToBody = true,
  hideSingleDateActions = false,
}) => {
  const [open, setOpen] = useState(false)
  const [openUpward, setOpenUpward] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [draggedBoundary, setDraggedBoundary] = useState<'from' | 'to' | null>(null)
  const [dragOverDate, setDragOverDate] = useState<Date | null>(null)
  const autoScrollIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)
  const [recalcKey, setRecalcKey] = useState(0)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      const inWrapper = wrapperRef.current?.contains(target)
      const inPopup = popupRef.current?.contains(target)
      if (!inWrapper && !inPopup) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  useEffect(() => {
    if (!open || !renderToBody) return
    const handler = () => setRecalcKey((k) => k + 1)
    window.addEventListener('scroll', handler, true)
    window.addEventListener('resize', handler)
    return () => {
      window.removeEventListener('scroll', handler, true)
      window.removeEventListener('resize', handler)
    }
  }, [open, renderToBody])

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

  // Очистка интервала при размонтировании
  useEffect(() => {
    return () => {
      if (autoScrollIntervalRef.current) {
        clearInterval(autoScrollIntervalRef.current)
      }
    }
  }, [])

  const handleInputClick = () => {
    if (!open && wrapperRef.current) {
      const rect = wrapperRef.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      const spaceAbove = rect.top
      const calendarHeight = 280
      setOpenUpward(spaceBelow < calendarHeight && spaceAbove > calendarHeight)
    }
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
    const from = value?.from ? new Date(value.from.getFullYear(), value.from.getMonth(), value.from.getDate()) : null
    const to = value?.to ? new Date(value.to.getFullYear(), value.to.getMonth(), value.to.getDate()) : null
    return { from, to }
  }, [value])

  const onSelectDate = (d: Date) => {
    const clicked = new Date(d.getFullYear(), d.getMonth(), d.getDate())

    // Первый клик — начинаем НОВЫЙ выбор (скрываем старый диапазон визуально)
    if (!selectedDate) {
      setSelectedDate(clicked)
      return
    }

    // Второй клик — автосохраняем полный диапазон и закрываем календарь
    const fromTime = Math.min(selectedDate.getTime(), clicked.getTime())
    const toTime = Math.max(selectedDate.getTime(), clicked.getTime())
    onChange({ from: new Date(fromTime), to: new Date(toTime) })
    setSelectedDate(null)
    setOpen(false)
  }

  const saveAsStartDate = () => {
    if (!selectedDate) return
    onChange({ from: selectedDate, to: null })
    setSelectedDate(null)
    setOpen(false)
  }

  const saveAsEndDate = () => {
    if (!selectedDate) return
    onChange({ from: null, to: selectedDate })
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
    // Останавливаем автопрокрутку при завершении drag
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
      // Проверяем, что новая начальная дата не позже конечной
      if (newTo && newDate.getTime() > newTo.getTime()) {
        // Можно поменять местами или просто отменить
        onChange({ from: newTo, to: newDate })
      } else {
        onChange({ from: newDate, to: newTo })
      }
    } else {
      // Перетаскиваем конечную дату
      const newFrom = normalizedRange.from
      // Проверяем, что новая конечная дата не раньше начальной
      if (newFrom && newDate.getTime() < newFrom.getTime()) {
        // Можно поменять местами или просто отменить
        onChange({ from: newDate, to: newFrom })
      } else {
        onChange({ from: newFrom, to: newDate })
      }
    }

    setDraggedBoundary(null)
    setDragOverDate(null)
    // Останавливаем автопрокрутку и закрываем календарь после применения диапазона
    if (autoScrollIntervalRef.current) {
      clearInterval(autoScrollIntervalRef.current)
      autoScrollIntervalRef.current = null
    }
    setOpen(false)
  }

  // Функции для автопрокрутки календаря при drag
  const startAutoScroll = (direction: 'prev' | 'next') => {
    // Запускаем автопрокрутку только если идет drag операция
    if (!draggedBoundary) {
      console.log('startAutoScroll: нет draggedBoundary')
      return
    }

    console.log(`startAutoScroll: запуск автопрокрутки ${direction}`)

    // Останавливаем предыдущий интервал если есть
    if (autoScrollIntervalRef.current) {
      clearInterval(autoScrollIntervalRef.current)
    }

    // Запускаем новый интервал (1 секунда = 1000ms)
    autoScrollIntervalRef.current = setInterval(() => {
      console.log(`Автопрокрутка: ${direction}`)
      if (direction === 'prev') {
        setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
      } else {
        setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
      }
    }, 1000)
  }

  const stopAutoScroll = () => {
    console.log('stopAutoScroll: остановка автопрокрутки')
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

    // Если выбран одиночный день, скрываем предыдущий диапазон визуально,
    // чтобы начать новый выбор с чистого состояния
    const from = selectedDate ? null : normalizedRange.from
    const to = selectedDate ? null : normalizedRange.to

    return (
      <div className="flex-1" key={`${year}-${month}`}>
        <div className="grid grid-cols-[28px_1fr_28px] items-center mb-1">
          {showNavigation === 'left' ? (
            <button
              className="cursor-pointer border-none bg-transparent text-sm text-foreground rounded p-1 hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors"
              onClick={handlePrev}
              onDragEnter={(e) => {
                console.log('DragEnter на левую стрелочку, draggedBoundary:', draggedBoundary)
                if (draggedBoundary) {
                  e.preventDefault()
                  startAutoScroll('prev')
                }
              }}
              onDragLeave={(e) => {
                console.log('DragLeave с левой стрелочки')
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
          <div className="text-center font-bold text-foreground text-sm">
            {date.toLocaleString("ru-RU", { month: "long", year: "numeric" })}
          </div>
          {showNavigation === 'right' ? (
            <button
              className="cursor-pointer border-none bg-transparent text-sm text-foreground rounded p-1 hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors"
              onClick={handleNext}
              onDragEnter={(e) => {
                console.log('DragEnter на правую стрелочку, draggedBoundary:', draggedBoundary)
                if (draggedBoundary) {
                  e.preventDefault()
                  startAutoScroll('next')
                }
              }}
              onDragLeave={(e) => {
                console.log('DragLeave с правой стрелочки')
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
          {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((d) => (
            <div key={d} className="w-6 h-6 flex items-center justify-center rounded font-bold text-xs text-muted-foreground m-0.5">
              {d}
            </div>
          ))}
          {weeks.flat().map((cellDate, idx) => {
            if (!cellDate) {
              return (
                <div key={idx} className="w-6 h-6 flex items-center justify-center rounded cursor-default m-0.5" />
              )
            }

            const currentDate = new Date(cellDate.getFullYear(), cellDate.getMonth(), cellDate.getDate())
            const isFrom = from && currentDate.getTime() === from.getTime()
            const isTo = to && currentDate.getTime() === to.getTime()
            const isBetween = from && to && currentDate.getTime() > from.getTime() && currentDate.getTime() < to.getTime()
            const isTempSelected = selectedDate && currentDate.getTime() === selectedDate.getTime()
            const isDragOver = dragOverDate && currentDate.getTime() === dragOverDate.getTime()
            const isDragging = draggedBoundary && ((isFrom && draggedBoundary === 'from') || (isTo && draggedBoundary === 'to'))

            return (
              <div
                key={idx}
                draggable={!!(isFrom || isTo)}
                className={cn(
                  "w-6 h-6 flex items-center justify-center rounded-full border border-transparent text-xs m-0.5 transition-all",
                  // Обычные состояния
                  "cursor-pointer hover:bg-accent/50",
                  // Активные даты
                  (isFrom || isTo) && "bg-primary text-primary-foreground border-primary shadow-sm",
                  // Диапазон между датами
                  isBetween && "bg-primary/10 text-primary border-primary/20",
                  // Временно выбранная дата
                  !from && !to && isTempSelected && "bg-accent/50",
                  // Drag and drop состояния
                  (isFrom || isTo) && "cursor-grab active:cursor-grabbing",
                  isDragging && "opacity-50 cursor-grabbing",
                  isDragOver && "ring-2 ring-primary ring-opacity-50 bg-primary/20",
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

  let inputValue = ""
  if (value && value.from && value.to) {
    inputValue = `${value.from.toLocaleDateString("ru-RU")} - ${value.to.toLocaleDateString("ru-RU")}`
  } else if (value && value.from) {
    inputValue = `${value.from.toLocaleDateString("ru-RU")} - …`
  } else if (value && value.to) {
    inputValue = `… - ${value.to.toLocaleDateString("ru-RU")}`
  }

  return (
    <div className="relative" ref={wrapperRef} style={{ width: inputWidth }}>
      <input
        readOnly
        value={inputValue}
        placeholder={placeholder}
        onClick={handleInputClick}
        className={cn(
          inputClassName
            ? "w-full cursor-pointer"
            : "w-full p-2 border border-border rounded bg-gray-50 dark:bg-slate-700 dark:border-slate-500 text-foreground cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-sm text-sm",
          inputClassName
        )}
      />
      {open && (!renderToBody ? (
        <div
          ref={popupRef}
          className="absolute left-0 z-50 shadow-lg rounded-lg bg-background border border-border dark:bg-slate-700 dark:border-slate-500"
          style={openUpward ? { bottom: '100%', marginBottom: '4px' } : { top: '100%', marginTop: '4px' }}
        >
          <div className="font-sans bg-background rounded-lg p-2 dark:bg-slate-700" style={{ width: calendarWidth }}>
            <div className="flex gap-4">
              {renderMonth(currentMonth, 'left')}
              {renderMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1), 'right')}
            </div>
            {selectedDate && !hideSingleDateActions && (
              <div className="flex gap-2 mt-3 pt-2 border-t border-border dark:border-slate-600">
                <button
                  onClick={saveAsStartDate}
                  className="flex-1 px-3 py-1.5 text-xs bg-gray-100 dark:bg-slate-600 text-foreground rounded hover:bg-gray-200 dark:hover:bg-slate-500 transition-colors"
                >
                  Сохранить как дату начала
                </button>
                <button
                  onClick={saveAsEndDate}
                  className="flex-1 px-3 py-1.5 text-xs bg-gray-100 dark:bg-slate-600 text-foreground rounded hover:bg-gray-200 dark:hover:bg-slate-500 transition-colors"
                >
                  Сохранить как дату окончания
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        (() => {
          if (typeof document === 'undefined' || !wrapperRef.current) return null
          const rect = wrapperRef.current.getBoundingClientRect()
          const calWidth = typeof calendarWidth === 'string' ? parseInt(calendarWidth) || 500 : 500
          const calendarHeight = 280
          let top = openUpward ? rect.top - calendarHeight - 4 : rect.bottom + 4
          // Центрируем относительно инпута
          let left = rect.left + rect.width / 2 - calWidth / 2
          // clamp horizontally
          const minX = 8
          const maxX = Math.max(minX, window.innerWidth - calWidth - 8)
          left = Math.min(maxX, Math.max(minX, left))

          const node = (
            <div
              key={recalcKey}
              ref={popupRef}
              className="fixed z-[2000] shadow-lg rounded-lg bg-background border border-border dark:bg-slate-700 dark:border-slate-500"
              style={{ left, top, width: calendarWidth as any, pointerEvents: 'auto' }}
            >
              <div className="font-sans bg-background rounded-lg p-2 dark:bg-slate-700" style={{ width: calendarWidth }}>
                <div className="flex gap-4">
                  {renderMonth(currentMonth, 'left')}
                  {renderMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1), 'right')}
                </div>
                {selectedDate && !hideSingleDateActions && (
                  <div className="flex gap-2 mt-3 pt-2 border-t border-border dark:border-slate-600">
                    <button
                      onClick={saveAsStartDate}
                      className="flex-1 px-3 py-1.5 text-xs bg-gray-100 dark:bg-slate-600 text-foreground rounded hover:bg-gray-200 dark:hover:bg-slate-500 transition-colors"
                    >
                      Сохранить как дату начала
                    </button>
                    <button
                      onClick={saveAsEndDate}
                      className="flex-1 px-3 py-1.5 text-xs bg-gray-100 dark:bg-slate-600 text-foreground rounded hover:bg-gray-200 dark:hover:bg-slate-500 transition-colors"
                    >
                      Сохранить как дату окончания
                    </button>
                  </div>
                )}
              </div>
            </div>
          )
          return (require('react-dom') as any).createPortal(node, document.body)
        })()
      ))}
    </div>
  )
}

// Временный алиас для обратной совместимости старых импортов
export const CleanDateRangePicker = DateRangePicker


