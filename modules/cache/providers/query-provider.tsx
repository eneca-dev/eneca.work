'use client'

import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { getQueryClient } from '../client/query-client'

interface QueryProviderProps {
  children: React.ReactNode
}

/**
 * QueryProvider для приложения
 *
 * Оборачивает приложение в QueryClientProvider с правильной
 * конфигурацией для SSR и клиентского рендеринга.
 *
 * Включает:
 * - DevTools в режиме разработки
 *
 * NOTE: RealtimeSync рендерится ОТДЕЛЬНО в app/ClientProviders.tsx (ровно один раз),
 * после AuthProvider — чтобы подписка стартовала после установки auth-сессии.
 * Здесь его НЕ рендерим, иначе будет двойная подписка на канал cache-sync (bug-SB-02).
 */
export function QueryProvider({ children }: QueryProviderProps) {
  // NOTE: Не используем useState для инициализации клиента,
  // чтобы избежать проблем с Suspense
  const queryClient = getQueryClient()

  return (
    <QueryClientProvider client={queryClient}>
      {children}

      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
      )}
    </QueryClientProvider>
  )
}
