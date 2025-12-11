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
