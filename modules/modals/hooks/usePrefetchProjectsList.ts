'use client'

/**
 * Префетч данных модалки создания загрузки (в idle после отрисовки страницы,
 * на «Разделах» и «Отделах»):
 *   1. списки проектов — 'my' (режим по умолчанию) + 'all' (на случай переключения);
 *   2. деревья «Моих» проектов — чтобы они раскрывались в модалке без загрузки.
 *
 * Всё греется последовательно (один getFilterContext за раз, без пачки). «Все» деревья
 * НЕ греем — их слишком много (~132). Ключи/queryFn совпадают с useProjectsList /
 * projectTreeQueryOptions, gcTime: Infinity — данные живут всю сессию.
 */

import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/modules/cache'
import { useUserStore } from '@/stores/useUserStore'
import { fetchProjectsListRPC } from '../actions/projects-tree-rpc'
import type { ProjectListItem } from '../actions/projects-tree'
import { projectTreeQueryOptions } from './useProjectTree'

export function usePrefetchProjectsList() {
  const queryClient = useQueryClient()
  const userId = useUserStore((s) => s.id)

  return useCallback(async () => {
    if (!userId?.trim()) return
    // Модалка открывается в 'my', но может переключиться на 'all' — греем оба режима
    // последовательно (один getFilterContext за раз, без пачки).
    for (const mode of ['my', 'all'] as const) {
      await queryClient
        .prefetchQuery({
          queryKey: queryKeys.projects.listForModal(mode, userId),
          queryFn: async () => {
            const res = await fetchProjectsListRPC({ mode, userId })
            if (!res.success) throw new Error(res.error)
            return res.data
          },
          staleTime: 5 * 60 * 1000,
          gcTime: Infinity, // держим тёплым всю сессию (как useProjectsList)
        })
        .catch(() => {})
    }

    // Деревья «Моих» проектов (ограниченный набор) → раскрываются в модалке без загрузки.
    // Последовательно, в простое → без пачки getFilterContext. «Все» НЕ греем (132 проекта).
    const myProjects = queryClient.getQueryData<ProjectListItem[]>(
      queryKeys.projects.listForModal('my', userId)
    )
    for (const project of myProjects ?? []) {
      await queryClient.prefetchQuery(projectTreeQueryOptions(project.id)).catch(() => {})
    }
  }, [queryClient, userId])
}
