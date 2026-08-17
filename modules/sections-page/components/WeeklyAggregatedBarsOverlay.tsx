/**
 * WeeklyAggregatedBarsOverlay — недельный аналог AggregatedBarsOverlay.
 *
 * Один мини-бар на неделю (среднедневная загрузка/ёмкость за рабочие дни недели).
 * Редактирование ёмкости — клик по неделе → инпут → сохранение сразу на все 7 дней
 * недели (через тот же onSaveCapacity(startDate, endDate, value), что и в дневном
 * режиме — expandDateRange на стороне вызывающего компонента и так разворачивает
 * диапазон в отдельные даты). Без drag-resize — это только один клик, одна неделя.
 */

'use client'

import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { computeWeeklyAggregation, type WeeklyAggregation } from '../utils/aggregate-bars'
import type { SectionLoading } from '../types'
import type { WeekCell } from '@/modules/resource-graph/utils/weekly-cell-utils'
import type { VirtualColumn } from '@/modules/shared/virtualized-tree'

// ============================================================================
// Constants
// ============================================================================

const EMPTY_OVERRIDES: Record<string, number> = {}
const BAR_WIDTH = 26
const CELL_PADDING_BOTTOM = 3
const TEXT_AREA_HEIGHT = 13

// ============================================================================
// Color logic — идентична дневному режиму (AggregatedBarsOverlay.getBarStyle)
// ============================================================================

interface BarStyle {
  bg: string
  textColor: string
  glow?: string
}

function getBarStyle(percentage: number, isEmpty: boolean): BarStyle {
  if (isEmpty) return {
    bg: 'rgba(148, 163, 184, 0.25)',
    textColor: 'rgba(148, 163, 184, 0.7)',
  }
  if (percentage > 100) return {
    bg: 'rgba(239, 68, 68, 0.7)',
    textColor: 'rgba(248, 113, 113, 0.95)',
    glow: '0 0 8px rgba(239, 68, 68, 0.35)',
  }
  if (percentage >= 95) return {
    bg: 'rgba(34, 197, 94, 0.6)',
    textColor: 'rgba(74, 222, 128, 0.95)',
  }
  if (percentage >= 70) return {
    bg: 'rgba(132, 204, 22, 0.55)',
    textColor: 'rgba(163, 230, 53, 0.9)',
  }
  if (percentage >= 40) return {
    bg: 'rgba(234, 179, 8, 0.5)',
    textColor: 'rgba(250, 204, 21, 0.85)',
  }
  return {
    bg: 'rgba(249, 115, 22, 0.45)',
    textColor: 'rgba(251, 146, 60, 0.8)',
  }
}

/** Format rate for display: 2.25 → "2.25", 1 → "1", 0.5 → "0.5" */
function formatRate(rate: number): string {
  return Number(rate.toFixed(2)).toString()
}

// ============================================================================
// Public component
// ============================================================================

interface WeeklyAggregatedBarsOverlayProps {
  loadings: SectionLoading[]
  /** Базовая ёмкость (из данных ObjectSection) */
  defaultCapacity: number
  /** Per-date переопределения ёмкости (dateStr → capacity) */
  dateCapacityOverrides?: Record<string, number>
  weekCells: WeekCell[]
  weekCellWidth: number
  rowHeight: number
  /** Видимые колонки недели (горизонтальная виртуализация). undefined → все. */
  columns?: VirtualColumn[]
  /** Включить inline-редактирование ёмкости */
  editable?: boolean
  /** Сохранить ёмкость на диапазон дат (границы недели) */
  onSaveCapacity?: (startDate: string, endDate: string, value: number) => void
}

