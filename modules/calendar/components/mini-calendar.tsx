"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"

// Стили ч/б минимализм (вынесены за пределы компонента)
const styles: { [key: string]: React.CSSProperties } = {
  container: {
    fontFamily: "sans-serif",
    background: "#fff",
    border: "1px solid #374151",
    borderRadius: "8px",
    padding: "8px",
  },
  controls: { display: "flex", justifyContent: "space-between", marginBottom: "12px" },
  arrowButton: {
    cursor: "pointer",
    border: "none",
    background: "none",
    fontSize: "18px",
    color: "#374151",
    borderRadius: "4px",
    padding: "4px",
  },
  months: { display: "flex", gap: "24px" },
  month: { flex: 1 },
  monthHeader: { textAlign: "center", fontWeight: "bold", marginBottom: "6px", color: "#374151" },
  grid: { display: "grid", gridTemplateColumns: "repeat(7, 1fr)", textAlign: "center" },
  dayCell: {
    width: "32px",
    height: "32px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    borderRadius: "50%",
    userSelect: "none",
    border: "1px solid transparent",
    color: "#374151",
    fontSize: "14px",
    margin: "2px",
  },
  selected: {
    backgroundColor: "#15803d",
    color: "#fff",
    border: "1px solid #15803d",
  },
  inRange: {
    backgroundColor: "#dcfce7",
    color: "#15803d",
    borderRadius: "50%",
  },
  empty: { cursor: "default", background: "transparent" },
  // Pre-created style combinations to avoid Object.assign in render loop
  dayCellInRange: {
    width: "32px",
    height: "32px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    borderRadius: "50%",
    userSelect: "none",
    border: "1px solid transparent",
    fontSize: "14px",
    margin: "2px",
    backgroundColor: "#dcfce7",
    color: "#15803d",
  },
  dayCellSelected: {
    width: "32px",
    height: "32px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    borderRadius: "50%",
    userSelect: "none",
    fontSize: "14px",
    margin: "2px",
    backgroundColor: "#15803d",
    color: "#fff",
    border: "1px solid #15803d",
  },
}

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
  // Explicitly destructure props to avoid complex patterns
  const selectedRange = props.selectedRange
  const onSelectDate = props.onSelectDate
  const mode = props.mode || "range"
  const width = props.width || "650px"

  const today = new Date()
  const [currentMonth, setCurrentMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1))

  const handlePrev = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))
  const handleNext = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))

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

    // Explicitly access from and to from selectedRange
    const from = selectedRange.from
    const to = selectedRange.to

    return (
      <div style={styles.month} key={`${year}-${month}`}>
        <div style={styles.monthHeader}>{date.toLocaleString("ru-RU", { month: "long", year: "numeric" })}</div>
        <div style={styles.grid}>
          {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((d) => (
            <div style={{ ...styles.dayCell, borderRadius: "4px", fontWeight: "bold" }} key={d}>
              {d}
            </div>
          ))}
          {weeks.flat().map((d, idx) => {
            if (!d) return <div key={idx} style={{ ...styles.dayCell, ...styles.empty }} />
            const time = d.getTime()
            const isFrom = from && time === from.getTime()
            const isTo = to && time === to.getTime()
            const isBetween = from && to && time > from.getTime() && time < to.getTime()

            // Use pre-created style references instead of creating new objects
            let cellStyle: React.CSSProperties
            if (isFrom || isTo) {
              cellStyle = styles.dayCellSelected
            } else if (isBetween) {
              cellStyle = styles.dayCellInRange
            } else {
              cellStyle = styles.dayCell
            }

            return (
              <div key={idx} style={cellStyle} onClick={() => onSelectDate(d)}>
                {d.getDate()}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div style={{ ...styles.container, width }}>
      <div style={styles.controls}>
        <button style={styles.arrowButton} onClick={handlePrev}>
          &lt;
        </button>
        <button style={styles.arrowButton} onClick={handleNext}>
          &gt;
        </button>
      </div>
      <div style={styles.months}>
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
  // Explicitly destructure props to avoid complex patterns
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
      // В режиме single всегда выбираем только одну дату
      onChange({ from: d, to: null })
      setOpen(false)
    } else {
      // В режиме range выбираем диапазон
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
    <div style={{ position: "relative", display: "inline-block" }} ref={wrapperRef}>
      <input
        type="text"
        value={inputValue}
        readOnly
        onClick={() => setOpen(!open)}
        placeholder={placeholder}
        style={{
          width: inputWidth,
          padding: "6px 8px",
          borderRadius: "4px",
          border: "1px solid #374151",
          cursor: "pointer",
          fontSize: "14px",
          fontFamily: "sans-serif",
        }}
      />
      {open && (
        <div style={{ position: "absolute", top: "100%", left: 0, zIndex: 1000, marginTop: "4px" }}>
          <MiniCalendar selectedRange={value} onSelectDate={handleDateSelect} mode={mode} width={calendarWidth} />
        </div>
      )}
    </div>
  )
}
