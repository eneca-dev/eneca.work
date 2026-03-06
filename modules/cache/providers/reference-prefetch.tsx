'use client'

/**
 * ReferencePrefetch - Компонент для отложенного prefetch справочных данных
 *
 * Загружает справочники (категории работ, уровни сложности, статусы этапов,
 * типы чекпоинтов) ПОСЛЕ инициализации приложения, когда браузер свободен.
 *
 * Оптимизации:
 * - Загрузка откладывается через requestIdleCallback (не блокирует основной поток)
 * - Справочники загружаются последовательно с паузой (не шквал параллельных запросов)
 * - Проверка авторизации перед запуском (не грузим для анонимных)
 * - staleTime: infinity — справочники не перезапрашиваются в рамках сессии
 */

import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../keys/query-keys'
import { staleTimePresets } from '../client/query-client'
import { useUserStore } from '@/stores/useUserStore'
import * as Sentry from '@sentry/nextjs'

// Server Actions для справочников
import { getWorkCategories } from '@/modules/modals/actions/getWorkCategories'
import { getDifficultyLevels } from '@/modules/modals/actions/getDifficultyLevels'
import { getStageStatuses } from '@/modules/modals/actions/getStageStatuses'
import { getCheckpointTypes } from '@/modules/checkpoints/actions/checkpoint-types'
import { getUsers } from '../actions/users'
import { getAllReferenceData } from '../actions/reference-data'

/**
 * Хелпер: requestIdleCallback с fallback на setTimeout
 */
function scheduleIdle(callback: () => void): number {
  if (typeof requestIdleCallback !== 'undefined') {
    return requestIdleCallback(callback)
  }
  return window.setTimeout(callback, 2000) as unknown as number
}

function cancelIdle(id: number): void {
  if (typeof cancelIdleCallback !== 'undefined') {
    cancelIdleCallback(id)
  } else {
    clearTimeout(id)
  }
}

/**
 * Пауза между запросами для снижения нагрузки
 */
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

/**
 * Описание одного справочника для prefetch
 */
interface ReferenceConfig {
  queryKey: readonly unknown[]
  queryFn: () => Promise<unknown>
}

export function ReferencePrefetch() {
  const queryClient = useQueryClient()
  const isAuthenticated = useUserStore((state) => state.isAuthenticated)

  useEffect(() => {
    // Не загружаем справочники для неавторизованных пользователей
    if (!isAuthenticated) return

    let cancelled = false
    let idleId: number | null = null

    // Конфигурация справочников
    const references: ReferenceConfig[] = [
      {
        queryKey: queryKeys.workCategories.list(),
        queryFn: async () => {
          const result = await getWorkCategories()
          if (!result.success) throw new Error(result.error)
          return result.data
        },
      },
      {
        queryKey: queryKeys.difficultyLevels.list(),
        queryFn: async () => {
          const result = await getDifficultyLevels()
          if (!result.success) throw new Error(result.error)
          return result.data
        },
      },
      {
        queryKey: queryKeys.stageStatuses.list(),
        queryFn: async () => {
          const result = await getStageStatuses()
          if (!result.success) throw new Error(result.error)
          return result.data
        },
      },
      {
        queryKey: queryKeys.checkpointTypes.list(),
        queryFn: async () => {
          const result = await getCheckpointTypes()
          if (!result.success) throw new Error(result.error)
          return result.data
        },
      },
      {
        queryKey: queryKeys.users.lists(),
        queryFn: async () => {
          const result = await getUsers()
          if (!result.success) throw new Error(result.error)
          return result.data
        },
      },
    ]

    // Последовательная загрузка справочников с паузой между ними
    const prefetchSequentially = async () => {
      // 1. Batch prefetch: departments, teams, positions, categories, subdivisions, roles
      //    Один запрос на сервер вместо 6, результат раскладывается по отдельным ключам
      if (!queryClient.getQueryData(queryKeys.reference.batch())) {
        try {
          const batchResult = await getAllReferenceData()
          if (batchResult.success && batchResult.data) {
            queryClient.setQueryData(queryKeys.reference.batch(), batchResult.data)
            queryClient.setQueryData(queryKeys.departments.list(), batchResult.data.departments)
            queryClient.setQueryData(queryKeys.teams.list(), batchResult.data.teams)
            queryClient.setQueryData(queryKeys.positions.list(), batchResult.data.positions)
            queryClient.setQueryData(queryKeys.categories.list(), batchResult.data.categories)
            queryClient.setQueryData(queryKeys.subdivisions.list(), batchResult.data.subdivisions)
            queryClient.setQueryData(queryKeys.roles.list(), batchResult.data.roles)
          }
        } catch (err) {
          Sentry.addBreadcrumb({ category: 'prefetch', level: 'warning', message: 'Batch reference prefetch failed', data: { error: String(err) } })
        }
        if (!cancelled) await delay(300)
      }

      // 2. Остальные справочники — последовательно
      for (const ref of references) {
        if (cancelled) return

        // Пропускаем если уже в кеше
        if (queryClient.getQueryData(ref.queryKey)) continue

        await queryClient.prefetchQuery({
          queryKey: ref.queryKey,
          queryFn: ref.queryFn,
          staleTime: staleTimePresets.infinity,
        })

        // Пауза 300ms между запросами — даём Supabase «продохнуть»
        if (!cancelled) await delay(300)
      }
    }

    // Откладываем загрузку до момента когда браузер свободен
    idleId = scheduleIdle(() => {
      if (!cancelled) {
        prefetchSequentially()
      }
    })

    return () => {
      cancelled = true
      if (idleId !== null) cancelIdle(idleId)
    }
  }, [queryClient, isAuthenticated])

  return null
}
