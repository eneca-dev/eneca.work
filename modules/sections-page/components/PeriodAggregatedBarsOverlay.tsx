/**
 * PeriodAggregatedBarsOverlay — аналог AggregatedBarsOverlay для широкой сетки
 * (неделя / месяц). Раньше существовал только недельный вариант
 * (WeeklyAggregatedBarsOverlay); при добавлении месячного режима (feature-AB-11)
 * обобщён на любой период, заданный списком рабочих дат — по тому же принципу,
 * что и LoadingBarButton, общий для WeeklyLoadingBars и MonthlyLoadingBars.
 *
 * Один мини-бар на период (среднедневная загрузка/ёмкость за рабочие дни периода).
 * Редактирование ёмкости — клик по ячейке → инпут → сохранение сразу на все дни
 * периода (через тот же onSaveCapacity(startDate, endDate, value), что и в дневном
 * режиме — expandDateRange на стороне вызывающего компонента и так разворачивает
 * диапазон в отдельные даты). Диапазон можно растянуть за боковые маркеры.
 */

'use client'

import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { computePeriodAggregation, formatBarNumber, type PeriodAggregation } from '../utils/aggregate-bars'
import { getBarStyle, SURPLUS_ACCENT_COLOR, type BarStyle } from '../utils/bar-color'
import type { SectionLoading } from '../types'
import type { VirtualColumn } from '@/modules/shared/virtualized-tree'

// ============================================================================
// Types
// ============================================================================

/**
 * Ячейка периода — общий контракт недельной и месячной сетки.
 * WeekCell и MonthCell подходят как есть (структурная совместимость).
 */
export interface PeriodCell {
  /** Первый день периода: "2026-08-10" */
  startDate: string
  /** Последний день периода: "2026-08-16" */
  endDate: string
  /** Подпись для тултипа: "10-16 авг" / "Август 2026" */
  label: string
  /** Даты рабочих дней периода — база для агрегации X/Y */
  workingDates: string[]
}

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

interface PeriodAggregatedBarsOverlayProps {
  loadings: SectionLoading[]
  /** Базовая ёмкость (из данных ObjectSection) */
  defaultCapacity: number
  /** Per-date переопределения ёмкости (dateStr → capacity) */
  dateCapacityOverrides?: Record<string, number>
  cells: PeriodCell[]
  cellWidth: number
  rowHeight: number
  /** Видимые колонки периода (горизонтальная виртуализация). undefined → все. */
  columns?: VirtualColumn[]
  /** Включить inline-редактирование ёмкости */
  editable?: boolean
  /** Сохранить ёмкость на диапазон дат (границы периода) */
  onSaveCapacity?: (startDate: string, endDate: string, value: number) => void
  /** Знаков после запятой в тексте бара (не влияет на % для высоты/цвета). По умолчанию 2. */
  decimals?: number
}

