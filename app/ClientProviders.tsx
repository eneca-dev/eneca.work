"use client";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeSync } from "@/components/theme-sync";
import { Toaster } from "@/components/ui/toaster";
import { GlobalNotification } from "@/components/ui/notification";
import { NoSSR } from "@/components/NoSSR";

export default function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <NoSSR>
        <ThemeSync />
        {children}
        <Toaster />
        <GlobalNotification />
      </NoSSR>
    </ThemeProvider>
  );
} 