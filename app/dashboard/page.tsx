"use client"

import { useState, useEffect } from "react"
import { LayoutDashboard } from "lucide-react"
import { Sidebar } from "@/components/sidebar"
import { createClient } from "@/utils/supabase/client"
import { useRouter } from "next/navigation"

export default function DashboardPage() {
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

    // Функция для отслеживания изменения ширины бокового меню
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
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 gap-6">
            <div className="bg-white dark:bg-gray-800 shadow rounded-xl p-6 animate-fade-in transition-colors duration-200">
              <div className="flex items-center space-x-2 mb-4">
                <LayoutDashboard className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-medium dark:text-gray-200">Панель управления</h2>
              </div>

              <p className="text-gray-500 dark:text-gray-400 mb-4">
                Добро пожаловать в систему eneca.work, {user.name}! Вы успешно вошли в аккаунт.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-6">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 border border-gray-100 dark:border-gray-600 transition-colors duration-200"
                  >
                    <div className="h-32 flex items-center justify-center text-gray-300 dark:text-gray-600">
                      <div className="h-12 w-12" />
                    </div>
                    <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-2">Модуль {i}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
