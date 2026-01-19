'use client'

/**
 * Loading Modal 2 - Hook для создания этапов декомпозиции
 *
 * Предоставляет мутацию для создания новых этапов внутри разделов
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/modules/cache'
import { createDecompositionStageFromModal } from '../actions'
import type {
  CreateDecompositionStageFromModalInput,
  DecompositionStageResult,
} from '../actions'

export interface UseDecompositionStageMutationsOptions {
  /** Callback при успешном создании */
  onCreateSuccess?: (data: DecompositionStageResult) => void
  /** Callback при ошибке */
  onError?: (error: Error) => void
}

export function useDecompositionStageMutations(
  options: UseDecompositionStageMutationsOptions = {}
) {
  const queryClient = useQueryClient()

  const create = useMutation({
    mutationFn: async (input: CreateDecompositionStageFromModalInput) => {
      const result = await createDecompositionStageFromModal(input)

      if (!result.success) {
        throw new Error(result.error)
      }

      return result.data
    },
    onSuccess: (data) => {
      // Инвалидация кешей проектов и разделов
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.sections.all })

      options.onCreateSuccess?.(data)
    },
    onError: (error: Error) => {
      options.onError?.(error)
    },
  })

  return {
    create,
  }
}

export type { CreateDecompositionStageFromModalInput, DecompositionStageResult }
