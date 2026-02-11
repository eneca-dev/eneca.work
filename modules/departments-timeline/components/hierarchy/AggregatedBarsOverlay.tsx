/**
 * AggregatedBarsOverlay — вертикальные мини-бары (гистограмма) на строках иерархии
 *
 * Стиль «эквалайзер»: полупрозрачные столбики снизу вверх.
 *   Высота = % загрузки (X / Y)
 *   Цвет зависит от уровня: зелёный → жёлтый → оранжевый → красный
 *   При перегрузе (>100%) — красный бар + линия отсечки
 *
 * На уровне ObjectSection — клик по ячейке открывает inline-редактор ёмкости (Y).
 */

'use client'

import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { DAY_CELL_WIDTH } from '../../constants'
import { formatMinskDate } from '@/lib/timezone-utils'
import { getCellDayType } from '../../utils'
import { computeDailyAggregation } from '../../utils/aggregate-bars'
import { useDepartmentsTimelineUIStore } from '../../stores'
import type { DailyAggregation } from '../../utils/aggregate-bars'
import type { DeptEmployeeLeaf } from '../../types/hierarchy'
import type { DayCell } from '../../types'

// ============================================================================
// Constants
// ============================================================================

const EMPTY_OVERRIDES: Record<string, number> = {}
const BAR_WIDTH = 24
const CELL_PADDING_BOTTOM = 3
const TEXT_AREA_HEIGHT = 13

// ============================================================================
// Color logic
// ============================================================================

interface BarStyle {
  bg: string
  textColor: string
  glow?: string
}

function getBarStyle(percentage: number): BarStyle {
  if (percentage > 100) return {
    bg: 'rgba(239, 68, 68, 0.7)',
    textColor: 'rgba(248, 113, 113, 0.95)',
    glow: '0 0 8px rgba(239, 68, 68, 0.35)',
  }
  if (percentage >= 85) return {
    bg: 'rgba(249, 115, 22, 0.65)',
    textColor: 'rgba(251, 146, 60, 0.9)',
  }
  if (percentage >= 60) return {
    bg: 'rgba(234, 179, 8, 0.55)',
    textColor: 'rgba(250, 204, 21, 0.85)',
  }
  if (percentage >= 30) return {
    bg: 'rgba(16, 185, 129, 0.5)',
    textColor: 'rgba(52, 211, 153, 0.8)',
  }
  return {
    bg: 'rgba(16, 185, 129, 0.35)',
    textColor: 'rgba(52, 211, 153, 0.7)',
  }
}

// ============================================================================
// Public component
// ============================================================================

interface AggregatedBarsOverlayProps {
  employees: DeptEmployeeLeaf[]
  /** Базовая ёмкость (из данных ObjectSection) */
  defaultCapacity: number
  /** Per-date переопределения ёмкости (dateStr → capacity) */
  dateCapacityOverrides?: Record<string, number>
  dayCells: DayCell[]
  rowHeight: number
  /** Включить inline-редактирование ёмкости (только для ObjectSection) */
  editable?: boolean
  /** ID ObjectSection для сохранения ёмкости в store */
  osId?: string
}

/** Format rate for display: 2.25 → "2.25", 1 → "1", 0.5 → "0.5" */
function formatRate(rate: number): string {
  return Number(rate.toFixed(2)).toString()
}