export function PeriodAggregatedBarsOverlay({
  loadings,
  defaultCapacity,
  dateCapacityOverrides = EMPTY_OVERRIDES,
  cells,
  cellWidth,
  rowHeight,
  columns,
  editable = false,
  onSaveCapacity,
  decimals,
}: PeriodAggregatedBarsOverlayProps) {
  // Диапазон редактирования в индексах ячеек (как в дневном режиме — там в днях)
  const [editRange, setEditRange] = useState<{ start: number; end: number } | null>(null)
  const [editValue, setEditValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  /**
   * Ячейка и значение на момент открытия редактора — чтобы отличить «открыл и
   * подтвердил, ничего не тронув» от осмысленного ввода.
   *
   * Зачем: в поле подставляется СРЕДНЕЕ по рабочим дням периода. Если внутри
   * месяца ёмкость размечена по дням (пн=5, остальные=0), на баре видно «1», и
   * Enter без правки записал бы эту единицу во все ~30 дней — дневная разметка
   * стёрта, а число на баре не изменилось, то есть пользователь не увидел бы,
   * что что-то произошло. Растянутый за маркеры диапазон при том же числе —
   * наоборот, осознанное действие, его сохраняем.
   */
  const editOriginRef = useRef<{ index: number; value: string } | null>(null)

  useEffect(() => {
    if (editRange !== null && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editRange])

  const periodData = useMemo(
    () => computePeriodAggregation(loadings, defaultCapacity, dateCapacityOverrides, cells),
    [loadings, defaultCapacity, dateCapacityOverrides, cells]
  )

  const handleCellClick = useCallback((index: number) => {
    if (!editable || !onSaveCapacity) return
    // Предзаполняем тем же числом, что показано на клетке (среднее по рабочим
    // дням периода), а не значением конкретного дня — иначе можно было увидеть
    // одно число, а редактировать другое.
    const currentCapacity = periodData[index]?.capacity ?? defaultCapacity
    const initialValue = String(Math.round(currentCapacity * 100) / 100)
    setEditValue(initialValue)
    setEditRange({ start: index, end: index })
    editOriginRef.current = { index, value: initialValue }
  }, [editable, onSaveCapacity, defaultCapacity, periodData])

  const handleSave = useCallback(() => {
    // Ничего не изменилось: то же число и та же одна ячейка, что при открытии
    const origin = editOriginRef.current
    const isUntouched =
      origin !== null &&
      editRange !== null &&
      editValue === origin.value &&
      editRange.start === origin.index &&
      editRange.end === origin.index

    if (!isUntouched && onSaveCapacity && editRange !== null && editValue !== '') {
      const parsed = parseFloat(editValue)
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 99) {
        const start = Math.min(editRange.start, editRange.end)
        const end = Math.max(editRange.start, editRange.end)
        // От первого дня первой ячейки до последнего дня последней
        onSaveCapacity(cells[start].startDate, cells[end].endDate, parsed)
      }
    }
    setEditRange(null)
    editOriginRef.current = null
  }, [onSaveCapacity, editRange, editValue, cells])

  // Растягивание диапазона за боковые маркеры (аналог дневного режима, шаг = период)
  const handleResizeStart = useCallback((direction: 'left' | 'right', startX: number) => {
    if (!editRange) return

    const initialStart = editRange.start
    const initialEnd = editRange.end

    const handleMouseMove = (e: MouseEvent) => {
      const deltaCells = Math.round((e.clientX - startX) / cellWidth)

      if (direction === 'left') {
        const newStart = Math.max(0, Math.min(cells.length - 1, initialStart + deltaCells))
        setEditRange({ start: newStart, end: initialEnd })
      } else {
        const newEnd = Math.max(0, Math.min(cells.length - 1, initialEnd + deltaCells))
        setEditRange({ start: initialStart, end: newEnd })
      }
    }

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [editRange, cells.length, cellWidth])

  return (
    <div className="absolute inset-0 cells-container">
      {(columns ? columns.map((c) => c.index) : cells.map((_, i) => i)).map((i) => {
        const cell = cells[i]
        const data = periodData[i]
        if (!cell || !data) return null
        return (
          <PeriodBarCell
            key={i}
            cell={cell}
            data={data}
            index={i}
            cellWidth={cellWidth}
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
          {/* Подсветка выбранного диапазона */}
          <div
            className="absolute z-10 pointer-events-none"
            style={{
              left: Math.min(editRange.start, editRange.end) * cellWidth,
              width: (Math.abs(editRange.end - editRange.start) + 1) * cellWidth,
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
              left: Math.min(editRange.start, editRange.end) * cellWidth,
              width: (Math.abs(editRange.end - editRange.start) + 1) * cellWidth,
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
// PeriodBarCell — вертикальный мини-бар с текстом X/Y на период
// ============================================================================

interface PeriodBarCellProps {
  cell: PeriodCell
  data: PeriodAggregation
  index: number
  cellWidth: number
  rowHeight: number
  editable?: boolean
  onCellClick?: (index: number) => void
  /** Знаков после запятой в тексте бара. По умолчанию 2. */
  decimals?: number
}

function PeriodBarCell({ cell, data, index, cellWidth, rowHeight, editable, onCellClick, decimals = 2 }: PeriodBarCellProps) {
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
        title={editable ? `${cell.label} — нажмите для установки ёмкости` : cell.label}
        onClick={handleClick}
      />
    )
  }

  // В тултипе — точные числа, без огрубления из `decimals`. На строке отдела
  // подпись бара округляется до целых (decimals=0, bug-AB-10: «48/52» читается
  // легче, чем «47.83/52.14»), но при наведении нужно видеть, что там на самом
  // деле — иначе непонятно, почему бар не упирается в верх при «52/52».
  const title = [
    cell.label,
    isEmpty
      ? `Ёмкость: ${formatBarNumber(data.capacity)}`
      : hasLoadingWithoutCapacity
      ? `Загрузка: ${formatBarNumber(data.rateSum)} (ёмкость не установлена)`
      : `Загрузка: ${formatBarNumber(data.rateSum)} / ${formatBarNumber(data.capacity)} (${Math.round(percentage)}%)`,
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
