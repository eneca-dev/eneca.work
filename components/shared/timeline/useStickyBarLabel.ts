/**
 * useStickyBarLabel — «едущая» подпись внутри бара загрузки при горизонтальном
 * скролле таймлайна.
 *
 * Перенесено из дневного режима (modules/sections-page/components/rows/EmployeeRow.tsx
 * и modules/departments-timeline/components/timeline/EmployeeRow.tsx, где этот же
 * паттерн был продублирован 1:1) — там у каждого бара уже есть эффект: пока левый
 * край бара виден, подпись стоит на месте; как только край уходит за левую границу
 * контейнера, подпись сдвигается вправо вместе со скроллом, чтобы остаться видимой.
 *
 * WeeklyLoadingBars/MonthlyLoadingBars (широкая сетка) этого эффекта не имели вообще —
 * подпись была статично прибита к левому краю бара и пропадала при скролле длинных
 * загрузок (bug-AB-08).
 */

'use client'

import { useEffect, useRef } from 'react'

/**
 * @param barLeft ширина левой позиции бара (px) относительно начала таймлайна
 * @param barWidth ширина бара (px)
 * @param reserveRight сколько px справа не отдавать под сдвиг (место под rate-бейдж и т.п.)
 */
export function useStickyBarLabel<T extends HTMLElement>(
  barLeft: number,
  barWidth: number,
  reserveRight = 0
) {
  const ref = useRef<T>(null)

  useEffect(() => {
    const el = ref.current
    const container = el?.closest('.overflow-auto')
    if (!el || !container) return

    const update = () => {
      const scrollLeft = (container as HTMLElement).scrollLeft
      const overlap = Math.max(0, scrollLeft - barLeft)
      const clamped = Math.min(overlap, Math.max(0, barWidth - reserveRight))
      el.style.transform = `translateX(${clamped}px)`
    }

    update()
    container.addEventListener('scroll', update, { passive: true })
    return () => container.removeEventListener('scroll', update)
  }, [barLeft, barWidth, reserveRight])

  return ref
}
