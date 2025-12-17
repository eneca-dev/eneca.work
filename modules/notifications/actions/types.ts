/**
 * Types for notifications module Server Actions
 *
 * @module modules/notifications/actions/types
 */

import type { Database } from '@/types/db'
import type { Notification } from '../utils/transform'

// ============================================================================
// Database Types
// ============================================================================

/**
 * User notification with full notification data and entity type
 * Result of JOIN query: user_notifications -> notifications -> entity_types
 */
export type UserNotificationWithNotification =
  Database['public']['Tables']['user_notifications']['Row'] & {
    notifications: Database['public']['Tables']['notifications']['Row'] & {
      entity_types: Database['public']['Tables']['entity_types']['Row']
    }
  }

// ============================================================================
// Query Filter Types
// ============================================================================

/**
 * Filter options for notification queries
 *
 * @example
 * ```typescript
 * const filters: NotificationFilters = {
 *   onlyUnread: true,
 *   includeArchived: false,
 *   types: ['announcement', 'section_comment'],
 *   page: 1,
 *   pageSize: 20
 * }
 * ```
 */
export interface NotificationFilters {
  /** Filter to show only unread notifications */
  onlyUnread?: boolean

  /** Include archived notifications in results */
  includeArchived?: boolean

  /** Filter by entity types (e.g., ['announcement', 'assignment']) */
  types?: string[]

  /** Page number for pagination (1-indexed) */
  page?: number

  /** Number of items per page (default: 20) */
  pageSize?: number
}

/**
 * Options for getNotificationTypeCounts query
 */
export interface TypeCountsOptions {
  /** Include archived notifications in type counts */
  includeArchived?: boolean
}

// ============================================================================
// Mutation Input Types
// ============================================================================

/**
 * Input for markAsRead and markAsUnread mutations
 */
export interface MarkAsReadInput {
  /** user_notifications.id (NOT notification_id) */
  id: string
}

/**
 * Input for archiveNotification mutation
 */
export interface ArchiveNotificationInput {
  /** user_notifications.id */
  id: string

  /** Archive status to set */
  isArchived: boolean

  /** Full notification object for optimistic updates (optional) */
  notification?: Notification
}

// ============================================================================
// UI Types (for backwards compatibility during migration)
// ============================================================================

/**
 * Transformed notification item for UI consumption
 * Alias for UserNotificationWithNotification
 *
 * @deprecated Use UserNotificationWithNotification directly
 */
export type NotificationItem = UserNotificationWithNotification

// ============================================================================
// RPC Function Types
// ============================================================================

/**
 * Result type from get_user_notifications_filtered RPC function
 * Returns flat structure with prefixed columns (n_ for notifications fields)
 *
 * @see supabase/migrations/2025-12-12_add_get_user_notifications_filtered_rpc.sql
 */
export interface RpcNotificationRow {
  // user_notifications columns
  id: string
  notification_id: string
  user_id: string
  is_read: boolean
  is_archived: boolean
  created_at: string
  updated_at: string

  // notifications columns (prefixed with n_)
  n_entity_type_id: string
  n_payload: Record<string, any>
  n_rendered_text: string | null
  n_created_at: string
  n_source_comment_id: string | null

  // entity_types columns
  entity_type_name: string

  // Total count (window function returns same value in all rows)
  total_count: number
}
