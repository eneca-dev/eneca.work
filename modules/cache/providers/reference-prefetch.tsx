'use client'

/**
 * ReferencePrefetch - Компонент для prefetch справочных данных
 *
 * Загружает справочники (категории работ, уровни сложности, статусы этапов,
 * типы чекпоинтов) при старте приложения. Эти данные редко меняются и нужны во многих местах.
 *
 * Размещается в ClientProviders после QueryProvider для preloading данных.
 */

import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../keys/query-keys'
import { staleTimePresets } from '../client/query-client'

// Server Actions для справочников
import { getWorkCategories } from '@/modules/modals/actions/getWorkCategories'
import { getDifficultyLevels } from '@/modules/modals/actions/getDifficultyLevels'
import { getStageStatuses } from '@/modules/modals/actions/getStageStatuses'
import { getCheckpointTypes } from '@/modules/checkpoints/actions/checkpoint-types'
import { getUsers } from '../actions/users'

export function ReferencePrefetch() {
  const queryClient = useQueryClient()

  useEffect(() => {
    // Prefetch справочники если их нет в кеше
    const prefetchReferenceData = async () => {
      // Work Categories
      const categoriesKey = queryKeys.workCategories.list()
      if (!queryClient.getQueryData(categoriesKey)) {
        queryClient.prefetchQuery({
          queryKey: categoriesKey,
          queryFn: async () => {
            const result = await getWorkCategories()
            if (!result.success) throw new Error(result.error)
            return result.data
          },
          staleTime: staleTimePresets.static,
        })
      }

      // Difficulty Levels
      const difficultiesKey = queryKeys.difficultyLevels.list()
      if (!queryClient.getQueryData(difficultiesKey)) {
        queryClient.prefetchQuery({
          queryKey: difficultiesKey,
          queryFn: async () => {
            const result = await getDifficultyLevels()
            if (!result.success) throw new Error(result.error)
            return result.data
          },
          staleTime: staleTimePresets.static,
        })
      }

      // Stage Statuses
      const statusesKey = queryKeys.stageStatuses.list()
      if (!queryClient.getQueryData(statusesKey)) {
        queryClient.prefetchQuery({
          queryKey: statusesKey,
          queryFn: async () => {
            const result = await getStageStatuses()
            if (!result.success) throw new Error(result.error)
            return result.data
          },
          staleTime: staleTimePresets.static,
        })
      }

      // Checkpoint Types - нужны для модалки чекпоинтов
      const checkpointTypesKey = queryKeys.checkpointTypes.list()
      if (!queryClient.getQueryData(checkpointTypesKey)) {
        queryClient.prefetchQuery({
          queryKey: checkpointTypesKey,
          queryFn: async () => {
            const result = await getCheckpointTypes()
            if (!result.success) throw new Error(result.error)
            return result.data
          },
          staleTime: staleTimePresets.static, // 10 минут - типы меняются очень редко
        })
      }

      // Users - нужны для модалок с выбором сотрудников
      const usersKey = queryKeys.users.lists()
      if (!queryClient.getQueryData(usersKey)) {
        queryClient.prefetchQuery({
          queryKey: usersKey,
          queryFn: async () => {
            const result = await getUsers()
            if (!result.success) throw new Error(result.error)
            return result.data
          },
          staleTime: staleTimePresets.static, // 10 минут - пользователи редко меняются
        })
      }
    }

    prefetchReferenceData()
  }, [queryClient])

  return null
}