export function AggregatedBarsOverlay({
  employees,
  defaultCapacity,
  dateCapacityOverrides = EMPTY_OVERRIDES,
  dayCells,
  rowHeight,
  editable = false,
  osId,
}: AggregatedBarsOverlayProps) {
  const [editIndex, setEditIndex] = useState<number | null>(null)
  const [editValue, setEditValue] = useState('')
  const setCapacity = useDepartmentsTimelineUIStore((s) => s.setCapacity)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editIndex !== null && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editIndex])

  const handleCellClick = useCallback((index: number) => {
    if (!editable || !osId) return
    // Pre-fill with the specific date's capacity (override or default)
    const dateStr = formatMinskDate(dayCells[index].date)
    const currentCapacity = dateCapacityOverrides[dateStr] ?? defaultCapacity
    setEditValue(String(currentCapacity))
    setEditIndex(index)
  }, [editable, osId, defaultCapacity, dateCapacityOverrides, dayCells])

  const handleSave = useCallback(() => {
    if (osId && editIndex !== null && editValue) {
      const parsed = parseFloat(editValue)
      if (!isNaN(parsed) && parsed > 0 && parsed <= 99) {
        const dateStr = formatMinskDate(dayCells[editIndex].date)
        setCapacity(osId, dateStr, parsed)
      }
    }
    setEditIndex(null)
  }, [osId, editIndex, editValue, setCapacity, dayCells])

  const dailyData = useMemo(
    () => computeDailyAggregation(employees, defaultCapacity, dateCapacityOverrides, dayCells),
    [employees, defaultCapacity, dateCapacityOverrides, dayCells]
  )

  return (
    <>
      {dailyData.map((day, i) => {
        if (day.rateSum === 0) return null

        const cell = dayCells[i]
        const { isWeekend, isSpecialDayOff } = getCellDayType(cell)
        if (isWeekend || isSpecialDayOff) return null

        return (
          <BarCell
            key={i}
            day={day}
            index={i}
            rowHeight={rowHeight}
            editable={editable}
            onCellClick={handleCellClick}
          />
        )
      })}

      {/* Inline capacity editor — appears on clicked cell */}
      {editIndex !== null && (
        <div
          className="absolute z-30 flex items-center justify-center"
          style={{
            left: editIndex * DAY_CELL_WIDTH,
            width: DAY_CELL_WIDTH,
            top: 0,
            height: rowHeight,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-background/95 backdrop-blur-sm rounded-md border border-primary/40 p-1 shadow-lg shadow-primary/10">
            <input
              ref={inputRef}
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleSave}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave()
                if (e.key === 'Escape') setEditIndex(null)
                e.stopPropagation()
              }}
              className="w-9 h-6 text-center text-xs rounded border border-border bg-background tabular-nums outline-none focus:ring-1 focus:ring-primary/50"
            />
          </div>
        </div>
      )}
    </>
  )
}

// ============================================================================
// BarCell — вертикальный мини-бар с текстом X/Y
// ============================================================================

interface BarCellProps {
  day: DailyAggregation
  index: number
  rowHeight: number
  editable?: boolean
  onCellClick?: (index: number) => void
}

function BarCell({ day, index, rowHeight, editable, onCellClick }: BarCellProps) {
  const percentage = day.capacity > 0
    ? (day.rateSum / day.capacity) * 100
    : (day.rateSum > 0 ? 100 : 0)

  const maxBarHeight = rowHeight - CELL_PADDING_BOTTOM - TEXT_AREA_HEIGHT
  const visualPercent = Math.min(percentage, 100)
  const barHeight = Math.max((visualPercent / 100) * maxBarHeight, 3)

  const isOverload = percentage > 100
  const style = getBarStyle(percentage)

  const label = `${formatRate(day.rateSum)}/${day.capacity}`

  const handleClick = editable
    ? (e: React.MouseEvent) => { e.stopPropagation(); onCellClick?.(index) }
    : undefined

  return (
    <div
      className="absolute z-10"
      style={{
        left: index * DAY_CELL_WIDTH,
        width: DAY_CELL_WIDTH,
        height: rowHeight,
        cursor: editable ? 'pointer' : undefined,
      }}
      title={`Загрузка: ${formatRate(day.rateSum)} / ${day.capacity} (${Math.round(percentage)}%)${editable ? '\nНажмите для изменения ёмкости' : ''}`}
      onClick={handleClick}
    >
      {/* X/Y text at top */}
      <div
        className="absolute inset-x-0 flex justify-center"
        style={{ top: 2 }}
      >
        <span
          className="text-[9px] font-medium tabular-nums leading-none"
          style={{ color: style.textColor }}
        >
          {label}
        </span>
      </div>

      {/* Vertical bar from bottom */}
      <div
        className="absolute left-1/2 -translate-x-1/2"
        style={{
          bottom: CELL_PADDING_BOTTOM,
          width: BAR_WIDTH,
          height: barHeight,
          backgroundColor: style.bg,
          borderRadius: '3px 3px 1px 1px',
          boxShadow: style.glow,
        }}
      />

      {/* Overload cutoff line */}
      {isOverload && (
        <div
          className="absolute left-1/2 -translate-x-1/2"
          style={{
            bottom: CELL_PADDING_BOTTOM + maxBarHeight,
            width: BAR_WIDTH + 8,
            height: 2,
            background: 'linear-gradient(90deg, transparent 0%, rgba(239,68,68,0.8) 20%, rgba(239,68,68,0.8) 80%, transparent 100%)',
            borderRadius: 1,
          }}
        />
      )}
    </div>
  )
}
