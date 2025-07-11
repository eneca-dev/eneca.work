"use client";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeSync } from "@/components/theme-sync";
import { Toaster } from "@/components/ui/toaster";
import { NotificationsProvider } from "@/modules/notifications/components/NotificationsProvider";

export default function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <ThemeSync />
      <NotificationsProvider>
        {children}
      </NotificationsProvider>
      <Toaster />
    </ThemeProvider>
  );
} 