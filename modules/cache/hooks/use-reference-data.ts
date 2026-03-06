'use client'

/**
 * Cached hooks for reference data (departments, teams, positions, categories, subdivisions, roles)
 *
 * staleTime: static (10 мин) — справочники меняются редко.
 * Все компоненты, использующие эти хуки, разделяют один кеш —
 * никаких дублирующих запросов при монтировании разных компонентов.
 *
 * useAllReferenceData() — batch-хук: 1 запрос на сервер вместо 6,
 * результат раскладывается по отдельным ключам кеша для совместимости
 * с индивидуальными хуками.
 */

import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createSimpleCacheQuery } from './use-cache-query'
import { queryKeys } from '../keys/query-keys'
import { staleTimePresets } from '../client/query-client'
import {
  getDepartments,
  getTeams,
  getPositions,
  getCategories,
  getSubdivisions,
  getRoles,
  getAllReferenceData,
  type AllReferenceData,
} from '../actions/reference-data'
import type { QueryHookOptions } from './use-cache-query'

// ============================================================================
// Индивидуальные хуки (обратная совместимость)
// ============================================================================

export const useCachedDepartments = createSimpleCacheQuery({
  queryKey: queryKeys.departments.list(),
  queryFn: getDepartments,
  staleTime: staleTimePresets.static,
})

export const useCachedTeams = createSimpleCacheQuery({
  queryKey: queryKeys.teams.list(),
  queryFn: getTeams,
  staleTime: staleTimePresets.static,
})

export const useCachedPositions = createSimpleCacheQuery({
  queryKey: queryKeys.positions.list(),
  queryFn: getPositions,
  staleTime: staleTimePresets.static,
})

export const useCachedCategories = createSimpleCacheQuery({
  queryKey: queryKeys.categories.list(),
  queryFn: getCategories,
  staleTime: staleTimePresets.static,
})

export const useCachedSubdivisions = createSimpleCacheQuery({
  queryKey: queryKeys.subdivisions.list(),
  queryFn: getSubdivisions,
  staleTime: staleTimePresets.static,
})

export const useCachedRoles = createSimpleCacheQuery({
  queryKey: queryKeys.roles.list(),
  queryFn: getRoles,
  staleTime: staleTimePresets.static,
})

// ============================================================================
// Batch хук — 1 запрос вместо 6
// ============================================================================

/**
 * Загружает все справочники одним запросом и раскладывает по отдельным ключам кеша.
 * Используй вместо 6 отдельных useCached* хуков, когда нужны все справочники сразу.
 *
 * @example
 * const { departments, teams, positions, categories, subdivisions, roles, isLoading } =
 *   useAllReferenceData({ enabled: open })
 */
export function useAllReferenceData(options?: QueryHookOptions<AllReferenceData>) {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: queryKeys.reference.batch(),
    queryFn: async () => {
      const result = await getAllReferenceData()
      if (!result.success) {
        throw new Error(result.error)
      }
      return result.data
    },
    staleTime: staleTimePresets.static,
    enabled: options?.enabled,
    ...options?.queryOptions,
  })

  // Раскладываем batch-результат по индивидуальным ключам кеша
  // чтобы useCachedDepartments() и прочие получали данные без дополнительных запросов
  useEffect(() => {
    if (!query.data) return

    const entries: [readonly unknown[], unknown][] = [
      [queryKeys.departments.list(), query.data.departments],
      [queryKeys.teams.list(), query.data.teams],
      [queryKeys.positions.list(), query.data.positions],
      [queryKeys.categories.list(), query.data.categories],
      [queryKeys.subdivisions.list(), query.data.subdivisions],
      [queryKeys.roles.list(), query.data.roles],
    ]

    for (const [key, data] of entries) {
      // Не перезаписываем если данные уже в кеше и свежие
      const existing = queryClient.getQueryData(key)
      if (!existing) {
        queryClient.setQueryData(key, data)
      }
    }
  }, [query.data, queryClient])

  return {
    departments: query.data?.departments ?? [],
    teams: query.data?.teams ?? [],
    positions: query.data?.positions ?? [],
    categories: query.data?.categories ?? [],
    subdivisions: query.data?.subdivisions ?? [],
    roles: query.data?.roles ?? [],
    isLoading: query.isLoading,
    isPending: query.isPending,
    error: query.error,
  }
}
