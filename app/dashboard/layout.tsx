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
      const { data: userData } = await supabase.from("profiles").select("*").eq("user_id", user.id).single()

      setUser({
        name: userData?.name || user.user_metadata?.name || "Пользователь",
        email: user.email,
      })
    }

    fetchUser()
    setMounted(true)
  }, [router, supabase])

  if (!mounted || !user) {
    return null
  }

  const sidebarWidth = sidebarCollapsed ? "w-20" : "w-64"
  const marginLeft = sidebarCollapsed ? "ml-20" : "ml-64"

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
      {/* Фиксированное меню */}
      <div className={`fixed inset-y-0 left-0 z-40 h-screen ${sidebarWidth} transition-all duration-300`}>
        <Sidebar
          user={user}
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed((c) => !c)}
        />
      </div>
      {/* Контент с отступом слева */}
      <div className={`flex-1 p-6 transition-all duration-300 ${marginLeft} overflow-auto`}>
        {children}
      </div>
    </div>
  )
}
