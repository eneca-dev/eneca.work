'use client'

import {
  createSimpleCacheQuery,
  createDetailCacheQuery,
  createSimpleMutation,
  createDeleteMutation,
  queryKeys,
  staleTimePresets,
} from '@/modules/cache'
import {
  getTemplatesList,
  getTemplateDetail,
  createTemplate,
  removeTemplate,
  applyTemplateToSection,
} from '../actions/templates'
import { getDepartmentsList, type Department } from '../actions/departments'
import type { TemplateListItem, TemplateDetail, TemplateStage, Stage } from '../types'

// ============================================================================
// Query Hooks
// ============================================================================

/**
 * Хук для получения списка шаблонов
 *
 * @example
 * const { data: templates, isLoading } = useTemplatesList()
 */
export const useTemplatesList = createSimpleCacheQuery<TemplateListItem[]>({
  queryKey: queryKeys.decTemplates.lists(),
  queryFn: getTemplatesList,
  staleTime: staleTimePresets.medium,
})

/**
 * Хук для получения деталей шаблона по ID
 *
 * @example
 * const { data: template, isLoading } = useTemplateDetail(templateId)
 */
export const useTemplateDetail = createDetailCacheQuery<TemplateDetail>({
  queryKey: (id) => queryKeys.decTemplates.detail(id),
  queryFn: getTemplateDetail,
  staleTime: staleTimePresets.medium,
})

/**
 * Хук для получения списка отделов
 * Кешируется на Infinity - отделы не меняются в рамках сессии
 *
 * @example
 * const { data: departments, isLoading } = useDepartmentsList()
 */
export const useDepartmentsList = createSimpleCacheQuery<Department[]>({
  queryKey: queryKeys.departments.list(),
  queryFn: getDepartmentsList,
  staleTime: staleTimePresets.infinity,
})

// ============================================================================
// Mutation Hooks
// ============================================================================

/**
 * Хук для создания шаблона
 *
 * @example
 * const { mutateAsync: createTemplateFn, isPending } = useCreateTemplate()
 * await createTemplateFn({ name, departmentId, stages })
 */
export const useCreateTemplate = createSimpleMutation<
  { name: string; departmentId: string; stages: TemplateStage[] },
  { id: string }
>({
  mutationFn: createTemplate,
  invalidateKeys: [queryKeys.decTemplates.all],
})

/**
 * Хук для удаления шаблона с optimistic update
 *
 * @example
 * const { mutateAsync: deleteTemplateFn, isPending } = useDeleteTemplate()
 * await deleteTemplateFn({ templateId })
 */
export const useDeleteTemplate = createDeleteMutation<
  { templateId: string },
  { id: string }
>({
  mutationFn: removeTemplate,
  listQueryKey: queryKeys.decTemplates.lists(),
  getId: (input) => input.templateId,
  getItemId: (item) => item.id,
  invalidateKeys: [queryKeys.decTemplates.all],
})

/**
 * Хук для применения шаблона к разделу
 *
 * @example
 * const { mutateAsync: applyTemplateFn, isPending } = useApplyTemplate()
 * const newStages = await applyTemplateFn({ templateId, sectionId, statusId })
 */
export const useApplyTemplate = createSimpleMutation<
  { templateId: string; sectionId: string; statusId: string | null },
  Stage[]
>({
  mutationFn: applyTemplateToSection,
  invalidateKeys: (input) => [
    queryKeys.sections.decomposition(input.sectionId),
    queryKeys.decomposition.stages(input.sectionId),
  ],
})
