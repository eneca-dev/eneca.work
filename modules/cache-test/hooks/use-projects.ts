'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys, type ProjectFilters } from '@/modules/cache'
import {
  getProjects,
  getProjectById,
  updateProject,
  getProjectsWithCounts,
  getProjectStructure,
  type UpdateProjectInput,
} from '@/modules/cache/actions/projects'
import type {
  ProjectListItem,
  Project,
  ProjectWithCounts,
  ProjectStructure,
} from '@/modules/cache/actions/projects'
import { staleTimePresets } from '@/modules/cache/client/query-client'
import { useToast } from '@/hooks/use-toast'

/**
 * Hook для получения списка проектов
 */
export function useProjects(filters?: ProjectFilters) {
  return useQuery({
    queryKey: queryKeys.projects.list(filters),
    queryFn: async () => {
      const result = await getProjects(filters)

      if (!result.success) {
        throw new Error(result.error)
      }

      return result.data
    },
    staleTime: staleTimePresets.medium,
  })
}

/**
 * Hook для получения проекта по ID
 */
export function useProject(projectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.projects.detail(projectId ?? ''),
    queryFn: async () => {
      if (!projectId) {
        throw new Error('Project ID is required')
      }

      const result = await getProjectById(projectId)

      if (!result.success) {
        throw new Error(result.error)
      }

      return result.data
    },
    enabled: !!projectId,
    staleTime: staleTimePresets.medium,
  })
}

/**
 * Hook для обновления проекта с optimistic update
 */
export function useUpdateProject() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async (input: UpdateProjectInput) => {
      const result = await updateProject(input)

      if (!result.success) {
        throw new Error(result.error)
      }

      return result.data
    },

    // Optimistic update
    onMutate: async (newData) => {
      // Отменяем текущие запросы, чтобы они не перезаписали наш optimistic update
      await queryClient.cancelQueries({ queryKey: queryKeys.projects.lists() })

      // Сохраняем предыдущее состояние для отката
      const previousProjects = queryClient.getQueryData<ProjectListItem[]>(
        queryKeys.projects.list()
      )

      // Оптимистично обновляем кеш
      if (previousProjects) {
        queryClient.setQueryData<ProjectListItem[]>(
          queryKeys.projects.list(),
          (old) =>
            old?.map((project) =>
              project.project_id === newData.project_id
                ? { ...project, ...newData }
                : project
            )
        )
      }

      // Возвращаем контекст для отката
      return { previousProjects }
    },

    // При ошибке откатываем к предыдущему состоянию
    onError: (error, _variables, context) => {
      if (context?.previousProjects) {
        queryClient.setQueryData(
          queryKeys.projects.list(),
          context.previousProjects
        )
      }

      toast({
        variant: 'destructive',
        title: 'Ошибка',
        description: error instanceof Error ? error.message : 'Не удалось обновить проект',
      })
    },

    // При успехе показываем уведомление
    onSuccess: (data) => {
      toast({
        title: 'Успешно',
        description: `Проект "${data.project_name}" обновлён`,
      })
    },

    // После завершения (успех или ошибка) инвалидируем кеш для синхронизации
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.lists() })
    },
  })
}

/**
 * Hook для получения списка проектов с подсчётами из view
 */
export function useProjectsWithCounts(filters?: ProjectFilters) {
  return useQuery({
    queryKey: [...queryKeys.projects.list(filters), 'withCounts'],
    queryFn: async () => {
      const result = await getProjectsWithCounts(filters)

      if (!result.success) {
        throw new Error(result.error)
      }

      return result.data
    },
    staleTime: staleTimePresets.medium,
  })
}

/**
 * Hook для получения структуры проекта
 */
export function useProjectStructure(projectId: string | undefined) {
  return useQuery({
    queryKey: [...queryKeys.projects.detail(projectId ?? ''), 'structure'],
    queryFn: async () => {
      if (!projectId) {
        throw new Error('Project ID is required')
      }

      const result = await getProjectStructure(projectId)

      if (!result.success) {
        throw new Error(result.error)
      }

      return result.data
    },
    enabled: !!projectId,
    staleTime: staleTimePresets.medium,
  })
}

// Re-export types for convenience
export type { ProjectListItem, Project, ProjectWithCounts, ProjectStructure, UpdateProjectInput }
