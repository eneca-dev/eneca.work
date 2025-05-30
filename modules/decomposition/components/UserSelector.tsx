"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { useUserStore } from "@/stores/useUserStore"
import { useDepartmentName } from "../hooks/useDepartmentName"

export const UserSelector = () => {
  const { id, name, profile, isAuthenticated } = useUserStore()
  const { departmentName, isLoading: isDepartmentLoading, error } = useDepartmentName(profile?.departmentId)

  // Получаем инициалы пользователя для аватара
  const getInitials = (userName: string) => {
    return userName
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .substring(0, 2)
  }

  if (!isAuthenticated) {
    return (
      <Button variant="outline" disabled className="flex items-center gap-2 max-w-[300px]">
        <span className="text-sm">Пользователь не авторизован</span>
      </Button>
    )
  }

  return (
    <Button variant="outline" className="flex items-center gap-2 max-w-[300px] cursor-default">
      <Avatar className="h-6 w-6">
        <AvatarImage src={profile?.avatar_url || ""} alt={name || ""} />
        <AvatarFallback>{name ? getInitials(name) : "??"}</AvatarFallback>
      </Avatar>
      <div className="flex flex-col items-start min-w-0">
        <span className="text-sm font-medium truncate max-w-[150px]">{name || "Неизвестный пользователь"}</span>
        {isDepartmentLoading ? (
          <span className="text-xs text-muted-foreground truncate max-w-[150px]">Загрузка...</span>
        ) : error ? (
          <span className="text-xs text-red-500 truncate max-w-[150px]">Ошибка загрузки</span>
        ) : departmentName ? (
          <span className="text-xs text-muted-foreground truncate max-w-[150px]">{departmentName}</span>
        ) : null}
      </div>
    </Button>
  )
}
