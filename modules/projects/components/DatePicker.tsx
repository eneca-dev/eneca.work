"use client"

import React, { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"

interface DatePickerProps {
  value: Date | null
  onChange: (date: Date) => void
  placeholder?: string
  calendarWidth?: string
  inputWidth?: string
  placement?: 'auto' | 'bottom' | 'right'
  offsetY?: number
  inputClassName?: string
}

export const DatePicker: React.FC<DatePickerProps> = ({
  value,
  onChange,
  placeholder = "Выберите дату",
  calendarWidth = "260px",
  inputWidth = "100%",
  placement = 'auto',
  offsetY = 0,
  inputClassName,
}) => {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState<string>(value ? value.toLocaleDateString("ru-RU") : "")
  const [openUpward, setOpenUpward] = useState(false)
  const [openPlacement, setOpenPlacement] = useState<'bottom' | 'right'>('bottom')
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

  const handleInputClick = () => {
    if (!open && wrapperRef.current) {
      const rect = wrapperRef.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      const spaceAbove = rect.top
      const calendarHeight = 280
      const calWidth = typeof calendarWidth === 'string' ? parseInt(calendarWidth) || 260 : 260
      const spaceRight = window.innerWidth - rect.right

      if (placement === 'right' || (placement === 'auto' && spaceRight > calWidth + 16)) {
        setOpenPlacement('right')
      } else {
        setOpenPlacement('bottom')
        setOpenUpward(spaceBelow < calendarHeight && spaceAbove > calendarHeight)
      }
    }
    setOpen(!open)
  }

  useEffect(() => {
    setText(value ? value.toLocaleDateString("ru-RU") : "")
  }, [value])

  const parseTextDate = (val: string): Date | null => {
    const trimmed = val.trim()
    // DD.MM.YYYY
    const m1 = trimmed.match(/^([0-3]?\d)\.([01]?\d)\.(\d{4})$/)
    if (m1) {
      const d = Number(m1[1]), m = Number(m1[2]) - 1, y = Number(m1[3])
      const dt = new Date(y, m, d)
      if (dt.getFullYear() === y && dt.getMonth() === m && dt.getDate() === d) return dt
      return null
    }
    // YYYY-MM-DD
    const m2 = trimmed.match(/^(\d{4})-([01]?\d)-([0-3]?\d)$/)
    if (m2) {
      const y = Number(m2[1]), m = Number(m2[2]) - 1, d = Number(m2[3])
      const dt = new Date(y, m, d)
      if (dt.getFullYear() === y && dt.getMonth() === m && dt.getDate() === d) return dt
      return null
    }
    return null
  }

  const [currentMonth, setCurrentMonth] = useState(() => {
    if (value) {
      return new Date(value.getFullYear(), value.getMonth(), 1)
    }
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

  const onSelectDate = (d: Date) => {
    const clicked = new Date(d.getFullYear(), d.getMonth(), d.getDate())
    onChange(clicked)
    setOpen(false)
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

    return (
      <div className="w-full" key={`${year}-${month}`}>
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
            const isSelected = value && currentDate.getTime() === new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime()

            return (
              <div
                key={idx}
                className={cn(
                  "w-6 h-6 flex items-center justify-center rounded-full cursor-pointer border border-transparent text-xs m-0.5 transition-colors hover:bg-accent/50",
                  isSelected && "bg-primary text-primary-foreground border-primary shadow-sm",
                )}
                onClick={() => onSelectDate(cellDate)}
              >
                {cellDate.getDate()}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="relative" ref={wrapperRef} style={{ width: inputWidth }}>
      <input
        value={text}
        placeholder={placeholder}
        onClick={handleInputClick}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          const dt = parseTextDate(text)
          if (dt) {
            onChange(dt)
          } else {
            setText(value ? value.toLocaleDateString("ru-RU") : "")
          }
        }}
        className={cn(
          "w-full px-2.5 py-1.5 border border-slate-300 dark:border-slate-700 rounded-md dark:bg-slate-800 dark:text-white placeholder:text-sm text-sm",
          inputClassName
        )}
      />
      {open && (
        <div
          className="absolute z-50 shadow-lg rounded-lg bg-background border border-border dark:bg-slate-700 dark:border-slate-500"
          style={
            openPlacement === 'right'
              ? { left: '100%', top: offsetY, marginLeft: '8px', position: 'absolute' as const }
              : (openUpward 
                  ? { left: 0, bottom: '100%', marginBottom: '4px', position: 'absolute' as const } 
                  : { left: 0, top: `calc(100% + ${offsetY}px)`, marginTop: '4px', position: 'absolute' as const })
          }
        >
          <div className="font-sans bg-background rounded-lg p-2 dark:bg-slate-700" style={{ width: calendarWidth }}>
            <div className="flex items-center justify-between mb-1">
              <button
                className="cursor-pointer border-none bg-transparent text-sm text-foreground rounded p-1 hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors"
                onClick={handlePrev}
              >
                ←
              </button>
              <div className="text-center font-bold text-foreground text-sm px-2 flex-1">
                {currentMonth.toLocaleString("ru-RU", { month: "long", year: "numeric" })}
              </div>
              <button
                className="cursor-pointer border-none bg-transparent text-sm text-foreground rounded p-1 hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors"
                onClick={handleNext}
              >
                →
              </button>
            </div>
            {renderMonth(currentMonth)}
          </div>
        </div>
      )}
    </div>
  )
}