export function WeeklyAggregatedBarsOverlay({
  loadings,
  defaultCapacity,
  dateCapacityOverrides = EMPTY_OVERRIDES,
  weekCells,
  weekCellWidth,
  rowHeight,
  columns,
  editable = false,
  onSaveCapacity,
}: WeeklyAggregatedBarsOverlayProps) {
  // Диапазон редактирования в индексах недель (как в дневном режиме — там в днях)
  const [editRange, setEditRange] = useState<{ start: number; end: number } | null>(null)
  const [editValue, setEditValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editRange !== null && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editRange])

  const weeklyData = useMemo(
    () => computeWeeklyAggregation(loadings, defaultCapacity, dateCapacityOverrides, weekCells),
    [loadings, defaultCapacity, dateCapacityOverrides, weekCells]
  )

  const handleCellClick = useCallback((index: number) => {
    if (!editable || !onSaveCapacity) return
    // Предзаполняем тем же числом, что показано на клетке (среднее по рабочим
    // дням недели), а не значением конкретного дня — иначе можно было увидеть
    // одно число, а редактировать другое.
    const currentCapacity = weeklyData[index]?.capacity ?? defaultCapacity
    setEditValue(String(Math.round(currentCapacity * 100) / 100))
    setEditRange({ start: index, end: index })
  }, [editable, onSaveCapacity, defaultCapacity, weeklyData])

  const handleSave = useCallback(() => {
    if (onSaveCapacity && editRange !== null && editValue !== '') {
      const parsed = parseFloat(editValue)
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 99) {
        const start = Math.min(editRange.start, editRange.end)
        const end = Math.max(editRange.start, editRange.end)
        // От понедельника первой недели до воскресенья последней
        onSaveCapacity(weekCells[start].startDate, weekCells[end].endDate, parsed)
      }
    }
    setEditRange(null)
  }, [onSaveCapacity, editRange, editValue, weekCells])

  // Растягивание диапазона за боковые маркеры (аналог дневного режима, шаг = неделя)
  const handleResizeStart = useCallback((direction: 'left' | 'right', startX: number) => {
    if (!editRange) return

    const initialStart = editRange.start
    const initialEnd = editRange.end

    const handleMouseMove = (e: MouseEvent) => {
      const deltaCells = Math.round((e.clientX - startX) / weekCellWidth)

      if (direction === 'left') {
        const newStart = Math.max(0, Math.min(weekCells.length - 1, initialStart + deltaCells))
        setEditRange({ start: newStart, end: initialEnd })
      } else {
        const newEnd = Math.max(0, Math.min(weekCells.length - 1, initialEnd + deltaCells))
        setEditRange({ start: initialStart, end: newEnd })
      }
    }

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [editRange, weekCells.length, weekCellWidth])

  return (
    <div className="absolute inset-0 cells-container">
      {(columns ? columns.map((c) => c.index) : weekCells.map((_, i) => i)).map((i) => {
        const week = weekCells[i]
        const data = weeklyData[i]
        if (!week || !data) return null
        return (
          <WeekBarCell
            key={i}
            week={week}
            data={data}
            index={i}
            cellWidth={weekCellWidth}
            rowHeight={rowHeight}
            editable={editable}
            onCellClick={handleCellClick}
          />
        )
      })}

      {/* Inline capacity editor с растягиванием диапазона за боковые маркеры */}
      {editRange !== null && (
        <>
          {/* Подсветка выбранного диапазона недель */}
          <div
            className="absolute z-10 pointer-events-none"
            style={{
              left: Math.min(editRange.start, editRange.end) * weekCellWidth,
              width: (Math.abs(editRange.end - editRange.start) + 1) * weekCellWidth,
              top: 0,
              height: rowHeight,
              background: 'rgba(34, 197, 94, 0.08)',
              border: '1px solid rgba(34, 197, 94, 0.25)',
              borderRadius: '2px',
            }}
          />

          {/* Контейнер с полем ввода и маркерами */}
          <div
            className="absolute z-20"
            style={{
              left: Math.min(editRange.start, editRange.end) * weekCellWidth,
              width: (Math.abs(editRange.end - editRange.start) + 1) * weekCellWidth,
              top: 0,
              height: rowHeight,
            }}
          >
            {/* Левый маркер */}
            <div
              className="absolute top-0 bottom-0 cursor-ew-resize hover:bg-primary/20 transition-colors group"
              style={{ left: -3, width: 8 }}
              onMouseDown={(e) => {
                e.stopPropagation()
                e.preventDefault()
                handleResizeStart('left', e.clientX)
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-0.5 h-2/3 rounded-full bg-primary/0 group-hover:bg-primary/60 transition-colors" />
            </div>

            {/* Поле ввода по центру */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
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

            {/* Правый маркер */}
            <div
              className="absolute top-0 bottom-0 cursor-ew-resize hover:bg-primary/20 transition-colors group"
              style={{ right: -3, width: 8 }}
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
    </div>
  )
}

// ============================================================================
// WeekBarCell — вертикальный мини-бар с текстом X/Y на неделю
// ============================================================================

interface WeekBarCellProps {
  week: WeekCell
  data: WeeklyAggregation
  index: number
  cellWidth: number
  rowHeight: number
  editable?: boolean
  onCellClick?: (index: number) => void
}

function WeekBarCell({ week, data, index, cellWidth, rowHeight, editable, onCellClick }: WeekBarCellProps) {
  const isEmpty = data.rateSum === 0
  const hasNoCapacity = data.capacity === 0
  const hasLoadingWithoutCapacity = hasNoCapacity && !isEmpty

  const percentage = !isEmpty && data.capacity > 0
    ? (data.rateSum / data.capacity) * 100
    : 0

  const maxBarHeight = rowHeight - CELL_PADDING_BOTTOM - TEXT_AREA_HEIGHT

  let barHeight: number
  if (isEmpty) {
    barHeight = 12
  } else if (hasLoadingWithoutCapacity) {
    barHeight = maxBarHeight * 0.5
  } else {
    barHeight = Math.max(Math.min(percentage, 100) / 100 * maxBarHeight, 3)
  }

  const isOverload = percentage > 100

  let style: BarStyle
  if (hasLoadingWithoutCapacity) {
    style = { bg: 'rgba(148, 163, 184, 0.6)', textColor: 'rgba(100, 116, 139, 0.9)' }
  } else {
    style = getBarStyle(percentage, isEmpty)
  }

  let label: string
  if (isEmpty) {
    label = String(Math.round(data.capacity * 10) / 10)
  } else if (hasLoadingWithoutCapacity) {
    label = `${formatRate(data.rateSum)}/0`
  } else {
    label = `${formatRate(data.rateSum)}/${Math.round(data.capacity * 10) / 10}`
  }

  const handleClick = editable
    ? (e: React.MouseEvent) => { e.stopPropagation(); onCellClick?.(index) }
    : undefined

  // Нет загрузки И ёмкость не задана (0) → пустая ячейка без "0", но кликабельная
  // (как в дневном режиме — там для этого случая тоже нет ни текста, ни бара).
  if (hasNoCapacity && isEmpty) {
    return (
      <div
        className="absolute z-10"
        style={{
          left: index * cellWidth,
          width: cellWidth,
          height: rowHeight,
          cursor: editable ? 'pointer' : undefined,
        }}
        title={editable ? `${week.label} — нажмите для установки ёмкости` : week.label}
        onClick={handleClick}
      />
    )
  }

  const title = [
    `${week.label} (${week.workingDays} р.д.)`,
    isEmpty
      ? `Ёмкость: ${data.capacity}`
      : hasLoadingWithoutCapacity
      ? `Загрузка: ${formatRate(data.rateSum)} (ёмкость не установлена)`
      : `Загрузка: ${formatRate(data.rateSum)} / ${Math.round(data.capacity * 10) / 10} (${Math.round(percentage)}%)`,
    editable ? 'Нажмите для изменения ёмкости' : null,
  ].filter(Boolean).join('\n')

  return (
    <div
      className="absolute z-10 overflow-hidden"
      style={{
        left: index * cellWidth,
        width: cellWidth,
        height: rowHeight,
        cursor: editable ? 'pointer' : undefined,
      }}
      title={title}
      onClick={handleClick}
    >
      <div className="absolute inset-x-0 flex justify-center px-0.5" style={{ top: 2 }}>
        <span
          className={`tabular-nums leading-none font-medium truncate ${isEmpty ? 'text-[8px] opacity-70' : 'text-[9px]'}`}
          style={{ color: style.textColor }}
        >
          {label}
        </span>
      </div>

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
