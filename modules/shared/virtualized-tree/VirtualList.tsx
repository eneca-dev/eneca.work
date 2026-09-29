/**
 * VirtualList — общее ядро виртуализации для деревьев /tasks.
 *
 * Headless-обёртка над @tanstack/react-virtual:
 * - вертикальная виртуализация плоского списка строк (рендерятся только видимые + overscan);
 * - переменная высота строк через measureElement (ResizeObserver) — высоту знать заранее не нужно;
 * - scrollToIndex (замена scrollIntoView, который не работает на не-смонтированных строках);
 * - ОПЦИОНАЛЬНО горизонтальная виртуализация колонок (грид) — для таймлайна, где каждая
 *   строка иначе рендерит всю сетку дней (сотни ячеек). Видимые колонки прокидываются в
 *   renderItem(item, index, columns); строки рендерят только их (absolute по col.start).
 *
 * Профиль рендера строки (табличный / таймлайн) задаётся снаружи через renderItem.
 *
 * positionWithTop: позиционировать строки через `top` вместо `transform: translateY`.
 * Нужно для таймлайн-вкладок, где внутри строк есть `position: sticky` (левый сайдбар):
 * `transform` у предка ломает sticky, а `top` — нет.
 */

'use client'

import { memo, useCallback, useImperativeHandle, useMemo, useRef } from 'react'
import type { CSSProperties, ReactNode, Ref, RefCallback, UIEvent } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { cn } from '@/lib/utils'

export interface VirtualListHandle {
  /** Прокрутить к строке по индексу в плоском списке. */
  scrollToIndex: (index: number, opts?: { align?: 'start' | 'center' | 'end' | 'auto' }) => void
}

/** Видимая колонка (горизонтальная виртуализация). start — позиция в области контента (без scrollMargin). */
export interface VirtualColumn {
  index: number
  start: number
  size: number
}

interface VirtualListProps<T> {
  items: T[]
  /** Стабильный ключ строки (для корректного reuse при изменении списка). */
  getKey: (item: T, index: number) => string
  renderItem: (item: T, index: number, columns?: VirtualColumn[]) => ReactNode
  /** Оценка высоты строки до измерения (px). measureElement потом уточнит. */
  estimateSize?: number
  overscan?: number
  /** Класс скролл-контейнера (overflow-auto уже задан). */
  className?: string
  /** Проброс onScroll наружу — для синхронизации горизонтального скролла со sticky-шапкой. */
  onScroll?: (e: UIEvent<HTMLDivElement>) => void
  /**
   * Минимальная ширина содержимого (px). Строки позиционируются абсолютно и не всегда
   * растягивают scrollWidth контейнера — задаём явный минимум, чтобы горизонтальный
   * скролл колонок/таймлайна работал кросс-браузерно. Должна совпадать с шириной sticky-шапки.
   */
  minContentWidth?: number
  /** Позиционировать строки через top (а не transform) — чтобы sticky внутри строк не ломался. */
  positionWithTop?: boolean
  /** Доступ к DOM скролл-контейнера (для внешней синхронизации/программного скролла). */
  scrollElementRef?: Ref<HTMLDivElement>

  // --- Горизонтальная виртуализация колонок (таймлайн) ---
  /** Кол-во колонок (дней). undefined → без горизонтальной виртуализации (renderItem.columns = undefined). */
  columnCount?: number
  /** Ширина колонки (px). */
  columnWidth?: number
  /** Overscan колонок. */
  columnOverscan?: number
  /** Смещение начала колонок от старта скролл-контейнера (px) — ширина sticky-сайдбара. */
  columnScrollMargin?: number

  /** React 19: ref как обычный проп (без forwardRef). Даёт доступ к scrollToIndex. */
  ref?: Ref<VirtualListHandle>
}

interface VirtualRowContentProps<T> {
  item: T
  index: number
  columns?: VirtualColumn[]
  renderItem: VirtualListProps<T>['renderItem']
}

function VirtualRowContent<T>({ item, index, columns, renderItem }: VirtualRowContentProps<T>) {
  return renderItem(item, index, columns)
}

// Горизонтальный virtualizer обновляет родителя на каждом scroll event. Сложную строку
// перерисовываем только когда изменились сама строка, renderer или окно колонок.
const MemoizedVirtualRowContent = memo(VirtualRowContent) as typeof VirtualRowContent

