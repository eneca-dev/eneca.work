import type { PaginatedActionResult } from '../types'

/**
 * Обработка ошибки Supabase
 */
export function handleSupabaseError(error: {
  message: string
  code?: string
  details?: string
}): string {
  // Маппинг типичных ошибок Supabase на человекочитаемые сообщения
  const errorMessages: Record<string, string> = {
    'PGRST116': 'Запись не найдена',
    '23505': 'Запись с такими данными уже существует',
    '23503': 'Невозможно удалить: есть связанные записи',
    '42501': 'Недостаточно прав для выполнения операции',
    'JWT expired': 'Сессия истекла, необходимо войти заново',
  }

  if (error.code && errorMessages[error.code]) {
    return errorMessages[error.code]
  }

  return error.message || 'Ошибка при выполнении запроса'
}

/**
 * Хелпер для создания пагинированного результата
 */
export function createPaginatedResult<T>(
  data: T[],
  total: number,
  page: number,
  pageSize: number
): PaginatedActionResult<T> {
  return {
    success: true,
    data,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  }
}
