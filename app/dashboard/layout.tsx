"use client"

import { useState, useEffect } from "react"
import { Sidebar } from "@/components/sidebar"
import { createClient } from "@/utils/supabase/client"
import { useRouter } from "next/navigation"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [user, setUser] = useState<any>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const fetchUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push("/auth/login")
        return
      }

      // Get user metadata
      const { data: userData } = await supabase.from("profiles").select("*").eq("id", user.id).single()

      setUser({
        name: userData?.name || user.user_metadata?.name || "Пользователь",
        email: user.email,
      })
    }

    fetchUser()
    setMounted(true)

    // Отслеживание изменения ширины бокового меню
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === "attributes" && mutation.attributeName === "class") {
          const sidebar = document.querySelector("[data-sidebar]")
          if (sidebar) {
            const isCollapsed = sidebar.classList.contains("w-20")
            setSidebarCollapsed(isCollapsed)
          }
        }
      })
    })

    const sidebar = document.querySelector("[data-sidebar]")
    if (sidebar) {
      observer.observe(sidebar, { attributes: true })
    }

    return () => {
      observer.disconnect()
    }
  }, [router, supabase])

  if (!mounted || !user) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
      <Sidebar user={user} />
      <div className={`transition-all duration-300 ${sidebarCollapsed ? "pl-20" : "pl-64"}`}>
        {children}
      </div>
    </div>
  )
}
