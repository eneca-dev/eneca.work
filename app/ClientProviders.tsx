"use client";
import { Provider } from "react-redux";
import { store } from "@/store";
import { ThemeProvider } from "@/components/theme-provider";

export default function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <Provider store={store}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        {children}
      </ThemeProvider>
    </Provider>
  );
} 