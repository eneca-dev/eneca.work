/**
 * Типы для cross-department loading access grants.
 * Вынесены в отдельный файл, потому что 'use server' запрещает
 * экспортировать что-либо кроме async-функций.
 */

export interface LoadingAccessGrantRow {
  grant_id: string
  employee_id: string
  granted_to_department_id: string
  granted_to_department_name: string | null
  granted_by: string
  granted_by_name: string | null
  created_at: string
}

export interface CreateLoadingAccessGrantInput {
  employee_id: string
  granted_to_department_id: string
}
