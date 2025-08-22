"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { User } from "@/types/db"
import { Settings, Building2, Home, Briefcase } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { UserDialog } from "./user-dialog"
import { useUserStore } from "@/stores/useUserStore"
import { createClient } from "@/utils/supabase/client"
import { AvatarUploader } from "./avatar-uploader"
import { toast } from "sonner"

interface CurrentUserCardProps {
  onUserUpdated?: () => void
  fallbackUser?: User // Для случаев, если в Zustand нет данных
}

export function CurrentUserCard({ onUserUpdated, fallbackUser }: CurrentUserCardProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const userState = useUserStore() // Получаем все состояние без деструктурирования
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  
  // Используем существующий клиент Supabase
  const supabase = createClient()
  const updateAvatar = useUserStore((state) => state.updateAvatar)

  // Получаем полные данные пользователя из view_users
  useEffect(() => {
    async function fetchUserData() {
      if (!userState.isAuthenticated || !userState.id) return

      setIsLoading(true)
      try {
        console.log("CurrentUserCard: Загружаем данные из view_users для пользователя:", userState.id)
        
        const { data: userData, error } = await supabase
          .from("view_users")
          .select("*")
          .eq("user_id", userState.id)
          .single()

        if (error) {
          console.error("Ошибка получения данных пользователя из view_users:", error)
          // Если не удалось получить данные из view, используем данные из Zustand
          if (userState.profile) {
            setCurrentUser(createUserFromZustand())
          }
          return
        }

        if (userData) {
          console.log("CurrentUserCard: Получены данные из view_users:", userData)
          
          // Формируем объект пользователя из данных view_users
          const formattedUser: User = {
            id: userData.user_id,
            email: userData.email || "",
            name: userData.full_name?.trim() || 
                  (userData.first_name && userData.last_name 
                    ? `${userData.first_name} ${userData.last_name}`.trim()
                    : userState.name || ""),
            avatar_url: userData.avatar_url || "",
            position: userData.position_name === "Без должности" ? "" : userData.position_name || "",
            department: userData.department_name === "Без отдела" ? "" : userData.department_name || "",
            team: userData.team_name === "Без команды" ? "" : userData.team_name || "",
            category: userData.category_name === "Не применяется" ? "" : userData.category_name || "",
            role: userData.role_name || "",

            dateJoined: userData.created_at || "",
            workLocation: 
              userData.work_format === "Гибридный" ? "hybrid" : 
              userData.work_format === "В офисе" ? "office" : 
              userData.work_format === "Удаленно" ? "remote" : 
              "office",
            address: userData.address || "",
            employmentRate: userData.employment_rate ? parseFloat(userData.employment_rate) * 100 : 100,
            salary: userData.salary || 0,
            isHourly: userData.is_hourly || false
          }
          
          console.log("CurrentUserCard: Сформирован пользователь из view_users:", formattedUser)
          setCurrentUser(formattedUser)
        }

      } catch (error) {
        console.error("Критическая ошибка при получении данных пользователя:", error)
        // Fallback к данным из Zustand
        if (userState.profile) {
          setCurrentUser(createUserFromZustand())
        }
      } finally {
        setIsLoading(false)
      }
    }

    // Функция для создания пользователя из данных Zustand (fallback)
    function createUserFromZustand(): User {
      return {
        id: userState.id!,
        email: userState.email || "",
        name: userState.profile?.firstName && userState.profile?.lastName 
          ? `${userState.profile.firstName} ${userState.profile.lastName}`
          : userState.name || "",
        avatar_url: userState.profile?.avatar_url || "",
        position: "",
        department: "",
        team: "",
        category: "",
        role: "",

        dateJoined: "",
        workLocation: 
          userState.profile?.workFormat === "Гибридный" ? "hybrid" : 
          userState.profile?.workFormat === "В офисе" ? "office" : 
          userState.profile?.workFormat === "Удаленно" ? "remote" : 
          "office",
        address: userState.profile?.address || "",
        employmentRate: userState.profile?.employmentRate || 100,
        salary: userState.profile?.salary || 0,
        isHourly: userState.profile?.isHourly || false
      }
    }

    fetchUserData()
  }, [userState.isAuthenticated, userState.id, supabase])

  // Отладочный вывод для понимания, что содержится в хранилище
  useEffect(() => {
    console.log("CurrentUserCard: Состояние из Zustand:", userState)
  }, [userState])

  // Fallback к переданному пользователю, если нет данных
  useEffect(() => {
    if (!currentUser && !isLoading && fallbackUser) {
      console.log("CurrentUserCard: Используем fallbackUser, т.к. нет данных из view_users")
      setCurrentUser(fallbackUser)
    }
  }, [currentUser, isLoading, fallbackUser])

  // Функция для отображения значка и цвета в зависимости от расположения
  const getLocationBadge = (location: "office" | "remote" | "hybrid") => {
    switch (location) {
      case "office":
        return {
          icon: <Building2 className="h-3 w-3 mr-1" />,
          label: "В офисе",
          variant: "outline" as const,
          className: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800",
        }
      case "remote":
        return {
          icon: <Home className="h-3 w-3 mr-1" />,
          label: "Удаленно",
          variant: "outline" as const,
          className: "bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800",
        }
      case "hybrid":
        return {
          icon: <Briefcase className="h-3 w-3 mr-1" />,
          label: "Гибридный",
          variant: "outline" as const,
          className: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800",
        }
    }
  }
  
  // Обработчик успешной загрузки аватара
  const handleAvatarUploaded = (url: string) => {
    // Обновляем аватар в Zustand
    updateAvatar(url)
    
    toast.success("После обработки аватар будет автоматически применен", {
      description: "Повторно загрузить аватар можно будет через 15 минут"
    })
    
    // Обновление аватара в локальном состоянии для демонстрации
    if (currentUser) {
      setCurrentUser({
        ...currentUser,
        avatar_url: url
      })
    }
    
    // Вызываем callback, если он есть
    if (onUserUpdated) {
      onUserUpdated()
    }
  }

  // Если данных нет, показываем пустую карточку или индикатор загрузки
  if (isLoading || !currentUser) {
    console.log("CurrentUserCard: Отображаем заглушку, загрузка:", isLoading, "currentUser:", !!currentUser)
    return (
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-center h-16">
            <p className="text-gray-500 dark:text-gray-400">
              {isLoading ? "Загрузка профиля..." : "Профиль недоступен"}
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <TooltipProvider>
      <Card className="w-full max-w-4xl">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <AvatarUploader
                avatarUrl={currentUser.avatar_url}
                name={currentUser.name}
                className="h-16 w-16"
                onAvatarUploaded={handleAvatarUploaded}
              />
              <div>
                <h3 className="text-lg font-medium">{currentUser.name}</h3>
                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hidden lg:flex">
                  {currentUser.position && <span>{currentUser.position}</span>}
                  {currentUser.position && (currentUser.department || currentUser.team) && <span>•</span>}
                  {currentUser.department && <span>{currentUser.department}</span>}
                  {currentUser.department && currentUser.team && <span>•</span>}
                  {currentUser.team && <span>{currentUser.team}</span>}
                  {currentUser.workLocation && (currentUser.position || currentUser.department || currentUser.team) && (
                    <span>•</span>
                  )}
                  {currentUser.workLocation && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge
                          variant={getLocationBadge(currentUser.workLocation).variant}
                          className={`flex items-center ${getLocationBadge(currentUser.workLocation).className}`}
                        >
                          {getLocationBadge(currentUser.workLocation).icon}
                          {getLocationBadge(currentUser.workLocation).label}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{currentUser.address || "Адрес не указан"}</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                  {currentUser.role && (currentUser.workLocation || currentUser.position || currentUser.department || currentUser.team) && (
                    <span>•</span>
                  )}
                  {currentUser.role && (
                    <span className="text-gray-400 dark:text-gray-500 font-medium">
                      {currentUser.role}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => setIsDialogOpen(true)}>
              <Settings className="mr-2 h-4 w-4" />
              Настройки профиля
            </Button>
          </div>
        </CardContent>
      </Card>

      <UserDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        user={currentUser}
        onUserUpdated={onUserUpdated}
        isSelfEdit={true}
      />
    </TooltipProvider>
  )
}
