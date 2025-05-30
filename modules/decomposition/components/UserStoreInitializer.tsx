"use client"

import { useEffect } from "react"
import { useUserStore } from "@/stores/useUserStore"

export const UserStoreInitializer = () => {
  const isAuthenticated = useUserStore((state) => state.isAuthenticated)

  useEffect(() => {
    // Проверяем аутентификацию при загрузке компонента
    if (!isAuthenticated) {
      console.log("User not authenticated in decomposition module")
      // Можно добавить редирект на страницу входа или показать сообщение
    }
  }, [isAuthenticated])

  return null // Этот компонент не рендерит UI
}
