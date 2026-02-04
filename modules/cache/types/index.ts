/**
 * Типы для модуля кеширования
 */

import type { Database } from '@/types/db'

// ============================================================================
// Database Type Helpers
// ============================================================================

/** Извлекает тип строки из таблицы */
export type TableRow<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']

/** Извлекает тип для INSERT из таблицы */
export type TableInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']

/** Извлекает тип для UPDATE из таблицы */
export type TableUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update']

/** Извлекает тип строки из view */
export type ViewRow<T extends keyof Database['public']['Views']> =
  Database['public']['Views'][T]['Row']

/** Извлекает тип enum */
export type DbEnum<T extends keyof Database['public']['Enums']> =
  Database['public']['Enums'][T]

// ============================================================================
// Common DB Types
// ============================================================================

/** Статус проекта из БД */
export type ProjectStatusEnum = DbEnum<'project_status_enum'>

/** Строка из таблицы projects */
export type ProjectRow = TableRow<'projects'>

/** Строка из view v_cache_projects */
export type CacheProjectViewRow = ViewRow<'v_cache_projects'>

// ============================================================================
// Action Result Types
// ============================================================================

/**
 * Результат Server Action
 * Все actions возвращают этот тип для единообразной обработки
 */
export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string }

/**
 * Результат Server Action с пагинацией
 */
export type PaginatedActionResult<T> =
  | {
      success: true
      data: T[]
      pagination: {
        page: number
        pageSize: number
        total: number
        totalPages: number
      }
    }
  | { success: false; error: string }

/**
 * Тип успешного результата с пагинацией (для работы с кэшированными данными)
 * Используется когда данные уже в кэше и success: true гарантирован
 */
export type CachedPaginatedData<T> = Extract<PaginatedActionResult<T>, { success: true }>

/**
 * Базовые фильтры для списков
 */
export interface BaseFilters {
  page?: number
  pageSize?: number
  search?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

/**
 * Payload от Supabase Realtime
 */
export interface RealtimePayload<T = Record<string, unknown>> {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE'
  new: T
  old: T
  table: string
  schema: string
}

/**
 * Конфигурация для подписки на realtime
 */
export interface RealtimeSubscriptionConfig {
  table: string
  event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*'
  filter?: string
}

/**
 * Preset конфигурации для staleTime
 */
export type StaleTimePreset = 'static' | 'slow' | 'medium' | 'fast' | 'realtime' | 'none'
