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
import { computeWeeklyAggregation, formatBarNumber, type WeeklyAggregation } from '../utils/aggregate-bars'
import { getBarStyle, SURPLUS_ACCENT_COLOR, type BarStyle } from '../utils/bar-color'
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
  /** Знаков после запятой в тексте бара (не влияет на % для высоты/цвета). По умолчанию 2. */
  decimals?: number
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
  decimals,
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
            decimals={decimals}
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
  /** Знаков после запятой в тексте бара. По умолчанию 2. */
  decimals?: number
}

function WeekBarCell({ week, data, index, cellWidth, rowHeight, editable, onCellClick, decimals = 2 }: WeekBarCellProps) {
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
    label = formatBarNumber(data.capacity, decimals)
  } else if (hasLoadingWithoutCapacity) {
    label = `${formatBarNumber(data.rateSum, decimals)}/0`
  } else {
    label = `${formatBarNumber(data.rateSum, decimals)}/${formatBarNumber(data.capacity, decimals)}`
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
    week.label,
    isEmpty
      ? `Ёмкость: ${formatBarNumber(data.capacity, decimals)}`
      : hasLoadingWithoutCapacity
      ? `Загрузка: ${formatBarNumber(data.rateSum, decimals)} (ёмкость не установлена)`
      : `Загрузка: ${formatBarNumber(data.rateSum, decimals)} / ${formatBarNumber(data.capacity, decimals)} (${Math.round(percentage)}%)`,
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

      {/* Перегруз (X > Y) нейтральный, не тревожный (см. bar-color.ts) */}
      {isOverload && (
        <div
          className="absolute left-1/2 -translate-x-1/2"
          style={{
            bottom: CELL_PADDING_BOTTOM + maxBarHeight,
            width: BAR_WIDTH + 8,
            height: 2,
            background: `linear-gradient(90deg, transparent 0%, ${SURPLUS_ACCENT_COLOR} 20%, ${SURPLUS_ACCENT_COLOR} 80%, transparent 100%)`,
            borderRadius: 1,
          }}
        />
      )}
    </div>
  )
}
