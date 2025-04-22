"use client"

import { useState, useEffect } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { User } from "@/types/db"
import { Settings, Building2, Home, Briefcase } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { UserDialog } from "./user-dialog"
import { useUserStore } from "@/stores/useUserStore"
import { createClient } from "@/utils/supabase/client"

interface CurrentUserCardProps {
  onUserUpdated?: () => void
  fallbackUser?: User // Для случаев, если в Zustand нет данных
}

export function CurrentUserCard({ onUserUpdated, fallbackUser }: CurrentUserCardProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const userState = useUserStore() // Получаем все состояние без деструктурирования
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [departmentName, setDepartmentName] = useState<string>("")
  const [teamName, setTeamName] = useState<string>("")
  const [positionName, setPositionName] = useState<string>("")
  const [categoryName, setCategoryName] = useState<string>("")
  
  // Используем существующий клиент Supabase
  const supabase = createClient()

  // Получаем имена отделов, команд и должностей из Supabase
  useEffect(() => {
    async function fetchMetadata() {
      if (!userState.profile) return

      try {
        // Получаем информацию об отделе
        if (userState.profile.departmentId) {
          const { data: departmentData } = await supabase
            .from("departments")
            .select("department_name")
            .eq("department_id", userState.profile.departmentId)
            .single()
          
          if (departmentData) {
            setDepartmentName(departmentData.department_name || "")
          }
        }

        // Получаем информацию о команде
        if (userState.profile.teamId) {
          const { data: teamData } = await supabase
            .from("teams")
            .select("team_name")
            .eq("team_id", userState.profile.teamId)
            .single()
          
          if (teamData) {
            setTeamName(teamData.team_name || "")
          }
        }

        // Получаем информацию о должности
        if (userState.profile.positionId) {
          const { data: positionData } = await supabase
            .from("positions")
            .select("position_name")
            .eq("position_id", userState.profile.positionId)
            .single()
          
          if (positionData) {
            setPositionName(positionData.position_name || "")
          }
        }

        // Получаем информацию о категории
        if (userState.profile.categoryId) {
          const { data: categoryData } = await supabase
            .from("categories")
            .select("category_name")
            .eq("category_id", userState.profile.categoryId)
            .single()
          
          if (categoryData) {
            setCategoryName(categoryData.category_name || "")
          }
        }

      } catch (error) {
        console.error("Ошибка получения метаданных:", error)
      }
    }

    fetchMetadata()
  }, [userState.profile])

  // Отладочный вывод для понимания, что содержится в хранилище
  useEffect(() => {
    console.log("CurrentUserCard: Состояние из Zustand:", userState)
  }, [userState])

  // Подготавливаем данные для отображения
  useEffect(() => {
    if (userState.isAuthenticated && userState.id) {
      console.log("CurrentUserCard: Начинаем формировать пользователя из Zustand")
      
      // Преобразуем данные из Zustand в формат User
      const formattedUser: User = {
        id: userState.id,
        email: userState.email || "",
        name: userState.profile?.firstName && userState.profile?.lastName 
          ? `${userState.profile.firstName} ${userState.profile.lastName}`
          : userState.name || "",
        avatar: "", // Может потребоваться доработка, если аватар хранится где-то в профиле
        position: positionName,
        department: departmentName,
        team: teamName,
        category: categoryName,
        isActive: true,
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
      
      console.log("CurrentUserCard: Сформирован пользователь:", formattedUser)
      setCurrentUser(formattedUser)
    } else if (fallbackUser) {
      console.log("CurrentUserCard: Используем fallbackUser, т.к. в Zustand нет данных")
      setCurrentUser(fallbackUser)
    } else {
      console.log("CurrentUserCard: Нет данных ни в Zustand, ни в fallbackUser")
    }
  }, [userState, fallbackUser, departmentName, teamName, positionName, categoryName])

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

  // Если данных нет, показываем пустую карточку или индикатор загрузки
  if (!currentUser) {
    console.log("CurrentUserCard: Отображаем заглушку, т.к. currentUser = null")
    return (
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-center h-16">
            <p className="text-gray-500 dark:text-gray-400">Загрузка профиля...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <TooltipProvider>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="h-12 w-12">
                <AvatarImage src={currentUser.avatar || "/placeholder.svg"} alt={currentUser.name} />
                <AvatarFallback>
                  {currentUser.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="text-lg font-medium">{currentUser.name}</h3>
                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
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
