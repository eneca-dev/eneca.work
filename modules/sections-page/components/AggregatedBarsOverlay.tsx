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
import { DAY_CELL_WIDTH } from '../constants'
import { formatMinskDate } from '@/lib/timezone-utils'
import { getCellDayType } from '../utils/cell-utils'
import { computeDailyAggregation, type DailyAggregation } from '../utils/aggregate-bars'
import { useSectionsPageUIStore } from '../stores/useSectionsPageUIStore'
import type { SectionLoading, DayCell } from '../types'

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

function getBarStyle(percentage: number, isEmpty: boolean): BarStyle {
  // Пустая ячейка (нет загрузки) - серый приглушенный
  if (isEmpty) return {
    bg: 'rgba(148, 163, 184, 0.25)',
    textColor: 'rgba(148, 163, 184, 0.7)',
  }

  // Перегруз (X > Y) - красный
  if (percentage > 100) return {
    bg: 'rgba(239, 68, 68, 0.7)',
    textColor: 'rgba(248, 113, 113, 0.95)',
    glow: '0 0 8px rgba(239, 68, 68, 0.35)',
  }

  // Идеальная загрузка (95-100%) - зеленый насыщенный
  if (percentage >= 95) return {
    bg: 'rgba(34, 197, 94, 0.6)',
    textColor: 'rgba(74, 222, 128, 0.95)',
  }

  // Высокая загрузка (70-94%) - желто-зеленый (lime)
  if (percentage >= 70) return {
    bg: 'rgba(132, 204, 22, 0.55)',
    textColor: 'rgba(163, 230, 53, 0.9)',
  }

  // Средняя загрузка (40-69%) - желтый
  if (percentage >= 40) return {
    bg: 'rgba(234, 179, 8, 0.5)',
    textColor: 'rgba(250, 204, 21, 0.85)',
  }

  // Низкая загрузка (1-39%) - оранжевый
  return {
    bg: 'rgba(249, 115, 22, 0.45)',
    textColor: 'rgba(251, 146, 60, 0.8)',
  }
}

// ============================================================================
// Public component
// ============================================================================

interface AggregatedBarsOverlayProps {
  loadings: SectionLoading[]
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
  /** Подсказка в тултипе (например, где можно ввести ёмкость) */
  capacityHint?: string
}

/** Format rate for display: 2.25 → "2.25", 1 → "1", 0.5 → "0.5" */
function formatRate(rate: number): string {
  return Number(rate.toFixed(2)).toString()
}

