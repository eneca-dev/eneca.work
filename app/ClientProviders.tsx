"use client";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeSync } from "@/components/theme-sync";
import { Toaster } from "@/components/ui/toaster";
import { GlobalNotification } from "@/components/ui/notification";
import { NoSSR } from "@/components/NoSSR";
import { useEffect } from "react";
import GlobalPermissionsDebug from "@/components/debug/GlobalPermissionsDebug";
import { UserPermissionsSyncProvider } from "@/modules/permissions";

export default function ClientProviders({ children }: { children: React.ReactNode }) {
  // Подавляем ошибки React о дублированных ключах (временное решение)
  useEffect(() => {
    const originalConsoleError = console.error;
    console.error = (...args) => {
      // Игнорируем ошибки о дублированных ключах
      const message = args.join(' ');
      if (message.includes('Encountered two children with the same key') ||
          message.includes('Keys should be unique so that components maintain their identity')) {
        console.log('🔇 Подавлена ошибка React о дублированных ключах:', message);
        return;
      }
      // Передаем остальные ошибки как обычно
      originalConsoleError.apply(console, args);
    };

    // Очистка при размонтировании
    return () => {
      console.error = originalConsoleError;
    };
  }, []);

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <NoSSR>
        <UserPermissionsSyncProvider>
          <ThemeSync />
          {children}
          <Toaster />
          <GlobalNotification />
          {/* Глобальное всплывающее окно дебага permissions */}
          <GlobalPermissionsDebug />
        </UserPermissionsSyncProvider>
      </NoSSR>
    </ThemeProvider>
  );
} 