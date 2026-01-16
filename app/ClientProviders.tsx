"use client";

import { ThemeProvider } from "@/components/theme-provider";
import { ThemeSync } from "@/components/theme-sync";
import { Toaster } from "@/components/ui/toaster";
import { GlobalNotification } from "@/components/ui/notification";
import { NoSSR } from "@/components/NoSSR";
import { UserPermissionsSyncProvider } from "@/modules/permissions";
import { FeedbackProvider } from "@/modules/feedback/FeedbackProvider";
import { QueryProvider, RealtimeSync, ReferencePrefetch } from "@/modules/cache";
import { AuthProvider } from "@/modules/auth";

/**
 * Клиентские провайдеры приложения
 *
 * Порядок провайдеров важен:
 * 1. QueryProvider — базовый кеш для всех данных
 * 2. ThemeProvider — тема приложения
 * 3. AuthProvider — централизованная авторизация (onAuthStateChange)
 * 4. RealtimeSync — подписка на изменения БД
 * 5. UserPermissionsSyncProvider — загрузка permissions после авторизации
 * 6. FeedbackProvider — система обратной связи
 */
export default function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <ThemeProvider attribute="class" defaultTheme="dark" forcedTheme="dark">
        <NoSSR>
          {/* AuthProvider ПЕРВЫЙ — слушает auth события и синхронизирует store */}
          <AuthProvider>
            <RealtimeSync />
            <ReferencePrefetch />
            {/* Permissions загружаются ПОСЛЕ авторизации */}
            <UserPermissionsSyncProvider>
              <FeedbackProvider>
                <ThemeSync />
                {children}
                <Toaster />
                <GlobalNotification />
              </FeedbackProvider>
            </UserPermissionsSyncProvider>
          </AuthProvider>
        </NoSSR>
      </ThemeProvider>
    </QueryProvider>
  );
}