export function AggregatedBarsOverlay({
  loadings,
  defaultCapacity,
  dateCapacityOverrides = EMPTY_OVERRIDES,
  dayCells,
  rowHeight,
  editable = false,
  osId,
  capacityHint,
}: AggregatedBarsOverlayProps) {
  // State for inline editing with range support
  const [editRange, setEditRange] = useState<{ start: number; end: number } | null>(null)
  const [editValue, setEditValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Shared hint popup state (only one at a time)
  const [hintCellIndex, setHintCellIndex] = useState<number | null>(null)
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handleHintShow = useCallback((cellIndex: number) => {
    if (hintTimerRef.current) clearTimeout(hintTimerRef.current)
    setHintCellIndex(cellIndex)
    hintTimerRef.current = setTimeout(() => setHintCellIndex(null), 2500)
  }, [])

  // Store methods
  const setCapacity = useSectionsPageUIStore((s) => s.setCapacity)
  const setCapacityRange = useSectionsPageUIStore((s) => s.setCapacityRange)

  useEffect(() => {
    if (editRange !== null && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editRange])

  const handleCellClick = useCallback((index: number) => {
    if (!editable || !osId) return

    // Start editing - single cell initially
    const dateStr = formatMinskDate(dayCells[index].date)
    const currentCapacity = dateCapacityOverrides[dateStr] ?? defaultCapacity
    setEditValue(String(currentCapacity))
    setEditRange({ start: index, end: index })
  }, [editable, osId, defaultCapacity, dateCapacityOverrides, dayCells])

  const handleSave = useCallback(() => {
    if (osId && editRange !== null && editValue !== '') {
      const parsed = parseFloat(editValue)
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 99) {
        const start = Math.min(editRange.start, editRange.end)
        const end = Math.max(editRange.start, editRange.end)

        if (start === end) {
          // Single cell
          const dateStr = formatMinskDate(dayCells[start].date)
          setCapacity(osId, dateStr, parsed)
        } else {
          // Range
          const startDate = formatMinskDate(dayCells[start].date)
          const endDate = formatMinskDate(dayCells[end].date)
          setCapacityRange(osId, startDate, endDate, parsed)
        }
      }
    }
    setEditRange(null)
  }, [osId, editRange, editValue, setCapacity, setCapacityRange, dayCells])

  const dailyData = useMemo(
    () => computeDailyAggregation(loadings, defaultCapacity, dateCapacityOverrides, dayCells),
    [loadings, defaultCapacity, dateCapacityOverrides, dayCells]
  )

  // Handle range resize from handles
  const handleResizeStart = useCallback((direction: 'left' | 'right', startX: number) => {
    if (!editRange) return

    // Сохраняем начальные значения диапазона
    const initialStart = editRange.start
    const initialEnd = editRange.end

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - startX
      const deltaCells = Math.round(deltaX / DAY_CELL_WIDTH)

      if (direction === 'left') {
        // Изменяем только левую границу
        const newStart = Math.max(0, Math.min(dayCells.length - 1, initialStart + deltaCells))
        setEditRange({ start: newStart, end: initialEnd })
      } else {
        // Изменяем только правую границу
        const newEnd = Math.max(0, Math.min(dayCells.length - 1, initialEnd + deltaCells))
        setEditRange({ start: initialStart, end: newEnd })
      }
    }

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [editRange, dayCells.length])

  return (
    <div className="absolute inset-0 cells-container">
        {dailyData.map((day, i) => {
        const cell = dayCells[i]
        const { isWeekend, isSpecialDayOff } = getCellDayType(cell)

        // Пропускаем только выходные и праздники
        if (isWeekend || isSpecialDayOff) return null

        // Показываем все рабочие дни (даже с нулевой загрузкой)
        return (
          <BarCell
            key={i}
            day={day}
            index={i}
            rowHeight={rowHeight}
            editable={editable}
            onCellClick={handleCellClick}
            capacityHint={capacityHint}
            onHintShow={handleHintShow}
          />
        )
      })}

      {/* Inline capacity editor with resize handles */}
      {editRange !== null && (
        <>
          {/* Range highlight background */}
          <div
            className="absolute z-10 pointer-events-none"
            style={{
              left: Math.min(editRange.start, editRange.end) * DAY_CELL_WIDTH,
              width: (Math.abs(editRange.end - editRange.start) + 1) * DAY_CELL_WIDTH,
              top: 0,
              height: rowHeight,
              background: 'rgba(34, 197, 94, 0.08)',
              border: '1px solid rgba(34, 197, 94, 0.25)',
              borderRadius: '2px',
            }}
          />

          {/* Container for input and handles */}
          <div
            className="absolute z-20"
            style={{
              left: Math.min(editRange.start, editRange.end) * DAY_CELL_WIDTH,
              width: (Math.abs(editRange.end - editRange.start) + 1) * DAY_CELL_WIDTH,
              top: 0,
              height: rowHeight,
            }}
          >
            {/* Left resize handle */}
            <div
              className="absolute top-0 bottom-0 cursor-ew-resize hover:bg-primary/20 transition-colors group"
              style={{
                left: -3,
                width: 8,
              }}
              onMouseDown={(e) => {
                e.stopPropagation()
                e.preventDefault()
                handleResizeStart('left', e.clientX)
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-0.5 h-2/3 rounded-full bg-primary/0 group-hover:bg-primary/60 transition-colors" />
            </div>

            {/* Input in the center */}
            <div
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
            >
              <div
                className="bg-background/95 backdrop-blur-sm rounded-md border border-primary/40 p-1 shadow-lg shadow-primary/10 pointer-events-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  ref={inputRef}
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value.replace(',', '.'))}
                  onBlur={handleSave}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSave()
                    if (e.key === 'Escape') setEditRange(null)
                    e.stopPropagation()
                  }}
                  className="w-9 h-6 text-center text-xs rounded border border-border bg-background tabular-nums outline-none focus:ring-1 focus:ring-primary/50"
                />
              </div>
            </div>

            {/* Right resize handle */}
            <div
              className="absolute top-0 bottom-0 cursor-ew-resize hover:bg-primary/20 transition-colors group"
              style={{
                right: -3,
                width: 8,
              }}
              onMouseDown={(e) => {
                e.stopPropagation()
                e.preventDefault()
                handleResizeStart('right', e.clientX)
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-0.5 h-2/3 rounded-full bg-primary/0 group-hover:bg-primary/60 transition-colors" />
            </div>
          </div>
        </>
      )}

      {hintCellIndex !== null && capacityHint && (
        <div
          className="absolute z-[9999] pointer-events-none"
          style={{
            left: hintCellIndex * DAY_CELL_WIDTH + DAY_CELL_WIDTH / 2,
            bottom: rowHeight + 4,
            transform: 'translateX(-50%)',
            whiteSpace: 'nowrap',
          }}
        >
          <div
            className="text-[10px] leading-tight px-2 py-1 rounded-md shadow-md"
            style={{
              background: 'rgba(15, 23, 42, 0.92)',
              color: 'rgba(203, 213, 225, 0.95)',
              border: '1px solid rgba(148, 163, 184, 0.2)',
            }}
          >
            {capacityHint}
          </div>
          <div
            className="absolute left-1/2 -translate-x-1/2"
            style={{
              top: '100%',
              width: 0,
              height: 0,
              borderLeft: '4px solid transparent',
              borderRight: '4px solid transparent',
              borderTop: '4px solid rgba(15, 23, 42, 0.92)',
            }}
          />
        </div>
      )}
    </div>
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
  capacityHint?: string
  onHintShow?: (cellIndex: number) => void
}

function BarCell({ day, index, rowHeight, editable, onCellClick, capacityHint, onHintShow }: BarCellProps) {
  const handleHintClick = (e: React.MouseEvent) => {
    if (!capacityHint) return
    e.stopPropagation()
    onHintShow?.(index)
  }

  const isEmpty = day.rateSum === 0
  const hasNoCapacity = day.capacity === 0
  const hasLoadingWithoutCapacity = hasNoCapacity && !isEmpty

  const percentage = !isEmpty && day.capacity > 0
    ? (day.rateSum / day.capacity) * 100
    : 0

  const maxBarHeight = rowHeight - CELL_PADDING_BOTTOM - TEXT_AREA_HEIGHT

  // Высота бара
  let barHeight: number
  if (isEmpty) {
    barHeight = 12 // Пустая ячейка - маленький серый бар
  } else if (hasLoadingWithoutCapacity) {
    barHeight = maxBarHeight * 0.5 // Загрузка без capacity - серый бар 50% высоты
  } else {
    barHeight = Math.max(Math.min(percentage, 100) / 100 * maxBarHeight, 3)
  }

  const isOverload = percentage > 100

  // Стиль бара
  let style: { bg: string; textColor: string; glow?: string }
  if (hasLoadingWithoutCapacity) {
    // Серый бар для загрузки без capacity
    style = {
      bg: 'rgba(148, 163, 184, 0.6)',
      textColor: 'rgba(100, 116, 139, 0.9)',
    }
  } else {
    style = getBarStyle(percentage, isEmpty)
  }

  // Label
  let label: string
  if (isEmpty) {
    label = String(day.capacity)
  } else if (hasLoadingWithoutCapacity) {
    label = `${formatRate(day.rateSum)}/0` // Загрузка с /0
  } else {
    label = `${formatRate(day.rateSum)}/${day.capacity}`
  }

  const handleClick = editable
    ? (e: React.MouseEvent) => { e.stopPropagation(); onCellClick?.(index) }
    : capacityHint
    ? handleHintClick
    : undefined

  // Если capacity = 0 И нет загрузки → пустая ячейка (но кликабельная)
  if (hasNoCapacity && isEmpty) {
    return (
      <div

        className="absolute z-10"
        style={{
          left: index * DAY_CELL_WIDTH,
          width: DAY_CELL_WIDTH,
          height: rowHeight,
          cursor: editable || capacityHint ? 'pointer' : undefined,
        }}
        title={editable ? 'Нажмите для установки ёмкости' : ['Ёмкость не установлена', capacityHint].filter(Boolean).join('\n')}
        onClick={handleClick}
      >
      </div>
    )
  }

  return (
    <div
      className="absolute z-10"
      style={{
        left: index * DAY_CELL_WIDTH,
        width: DAY_CELL_WIDTH,
        height: rowHeight,
        cursor: editable || capacityHint ? 'pointer' : undefined,
      }}
      title={
        isEmpty
          ? [`Capacity: ${day.capacity}`, editable ? 'Нажмите для изменения ёмкости' : capacityHint].filter(Boolean).join('\n')
          : hasLoadingWithoutCapacity
          ? [`Загрузка: ${formatRate(day.rateSum)} (ёмкость не установлена)`, editable ? 'Нажмите для установки ёмкости' : capacityHint].filter(Boolean).join('\n')
          : [`Загрузка: ${formatRate(day.rateSum)} / ${day.capacity} (${Math.round(percentage)}%)`, editable ? 'Нажмите для изменения ёмкости' : capacityHint].filter(Boolean).join('\n')
      }
      onClick={handleClick}
    >
      {/* X/Y text at top */}
      <div
        className="absolute inset-x-0 flex justify-center"
        style={{ top: 2 }}
      >
        <span
          className={`
            tabular-nums leading-none font-medium
            ${isEmpty ? 'text-[8px] opacity-70' : 'text-[9px]'}
          `}
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
          borderRadius: isEmpty ? '1px' : '3px 3px 1px 1px',
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

