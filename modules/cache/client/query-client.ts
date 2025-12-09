import { QueryClient, isServer } from '@tanstack/react-query'

/**
 * Конфигурация staleTime для разных типов данных
 */
export const staleTimePresets = {
  /** Справочники - редко меняются */
  static: 10 * 60 * 1000, // 10 минут

  /** Профили, настройки */
  slow: 5 * 60 * 1000, // 5 минут

  /** Проекты, основные сущности */
  medium: 3 * 60 * 1000, // 3 минуты

  /** Разделы, часто редактируемые данные */
  fast: 2 * 60 * 1000, // 2 минуты

  /** Загрузки, активно меняющиеся данные */
  realtime: 1 * 60 * 1000, // 1 минута

  /** Уведомления - всегда свежие */
  none: 0,
} as const

/**
 * Создание QueryClient с оптимальными настройками
 */
function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Данные считаются свежими 3 минуты по умолчанию
        staleTime: staleTimePresets.medium,

        // Время хранения неактивных данных в кеше - 30 минут
        gcTime: 30 * 60 * 1000,

        // Повторные попытки при ошибке
        retry: (failureCount, error) => {
          // Не повторяем для 4xx ошибок (клиентские ошибки)
          if (error instanceof Error && error.message.includes('4')) {
            return false
          }
          return failureCount < 3
        },

        // Экспоненциальная задержка между попытками
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),

        // Обновлять при возврате на вкладку
        refetchOnWindowFocus: true,

        // Не обновлять при восстановлении соединения автоматически
        refetchOnReconnect: 'always',
      },
      mutations: {
        // Повторные попытки для мутаций
        retry: 1,
        retryDelay: 1000,
      },
    },
  })
}

// Singleton для браузера
let browserQueryClient: QueryClient | undefined = undefined

/**
 * Получить QueryClient
 *
 * - На сервере: всегда создаёт новый клиент
 * - В браузере: использует singleton
 */
export function getQueryClient(): QueryClient {
  if (isServer) {
    // Сервер: всегда новый клиент
    return makeQueryClient()
  }

  // Браузер: singleton паттерн
  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient()
  }

  return browserQueryClient
}

/**
 * Сбросить QueryClient (для тестов или logout)
 */
export function resetQueryClient(): void {
  if (browserQueryClient) {
    browserQueryClient.clear()
    browserQueryClient = undefined
  }
}
