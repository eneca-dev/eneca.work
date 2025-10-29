"use client";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeSync } from "@/components/theme-sync";
import { Toaster } from "@/components/ui/toaster";
import { GlobalNotification } from "@/components/ui/notification";
import { NoSSR } from "@/components/NoSSR";
import { UserPermissionsSyncProvider } from "@/modules/permissions";
import { FeedbackProvider } from "@/modules/feedback/FeedbackProvider";


export default function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <NoSSR>
        <UserPermissionsSyncProvider>
          <FeedbackProvider>
            <ThemeSync />
            {children}
            <Toaster />
            <GlobalNotification />
          </FeedbackProvider>
        </UserPermissionsSyncProvider>
      </NoSSR>
    </ThemeProvider>
  );
} 