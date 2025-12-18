// modules/checkpoints/types/index.ts

import type { Database } from '@/types/db'
import type { BaseFilters } from '@/modules/cache/types'

// ============================================================================
// 1. BASE TYPES (из таблиц БД)
// ============================================================================

/** Тип чекпоинта из справочника */
export type CheckpointType = Database['public']['Tables']['checkpoint_types']['Row']

/** Чекпоинт (base, без computed fields) */
export type CheckpointBase = Database['public']['Tables']['section_checkpoints']['Row']

/** Связь чекпоинта с разделами */
export type CheckpointSectionLink = Database['public']['Tables']['checkpoint_section_links']['Row']

/** Запись аудита */
export type CheckpointAuditBase = Database['public']['Tables']['checkpoint_audit']['Row']

// ============================================================================
// 2. COMPUTED TYPES (из VIEW view_section_checkpoints)
// ============================================================================

/** Статус чекпоинта (computed) */
export type CheckpointStatus = 'pending' | 'completed' | 'completed_late' | 'overdue'

/** Связанный раздел для чекпоинта */
export interface LinkedSection {
  section_id: string
  section_code: string
  section_name: string
}

/** Полный чекпоинт с computed полями и JOIN данными */
export interface Checkpoint extends CheckpointBase {
  // Поля типа (JOIN checkpoint_types)
  type_code: string
  type_name: string
  is_custom: boolean
  icon: string
  color: string

  // Computed поля
  status: CheckpointStatus
  status_label: string

  // Контекст разрешений (JOIN sections/projects/profiles)
  section_responsible: string | null        // responsible.id
  project_manager: string | null            // manager.id

  // Связанные разделы (aggregated)
  linked_sections: LinkedSection[]
  linked_sections_count: number
}

/** Запись аудита с данными пользователя */
export interface AuditEntry extends CheckpointAuditBase {
  // JOIN profiles
  user_firstname: string | null
  user_lastname: string | null
  user_avatar_url: string | null
}

// ============================================================================
// 3. FILTER TYPES
// ============================================================================

export interface CheckpointFilters extends BaseFilters {
  section_id?: string                        // Фильтр по разделу
  type_id?: string                           // Фильтр по типу
  status?: CheckpointStatus | CheckpointStatus[]  // Фильтр по статусу
  date_from?: string                         // Фильтр "с даты" (ISO)
  date_to?: string                           // Фильтр "по дату" (ISO)
  is_custom?: boolean                        // Только custom типы?
  has_linked_sections?: boolean              // Только с связанными разделами?
}

// ============================================================================
// 4. FORM INPUT TYPES
// ============================================================================

/** Данные для создания чекпоинта */
export interface CreateCheckpointInput {
  section_id: string
  type_id: string
  title?: string                             // Optional для предустановленных типов
  description?: string
  checkpoint_date: string                    // ISO date string
  linked_section_ids?: string[]              // M:N связи
}

/** Данные для обновления чекпоинта */
export interface UpdateCheckpointInput {
  checkpoint_id: string
  title?: string
  description?: string
  checkpoint_date?: string
  type_id?: string
  linked_section_ids?: string[]
}

/** Данные для завершения чекпоинта */
export interface CompleteCheckpointInput {
  checkpoint_id: string
  completed_at?: string                      // Default = NOW()
}

/** Данные для создания типа чекпоинта */
export interface CreateCheckpointTypeInput {
  code: string
  name: string
  icon: string
  color: string
  is_custom?: boolean                        // Default = true (admin-created)
}

/** Данные для обновления типа чекпоинта */
export interface UpdateCheckpointTypeInput {
  type_id: string
  name?: string
  icon?: string
  color?: string
}
