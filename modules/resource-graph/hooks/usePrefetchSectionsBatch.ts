'use client'

/**
 * usePrefetchSectionsBatch - Фоновая предзагрузка данных секций
 *
 * Загружает batch данные для объектов в фоне после initial load
 * для устранения задержки при развороте объектов.
 *
 * Использует requestIdleCallback для загрузки в idle time браузера.
 */

import { useEffect, useRef, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/modules/cache'
import { getSectionsBatchData } from '../actions'
import type { Project, ProjectObject } from '../types'

// ============================================================================
// Types
// ============================================================================

interface UsePrefetchSectionsBatchOptions {
  /** Включить фоновую предзагрузку */
  enabled?: boolean
  /** Задержка перед началом предзагрузки (мс) */
  initialDelay?: number
  /** Количество объектов за один batch */
  batchSize?: number
  /** Пауза между batches (мс) */
  batchDelay?: number
}

// ============================================================================
// requestIdleCallback polyfill for Safari
// ============================================================================

const requestIdleCallbackPolyfill =
  typeof window !== 'undefined' && 'requestIdleCallback' in window
    ? window.requestIdleCallback
    : (cb: IdleRequestCallback) => setTimeout(() => cb({ didTimeout: false, timeRemaining: () => 50 }), 1)

const cancelIdleCallbackPolyfill =
  typeof window !== 'undefined' && 'cancelIdleCallback' in window
    ? window.cancelIdleCallback
    : clearTimeout

// ============================================================================
// Hook
// ============================================================================

/**
 * Фоновая предзагрузка данных секций для объектов
 *
 * После загрузки графика, в idle time загружает batch данные для первых N объектов.
 * Это устраняет задержку "Загрузка данных..." при развороте объектов.
 *
 * @param projects - Массив проектов с объектами
 * @param options - Опции предзагрузки
 *
 * @example
 * usePrefetchSectionsBatch(projects, { enabled: !isLoading })
 */
export function usePrefetchSectionsBatch(
  projects: Project[] | undefined,
  options: UsePrefetchSectionsBatchOptions = {}
) {
  const {
    enabled = true,
    initialDelay = 2000,
    batchSize = 3,
    batchDelay = 1000,
  } = options

  const queryClient = useQueryClient()
  const prefetchingRef = useRef(false)
  const idleCallbackRef = useRef<number | NodeJS.Timeout | null>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Собираем все объекты из всех проектов
  const getAllObjects = useCallback((): ProjectObject[] => {
    if (!projects) return []

    const objects: ProjectObject[] = []
    for (const project of projects) {
      for (const obj of project.objects) {
        if (obj.sections.length > 0) {
          objects.push(obj)
        }
      }
    }
    return objects
  }, [projects])

  // Проверяем есть ли данные в кеше
  const isInCache = useCallback((objectId: string): boolean => {
    const cached = queryClient.getQueryData(
      queryKeys.resourceGraph.sectionsBatch(objectId)
    )
    return cached !== undefined
  }, [queryClient])

  // Предзагрузка одного объекта
  const prefetchObject = useCallback(async (obj: ProjectObject) => {
    const sectionIds = obj.sections.map(s => s.id)

    try {
      await queryClient.prefetchQuery({
        queryKey: queryKeys.resourceGraph.sectionsBatch(obj.id),
        queryFn: async () => {
          const result = await getSectionsBatchData(sectionIds)
          if (!result.success) {
            throw new Error(result.error)
          }
          return result.data
        },
        staleTime: Infinity,
      })
    } catch (error) {
      // Ignore prefetch errors - не критично
      console.debug('[usePrefetchSectionsBatch] Prefetch failed for object:', obj.id, error)
    }
  }, [queryClient])

  // Основная функция prefetch
  const startPrefetch = useCallback(() => {
    if (prefetchingRef.current) return

    const objects = getAllObjects()
    if (objects.length === 0) return

    prefetchingRef.current = true
    let currentIndex = 0

    const prefetchNext = () => {
      // Находим объекты которые ещё не в кеше
      const toPrefetch: ProjectObject[] = []

      while (toPrefetch.length < batchSize && currentIndex < objects.length) {
        const obj = objects[currentIndex]
        if (!isInCache(obj.id)) {
          toPrefetch.push(obj)
        }
        currentIndex++
      }

      if (toPrefetch.length === 0) {
        prefetchingRef.current = false
        return
      }

      // Prefetch в idle time
      idleCallbackRef.current = requestIdleCallbackPolyfill(async () => {
        await Promise.all(toPrefetch.map(prefetchObject))

        // Продолжаем если есть ещё объекты
        if (currentIndex < objects.length) {
          timeoutRef.current = setTimeout(prefetchNext, batchDelay)
        } else {
          prefetchingRef.current = false
        }
      })
    }

    prefetchNext()
  }, [getAllObjects, isInCache, prefetchObject, batchSize, batchDelay])

  // Запускаем prefetch после initial delay
  useEffect(() => {
    if (!enabled || !projects || projects.length === 0) return

    const timer = setTimeout(startPrefetch, initialDelay)

    return () => {
      clearTimeout(timer)
      if (idleCallbackRef.current) {
        cancelIdleCallbackPolyfill(idleCallbackRef.current as number)
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      prefetchingRef.current = false
    }
  }, [enabled, projects, initialDelay, startPrefetch])
}

// ============================================================================
// Single Object Prefetch Hook
// ============================================================================

/**
 * Хук для prefetch данных одного объекта (при hover)
 *
 * @example
 * const prefetchObject = usePrefetchObjectData()
 * <button onMouseEnter={() => prefetchObject(object)}>Expand</button>
 */
export function usePrefetchObjectData() {
  const queryClient = useQueryClient()

  return useCallback(async (object: ProjectObject) => {
    if (object.sections.length === 0) return

    const sectionIds = object.sections.map(s => s.id)

    // Проверяем есть ли уже в кеше
    const cached = queryClient.getQueryData(
      queryKeys.resourceGraph.sectionsBatch(object.id)
    )
    if (cached) return

    try {
      await queryClient.prefetchQuery({
        queryKey: queryKeys.resourceGraph.sectionsBatch(object.id),
        queryFn: async () => {
          const result = await getSectionsBatchData(sectionIds)
          if (!result.success) {
            throw new Error(result.error)
          }
          return result.data
        },
        staleTime: Infinity,
      })
    } catch {
      // Ignore prefetch errors
    }
  }, [queryClient])
}
