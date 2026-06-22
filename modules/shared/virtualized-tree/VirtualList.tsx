/**
 * VirtualList — общее ядро виртуализации для деревьев /tasks.
 *
 * Headless-обёртка над @tanstack/react-virtual:
 * - вертикальная виртуализация плоского списка строк (рендерятся только видимые + overscan);
 * - переменная высота строк через measureElement (ResizeObserver) — высоту знать заранее не нужно;
 * - scrollToIndex (замена scrollIntoView, который не работает на не-смонтированных строках);
 * - горизонтальный скролл сохраняется: строки шире вьюпорта (`w-max`) дают горизонтальный overflow,
 *   onScroll прокидывается наружу для синхронизации со sticky-шапкой.
 *
 * Профиль рендера строки (табличный / таймлайн) задаётся снаружи через renderItem —
 * ядро ничего не знает о доменной разметке.
 */

'use client'

import { useImperativeHandle, useRef } from 'react'
import type { ReactNode, Ref, RefCallback, UIEvent } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { cn } from '@/lib/utils'

export interface VirtualListHandle {
  /** Прокрутить к строке по индексу в плоском списке. */
  scrollToIndex: (index: number, opts?: { align?: 'start' | 'center' | 'end' | 'auto' }) => void
}

interface VirtualListProps<T> {
  items: T[]
  /** Стабильный ключ строки (для корректного reuse при изменении списка). */
  getKey: (item: T, index: number) => string
  renderItem: (item: T, index: number) => ReactNode
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
  /** React 19: ref как обычный проп (без forwardRef). Даёт доступ к scrollToIndex. */
  ref?: Ref<VirtualListHandle>
}

export function VirtualList<T>({
  items,
  getKey,
  renderItem,
  estimateSize = 36,
  overscan = 8,
  className,
  onScroll,
  minContentWidth,
  ref,
}: VirtualListProps<T>) {
  const scrollRef = useRef<HTMLDivElement | null>(null)

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => estimateSize,
    overscan,
    getItemKey: (index) => getKey(items[index], index),
  })

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
    <div ref={scrollRef} onScroll={onScroll} className={cn('overflow-auto', className)}>
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
        {virtualItems.map((vi) => (
          <div
            key={vi.key}
            data-index={vi.index}
            ref={virtualizer.measureElement as RefCallback<HTMLDivElement>}
            className="absolute left-0 top-0 w-max min-w-full"
            style={{ transform: `translateY(${vi.start}px)` }}
          >
            {renderItem(items[vi.index], vi.index)}
          </div>
        ))}
      </div>
    </div>
  )
}
