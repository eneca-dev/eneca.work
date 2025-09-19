"use client"

import React, { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"

interface DatePickerProps {
  value: Date | null
  onChange: (date: Date) => void
  placeholder?: string
  calendarWidth?: string
  inputWidth?: string
  placement?: 'auto' | 'bottom' | 'right' | 'left' | 'top' | 'auto-top'
  offsetY?: number
  offsetX?: number
  inputClassName?: string
  renderToBody?: boolean
  autoOpen?: boolean
  variant?: 'default' | 'minimal'
}

export const DatePicker: React.FC<DatePickerProps> = ({
  value,
  onChange,
  placeholder = "Выберите дату",
  calendarWidth = "260px",
  inputWidth = "100%",
  placement = 'auto',
  offsetY = 0,
  offsetX = 8,
  inputClassName,
  renderToBody = true,
  autoOpen = false,
  variant = 'default',
}) => {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState<string>(value ? value.toLocaleDateString("ru-RU") : "")
  const [openUpward, setOpenUpward] = useState(false)
  const [openPlacement, setOpenPlacement] = useState<'bottom' | 'right' | 'left' | 'top'>('bottom')
  const [alignRight, setAlignRight] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)
  const [recalcKey, setRecalcKey] = useState(0)
  const [popupHeight, setPopupHeight] = useState<number | null>(null)

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

  const handleInputClick = () => {
    if (!open && wrapperRef.current) {
      const rect = wrapperRef.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      const spaceAbove = rect.top
      const calendarHeight = 280
      const calWidth = typeof calendarWidth === 'string' ? parseInt(calendarWidth) || 260 : 260
      const spaceRight = window.innerWidth - rect.right
      const spaceLeft = rect.left

      // reset align
      setAlignRight(false)

      if (placement === 'left') {
        setOpenPlacement('left')
      } else if (placement === 'right') {
        setOpenPlacement('right')
      } else if (placement === 'top') {
        setOpenPlacement('top')
        // horizontal alignment to keep calendar inside viewport
        setAlignRight(spaceRight < calWidth && spaceLeft > calWidth - rect.width)
      } else if (placement === 'auto') {
        if (spaceRight > calWidth + offsetX + 8) {
          setOpenPlacement('right')
        } else if (spaceLeft > calWidth + offsetX + 8) {
          setOpenPlacement('left')
        } else if (spaceBelow >= calendarHeight || spaceBelow >= spaceAbove) {
          setOpenPlacement('bottom')
          setOpenUpward(false)
          setAlignRight(spaceRight < calWidth && spaceLeft > calWidth - rect.width)
        } else {
          setOpenPlacement('top')
          setAlignRight(spaceRight < calWidth && spaceLeft > calWidth - rect.width)
        }
      } else if (placement === 'auto-top') {
        // Стратегия: сначала top, затем right/left, затем bottom
        if (spaceAbove > calendarHeight) {
          setOpenPlacement('top')
          setAlignRight(spaceRight < calWidth && spaceLeft > calWidth - rect.width)
        } else if (spaceRight > calWidth + offsetX + 8) {
          setOpenPlacement('right')
        } else if (spaceLeft > calWidth + offsetX + 8) {
          setOpenPlacement('left')
        } else {
          setOpenPlacement('bottom')
          setOpenUpward(false)
          setAlignRight(spaceRight < calWidth && spaceLeft > calWidth - rect.width)
        }
      } else {
        // explicit bottom
        setOpenPlacement('bottom')
        setOpenUpward(false)
        setAlignRight(spaceRight < calWidth && spaceLeft > calWidth - rect.width)
      }
    }
    setOpen(!open)
  }

  useEffect(() => {
    setText(value ? value.toLocaleDateString("ru-RU") : "")
  }, [value])

  // Пересчёт позиции попапа при скролле/ресайзе (для режима renderToBody)
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

  // Измеряем высоту попапа после открытия, чтобы позиционировать точно рядом с инпутом
  useEffect(() => {
    if (!open || !renderToBody) return
    const t = setTimeout(() => {
      setPopupHeight(popupRef.current ? popupRef.current.offsetHeight : null)
    }, 0)
    return () => clearTimeout(t)
  }, [open, renderToBody, recalcKey])

  // Авто-открытие при монтировании (для сценария мгновенного редактирования)
  useEffect(() => {
    if (autoOpen) setOpen(true)
  }, [autoOpen])

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
    e.preventDefault()
    e.stopPropagation()
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))
    // Не закрывать попап, просто убираем фокус с кнопки
    e.currentTarget.blur()
  }

  const handleNext = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    e.stopPropagation()
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
          // Не применять изменение при открытом календаре (например, при навигации стрелками)
          if (open) return
          const dt = parseTextDate(text)
          if (dt) {
            onChange(dt)
          } else {
            setText(value ? value.toLocaleDateString("ru-RU") : "")
          }
        }}
        className={cn(
          variant === 'minimal'
            ? "w-full px-2.5 py-1.5 border-0 bg-transparent outline-none focus:outline-none focus:ring-0 focus:border-0 text-[12px]"
            : "w-full px-2.5 py-1.5 border border-slate-300 dark:border-slate-700 rounded-md dark:bg-slate-800 dark:text-white placeholder:text-sm text-sm",
          inputClassName
        )}
      />
      {open && (!renderToBody ? (
        <div
          ref={popupRef}
          className="absolute z-50 shadow-lg rounded-lg bg-background border border-border dark:bg-slate-700 dark:border-slate-500"
          style={
            openPlacement === 'right'
              ? { left: '100%', top: offsetY, marginLeft: `${offsetX}px`, position: 'absolute' as const }
              : openPlacement === 'left'
                ? { right: '100%', top: offsetY, marginRight: `${offsetX}px`, position: 'absolute' as const }
                : openPlacement === 'top'
                  ? (alignRight
                      ? { right: 0, bottom: '100%', marginBottom: '4px', position: 'absolute' as const }
                      : { left: 0, bottom: '100%', marginBottom: '4px', position: 'absolute' as const })
                  : (alignRight
                      ? { right: 0, top: `calc(100% + ${offsetY}px)`, marginTop: '4px', position: 'absolute' as const }
                      : { left: 0, top: `calc(100% + ${offsetY}px)`, marginTop: '4px', position: 'absolute' as const })
          }
        >
          <div className="font-sans bg-background rounded-lg p-2 dark:bg-slate-700" style={{ width: calendarWidth }}>
            <div className="flex items-center justify-between mb-1">
              <button className="cursor-pointer border-none bg-transparent text-sm text-foreground rounded p-1 hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors" onClick={handlePrev}>←</button>
              <div className="text-center font-bold text-foreground text-sm px-2 flex-1">{currentMonth.toLocaleString("ru-RU", { month: "long", year: "numeric" })}</div>
              <button className="cursor-pointer border-none bg-transparent text-sm text-foreground rounded p-1 hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors" onClick={handleNext}>→</button>
            </div>
            {renderMonth(currentMonth)}
          </div>
        </div>
      ) : (
        (() => {
          if (typeof document === 'undefined' || !wrapperRef.current) return null
          // прочитываем DOMRect каждый рендер (дёшево, пока попап открыт)
          const rect = wrapperRef.current.getBoundingClientRect()
          const calWidth = typeof calendarWidth === 'string' ? parseInt(calendarWidth) || 260 : 260
          const calendarHeight = popupHeight ?? 280
          let top = 0
          let left = 0
          if (openPlacement === 'right') {
            left = rect.right + offsetX
            top = rect.top + offsetY
          } else if (openPlacement === 'left') {
            left = rect.left - calWidth - offsetX
            top = rect.top + offsetY
          } else if (openPlacement === 'top') {
            left = alignRight ? rect.right - calWidth : rect.left
            top = rect.top - calendarHeight - (offsetY || 4)
          } else {
            left = alignRight ? rect.right - calWidth : rect.left
            top = rect.bottom + offsetY
          }
          const minX = 8
          const maxX = Math.max(minX, window.innerWidth - calWidth - 8)
          left = Math.min(maxX, Math.max(minX, left))

          const node = (
            <div
              key={recalcKey}
              ref={popupRef}
              className="fixed z-[1000] shadow-lg rounded-lg bg-background border border-border dark:bg-slate-700 dark:border-slate-500"
              style={{ left, top, width: calendarWidth as any }}
            >
              <div className="font-sans bg-background rounded-lg p-2 dark:bg-slate-700" style={{ width: calendarWidth }}>
                <div className="flex items-center justify-between mb-1">
                  <button className="cursor-pointer border-none bg-transparent text-sm text-foreground rounded p-1 hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors" onClick={handlePrev}>←</button>
                  <div className="text-center font-bold text-foreground text-sm px-2 flex-1">{currentMonth.toLocaleString("ru-RU", { month: "long", year: "numeric" })}</div>
                  <button className="cursor-pointer border-none bg-transparent text-sm text-foreground rounded p-1 hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors" onClick={handleNext}>→</button>
                </div>
                {renderMonth(currentMonth)}
              </div>
            </div>
          )
          return (require('react-dom') as any).createPortal(node, document.body)
        })()
      ))}
    </div>
  )
}
