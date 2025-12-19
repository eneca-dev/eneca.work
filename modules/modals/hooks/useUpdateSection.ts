'use client'

/**
 * Hook for updating section data with proper cache invalidation
 */

import { createSimpleMutation, queryKeys } from '@/modules/cache'
import { updateSection, type UpdateSectionInput } from '../actions/updateSection'

// ============================================================================
// Types
// ============================================================================

interface UpdateSectionParams {
  sectionId: string
  data: UpdateSectionInput
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Mutation hook for updating section
 *
 * Invalidates:
 * - sections cache
 * - resource graph cache
 * - projects cache (for tree updates)
 */
export const useUpdateSection = createSimpleMutation<UpdateSectionParams, void>({
  mutationFn: async ({ sectionId, data }) => {
    return updateSection(sectionId, data)
  },
  invalidateKeys: [
    [...queryKeys.sections.all],
    [...queryKeys.resourceGraph.all],
    [...queryKeys.projects.all],
  ],
})
