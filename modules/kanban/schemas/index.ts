/**
 * Kanban Module - Zod Schemas
 *
 * Схемы валидации для форм и API
 */

import { z } from 'zod'

// ============================================================================
// Stage Status Schema
// ============================================================================

export const stageStatusSchema = z.enum([
  'backlog',
  'planned',
  'in_progress',
  'paused',
  'review',
  'done',
])

export type StageStatusSchema = z.infer<typeof stageStatusSchema>

// ============================================================================
// Section Status Schema
// ============================================================================

export const sectionStatusSchema = z.enum([
  'planned',
  'in_progress',
  'paused',
  'suspended',
  'done',
])

export type SectionStatusSchema = z.infer<typeof sectionStatusSchema>

// ============================================================================
// Task Schemas
// ============================================================================

export const updateTaskProgressSchema = z.object({
  taskId: z.string().uuid(),
  stageId: z.string().uuid(),
  sectionId: z.string().uuid(),
  progress: z.number().min(0).max(100),
})

export type UpdateTaskProgressInput = z.infer<typeof updateTaskProgressSchema>

export const updateTaskPlannedHoursSchema = z.object({
  taskId: z.string().uuid(),
  stageId: z.string().uuid(),
  sectionId: z.string().uuid(),
  plannedHours: z.number().min(0),
})

export type UpdateTaskPlannedHoursInput = z.infer<typeof updateTaskPlannedHoursSchema>

// ============================================================================
// Stage Schemas
// ============================================================================

export const updateStageStatusSchema = z.object({
  stageId: z.string().uuid(),
  sectionId: z.string().uuid(),
  newStatus: stageStatusSchema,
})

export type UpdateStageStatusInput = z.infer<typeof updateStageStatusSchema>

// ============================================================================
// Filter Schemas
// ============================================================================

export const kanbanFiltersSchema = z.object({
  project_id: z.string().uuid().optional(),
  responsible_id: z.string().uuid().optional(),
  subdivision_id: z.string().uuid().optional(),
  status: sectionStatusSchema.optional(),
})

export type KanbanFiltersInput = z.infer<typeof kanbanFiltersSchema>
