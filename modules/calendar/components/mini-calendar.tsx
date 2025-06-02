"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { cn } from "@/lib/utils"

interface MiniCalendarProps {
  /** Диапазон выбранных дат */
  selectedRange: { from: Date | null; to: Date | null }
  /** Колбэк при клике по дате */
  onSelectDate: (date: Date) => void
  /** Режим выбора (single или range) */
  mode?: "single" | "range"
  /** Ширина календаря */
  width?: string
}

export const MiniCalendar: React.FC<MiniCalendarProps> = (props) => {
  const selectedRange = props.selectedRange
  const onSelectDate = props.onSelectDate
  const mode = props.mode || "range"
  const width = props.width || "650px"

  const today = new Date()
  const [currentMonth, setCurrentMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1))

  const handlePrev = (e: React.MouseEvent<HTMLButtonElement>) => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))
    e.currentTarget.blur()
  }
  
  const handleNext = (e: React.MouseEvent<HTMLButtonElement>) => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))
    e.currentTarget.blur()
  }

  const renderMonth = (date: Date) => {
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

    const from = selectedRange.from
    const to = selectedRange.to

    return (
      <div className="flex-1" key={`${year}-${month}`}>
        <div className="text-center font-bold mb-1.5 text-foreground">
          {date.toLocaleString("ru-RU", { month: "long", year: "numeric" })}
        </div>
        <div className="grid grid-cols-7 text-center">
          {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((d) => (
            <div 
              key={d}
              className="w-8 h-8 flex items-center justify-center rounded font-bold text-sm text-muted-foreground m-0.5"
            >
              {d}
            </div>
          ))}
          {weeks.flat().map((d, idx) => {
            if (!d) {
              return (
                <div 
                  key={idx} 
                  className="w-8 h-8 flex items-center justify-center rounded cursor-default m-0.5"
                />
              )
            }
            
            const time = d.getTime()
            const isFrom = from && time === from.getTime()
            const isTo = to && time === to.getTime()
            const isBetween = from && to && time > from.getTime() && time < to.getTime()

            return (
              <div 
                key={idx} 
                className={cn(
                  "w-8 h-8 flex items-center justify-center rounded-full cursor-pointer border border-transparent text-sm m-0.5 transition-colors hover:bg-accent/50",
                  "text-foreground",
                  (isFrom || isTo) && "bg-primary text-primary-foreground border-primary shadow-sm",
                  isBetween && "bg-primary/10 text-primary border-primary/20",
                )}
                onClick={() => onSelectDate(d)}
              >
                {d.getDate()}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div 
      className="font-sans bg-background border border-border rounded-lg p-2"
      style={{ width }}
    >
      <div className="flex justify-between mb-3">
        <button 
          className="cursor-pointer border-none bg-transparent text-lg text-foreground rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
          onClick={handlePrev}
        >
          &lt;
        </button>
        <button 
          className="cursor-pointer border-none bg-transparent text-lg text-foreground rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
          onClick={handleNext}
        >
          &gt;
        </button>
      </div>
      <div className="flex gap-6">
        {renderMonth(currentMonth)}
        {renderMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
      </div>
    </div>
  )
}

// Обёртка: выбор диапазона дат
interface DatePickerProps {
  /** Выбранный диапазон дат */
  value: { from: Date | null; to: Date | null }
  /** Колбэк при изменении выбранных дат */
  onChange: (range: { from: Date | null; to: Date | null }) => void
  /** Режим выбора (single или range) */
  mode?: "single" | "range"
  /** Плейсхолдер для инпута */
  placeholder?: string
  /** Ширина календаря */
  calendarWidth?: string
  /** Ширина поля ввода */
  inputWidth?: string
}

export const DatePicker: React.FC<DatePickerProps> = (props) => {
  const value = props.value
  const onChange = props.onChange
  const mode = props.mode || "range"
  const placeholder = props.placeholder || "Выберите дату"
  const calendarWidth = props.calendarWidth || "650px"
  const inputWidth = props.inputWidth || "100%"

  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleDateSelect = (d: Date) => {
    if (mode === "single") {
      onChange({ from: d, to: null })
      setOpen(false)
    } else {
      const from = value.from
      const to = value.to

      if (!from || (from && to)) {
        onChange({ from: d, to: null })
      } else if (from && !to) {
        if (d.getTime() < from.getTime()) {
          onChange({ from: d, to: from })
        } else {
          onChange({ from, to: d })
        }
        setOpen(false)
      }
    }
  }

  // Формат для инпута
  let inputValue = ""
  if (value.from && value.to) {
    inputValue = `${value.from.toLocaleDateString("ru-RU")} - ${value.to.toLocaleDateString("ru-RU")}`
  } else if (value.from) {
    inputValue = value.from.toLocaleDateString("ru-RU")
  }

  return (
    <div className="relative" ref={wrapperRef} style={{ width: inputWidth }}>
      <input
        readOnly
        value={inputValue}
        placeholder={placeholder}
        onClick={() => setOpen(!open)}
        className="w-full p-2 border border-border rounded bg-gray-50 dark:bg-gray-700 text-foreground cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-sm text-sm"
      />
      {open && (
        <div className="absolute top-full left-0 z-50 mt-1 shadow-lg rounded-lg bg-background border border-border">
          <MiniCalendar
            selectedRange={value}
            onSelectDate={handleDateSelect}
            mode={mode}
            width={calendarWidth}
          />
        </div>
      )}
    </div>
  )
}
