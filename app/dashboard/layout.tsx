"use client"

import { useState, useEffect } from "react"
import { Sidebar } from "@/components/sidebar"
import { createClient } from "@/utils/supabase/client"
import { useRouter } from "next/navigation"
import { useUserStore } from "@/stores/useUserStore"
import { getUserRoleAndPermissions } from "@/modules/users/lib/data-service"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const name = useUserStore((state) => state.name)
  const email = useUserStore((state) => state.email)
  const isAuthenticated = useUserStore((state) => state.isAuthenticated)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const fetchUser = async () => {
      try {
        console.log("Запускаем fetchUser в DashboardLayout");
        console.log("Текущее состояние аутентификации:", isAuthenticated);
        
        // Проверка сессии Supabase для подтверждения аутентификации
        const { data: sessionData } = await supabase.auth.getSession();
        
        if (!sessionData.session) {
          console.log("Сессия Supabase отсутствует, перенаправляем на страницу входа");
          useUserStore.getState().clearUser(); // Очищаем хранилище, если сессия истекла
          router.push("/auth/login");
          return;
        }
        
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          console.log("Пользователь не найден, перенаправляем на страницу входа");
          useUserStore.getState().clearUser();
          router.push("/auth/login");
          return;
        }

        console.log("Аутентифицированный пользователь:", user.id);
        
        // Проверяем, есть ли уже пользовательские данные в хранилище
        const currentUserId = useUserStore.getState().id;
        console.log("ID текущего пользователя в хранилище:", currentUserId);
        
        // Проверяем соответствие ID в хранилище и в Supabase
        const needsRefresh = !currentUserId || currentUserId !== user.id;
        
        if (needsRefresh) {
          console.log("Требуется обновление данных пользователя в хранилище");
          
          // Get user metadata
          const { data: userData } = await supabase.from("profiles").select("*").eq("user_id", user.id).single();
          
          console.log("Получены данные профиля из Supabase:", userData);
          
          // Сохраняем профиль в Zustand только если нужно обновить данные
          useUserStore.getState().setUser({
            id: user.id,
            email: user.email ?? "",
            name: userData ? [userData.first_name ?? "", userData.last_name ?? ""].filter(Boolean).join(" ") : "Пользователь",
            profile: userData
          });
          
          // Теперь получаем роль и разрешения
          console.log("Получаем роли и разрешения для пользователя с ID:", user.id);
          
          try {
            const { role, permissions } = await getUserRoleAndPermissions(user.id, supabase);
            console.log("Полученные роли и разрешения:", { role, permissions });
            if (role) {
              useUserStore.getState().setRoleAndPermissions(role, permissions);
              console.log("Роль и разрешения сохранены в хранилище:", role, permissions);
            } else {
              console.warn("Роль не найдена для пользователя:", user.id);
            }
          } catch (error) {
            console.error("Ошибка при получении ролей и разрешений:", error);
          }
        } else {
          console.log("Пользовательские данные уже актуальны, пропускаем обновление");
        }

        setMounted(true);
        console.log("Компонент установлен");
      } catch (error) {
        console.error("Ошибка при загрузке пользователя:", error);
        router.push("/auth/login");
      }
    };

    fetchUser();
  }, [router, supabase, isAuthenticated]);

  if (!mounted) {
    return null
  }

  const sidebarWidth = sidebarCollapsed ? "w-20" : "w-64"
  const marginLeft = sidebarCollapsed ? "ml-20" : "ml-64"

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
      {/* Фиксированное меню */}
      <div className={`fixed inset-y-0 left-0 z-40 h-screen ${sidebarWidth} transition-all duration-300`}>
        <Sidebar
          user={{ name: name || "Пользователь", email: email || "" }}
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
