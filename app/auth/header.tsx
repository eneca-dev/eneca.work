"use client"

import { ThemeToggle } from "@/components/theme-toggle"

export function AuthHeader() {
  return (
    <div className="absolute top-4 right-4 z-10">
      <ThemeToggle />
    </div>
  )
}
