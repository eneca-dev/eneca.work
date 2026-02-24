"use client";

import * as React from "react";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { cn } from "../lib/utils";

export type Toast = {
  id: string;
  title?: string;
  description?: string;
  variant?: "default" | "destructive";
};

type ToastContextValue = {
  toasts: Toast[];
  add: (t: Omit<Toast, "id">) => void;
  remove: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const add = useCallback(
    (t: Omit<Toast, "id">) => {
      const id = Math.random().toString(36).slice(2);
      setToasts((prev) => [...prev, { id, ...t }]);
      setTimeout(() => remove(id), 3000);
    },
    [remove]
  );

  const value = useMemo(() => ({ toasts, add, remove }), [toasts, add, remove]);

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return {
    toast: ({ title, description, variant }: Omit<Toast, "id">) => ctx.add({ title, description, variant }),
  };
}

export function Toaster() {
  const ctx = useContext(ToastContext);
  if (!ctx) return null;
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {ctx.toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            "min-w-[260px] rounded-md border bg-card dark:bg-slate-900 text-card-foreground shadow px-4 py-3",
            t.variant === "destructive" && "border-destructive/50 bg-destructive/10 dark:bg-destructive/20 text-destructive"
          )}
        >
          {t.title && <div className="text-sm font-medium">{t.title}</div>}
          {t.description && <div className="text-sm opacity-80">{t.description}</div>}
        </div>
      ))}
    </div>
  );
}


