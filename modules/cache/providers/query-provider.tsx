'use client'

import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { getQueryClient } from '../client/query-client'
import { RealtimeSync } from '../realtime'

interface QueryProviderProps {
  children: React.ReactNode
  /** Отключить Realtime синхронизацию (по умолчанию включена) */
  disableRealtime?: boolean
}

/**
 * QueryProvider для приложения
 *
 * Оборачивает приложение в QueryClientProvider с правильной
 * конфигурацией для SSR и клиентского рендеринга.
 *
 * Включает:
 * - DevTools в режиме разработки
 * - Realtime синхронизацию с Supabase (можно отключить)
 */
export function QueryProvider({ children, disableRealtime = false }: QueryProviderProps) {
  // NOTE: Не используем useState для инициализации клиента,
  // чтобы избежать проблем с Suspense
  const queryClient = getQueryClient()

  return (
    <QueryClientProvider client={queryClient}>
      {/* Realtime синхронизация кеша */}
      {!disableRealtime && <RealtimeSync />}

      {children}

      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
      )}
    </QueryClientProvider>
  )
}
