'use client'

/**
 * Idle-префетч деревьев нескольких проектов (для модалки «Создать загрузку»).
 *
 * Принимает projectId раскрытых на странице проектов и в простое браузера прогревает
 * их деревья ПОСЛЕДОВАТЕЛЬНО (один за другим) — чтобы не было пачки getFilterContext.
 * `prefetchQuery` сам пропускает свежие данные (не рефетчит в пределах staleTime),
 * поэтому повторные вызовы для уже прогретых проектов почти бесплатны.
 *
 * Срабатывает при изменении набора раскрытых проектов: на старте (персистнутые
 * раскрытия из localStorage) и когда пользователь только что раскрыл новый проект.
 */

import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { projectTreeQueryOptions } from './useProjectTree'

export function usePrefetchProjectTrees(projectIds: string[]) {
  const queryClient = useQueryClient()
  // Стабильный ключ для deps — массив пересоздаётся каждый рендер, строка нет.
  const idsKey = projectIds.join(',')

  useEffect(() => {
    const ids = idsKey ? idsKey.split(',') : []
    if (ids.length === 0) return

    let cancelled = false
    const run = async () => {
      for (const projectId of ids) {
        if (cancelled) return
        // Холодные деревья грузятся по одному (без пачки getFilterContext);
        // свежие — no-op (prefetchQuery уважает staleTime).
        await queryClient.prefetchQuery(projectTreeQueryOptions(projectId)).catch(() => {})
      }
    }

    let idleId: number | undefined
    let timeoutId: ReturnType<typeof setTimeout> | undefined
    if (window.requestIdleCallback) {
      idleId = window.requestIdleCallback(() => run(), { timeout: 3000 })
    } else {
      timeoutId = setTimeout(() => run(), 1500)
    }

    return () => {
      cancelled = true
      if (idleId !== undefined) window.cancelIdleCallback?.(idleId)
      if (timeoutId !== undefined) clearTimeout(timeoutId)
    }
  }, [idsKey, queryClient])
}