export function VirtualList<T>({
  items,
  getKey,
  renderItem,
  estimateSize = 36,
  overscan = 8,
  className,
  onScroll,
  minContentWidth,
  positionWithTop = false,
  scrollElementRef,
  columnCount,
  columnWidth,
  columnOverscan = 3,
  columnScrollMargin = 0,
  ref,
}: VirtualListProps<T>) {
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const isColumnVirtualizationEnabled = Boolean(columnCount && columnWidth)

  // Сетим внутренний ref и (если передан) внешний scrollElementRef одним callback-ref.
  const setScrollEl = useCallback(
    (el: HTMLDivElement | null) => {
      scrollRef.current = el
      if (typeof scrollElementRef === 'function') scrollElementRef(el)
      else if (scrollElementRef) (scrollElementRef as { current: HTMLDivElement | null }).current = el
    },
    [scrollElementRef],
  )

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => estimateSize,
    overscan,
    getItemKey: (index) => getKey(items[index], index),
  })

  // Горизонтальный виртуализатор колонок (тот же скролл-элемент). Активен при columnCount.
  const columnVirtualizer = useVirtualizer({
    enabled: isColumnVirtualizationEnabled,
    horizontal: true,
    count: columnCount ?? 0,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => columnWidth ?? 1,
    overscan: columnOverscan,
    scrollMargin: columnScrollMargin,
    // Горизонтальный drag генерирует частые scroll events. Синхронный flushSync
    // на каждом событии блокирует нативное движение scrollbar сложным ререндером строк.
    // Вертикальный virtualizer оставляем синхронным: там важны динамические высоты.
    useFlushSync: false,
  })

  const columnVirtualItems = columnVirtualizer.getVirtualItems()
  const firstColumnIndex = columnVirtualItems[0]?.index
  const lastColumnIndex = columnVirtualItems[columnVirtualItems.length - 1]?.index

  // Сохраняем ссылку на columns между scroll events, пока фактическое окно дней
  // не изменилось. Это позволяет memo-строкам не рендерить весь таймлайн на каждый px.
  const columns = useMemo<VirtualColumn[] | undefined>(() => {
    if (!isColumnVirtualizationEnabled) return undefined
    // Активный virtualizer до первого измерения ещё не знает окно. Пустой массив
    // не даёт строкам уйти в fallback и временно отрисовать все сотни колонок.
    if (firstColumnIndex === undefined || lastColumnIndex === undefined) return []

    const size = columnWidth ?? 1
    return Array.from({ length: lastColumnIndex - firstColumnIndex + 1 }, (_, offset) => {
      const index = firstColumnIndex + offset
      return { index, start: index * size, size }
    })
  }, [isColumnVirtualizationEnabled, columnWidth, firstColumnIndex, lastColumnIndex])

  useImperativeHandle(
    ref,
    () => ({
      scrollToIndex: (index, opts) =>
        virtualizer.scrollToIndex(index, { align: opts?.align ?? 'center' }),
    }),
    [virtualizer],
  )

  const virtualItems = virtualizer.getVirtualItems()

  return (
    <div ref={setScrollEl} onScroll={onScroll} className={cn('overflow-auto', className)}>
      {/* relative-контейнер задаёт общую высоту списка; строки позиционируются абсолютно по Y.
          minWidth:max(100%, minContentWidth) гарантирует горизонтальный scrollWidth, т.к.
          абсолютные дети не всегда растягивают контейнер. */}
      <div
        className="relative min-w-full"
        style={{
          height: virtualizer.getTotalSize(),
          ...(minContentWidth ? { minWidth: `max(100%, ${minContentWidth}px)` } : null),
        }}
      >
        {virtualItems.map((vi) => {
          const positionStyle: CSSProperties = positionWithTop
            ? { top: vi.start }
            : { top: 0, transform: `translateY(${vi.start}px)` }
          return (
            <div
              key={vi.key}
              data-index={vi.index}
              ref={virtualizer.measureElement as RefCallback<HTMLDivElement>}
              className="absolute left-0 w-max min-w-full"
              style={positionStyle}
            >
              <MemoizedVirtualRowContent
                item={items[vi.index]}
                index={vi.index}
                columns={columns}
                renderItem={renderItem}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
