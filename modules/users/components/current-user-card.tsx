"use client"

import { useState, useEffect, useRef } from "react"
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
import * as Sentry from "@sentry/nextjs"

interface CurrentUserCardProps {
  onUserUpdated?: () => void
  fallbackUser?: User // Для случаев, если в Zustand нет данных
}

function CurrentUserCard({ onUserUpdated, fallbackUser }: CurrentUserCardProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  // rerender-derived-state: отдельные селекторы вместо подписки на весь store
  const isAuthenticated = useUserStore(state => state.isAuthenticated)
  const storeUserId = useUserStore(state => state.id)
  const storeName = useUserStore(state => state.name)
  const storeEmail = useUserStore(state => state.email)
  const storeProfile = useUserStore(state => state.profile)
  const updateAvatar = useUserStore(state => state.updateAvatar)
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Стабильная ссылка на Supabase клиент (не пересоздаётся при ре-рендерах)
  const supabaseRef = useRef(createClient())

  // Получаем полные данные пользователя из view_users
  useEffect(() => {
    async function fetchUserData() {
      if (!isAuthenticated || !storeUserId) return

      setIsLoading(true)
      try {
        const { data: userData, error } = await Sentry.startSpan({ name: 'Users/CurrentUserCard loadUserView', op: 'db.read', attributes: { user_id: storeUserId } }, async () =>
          supabaseRef.current
            .from("view_users")
            .select("*")
            .eq("user_id", storeUserId)
            .maybeSingle()
        )

        if (error) {
          console.error("Ошибка получения данных пользователя из view_users:", error)
          Sentry.captureException(error, { tags: { module: 'users', component: 'CurrentUserCard', action: 'load_user_view', error_type: 'db_error' }, extra: { user_id: storeUserId } })
          if (storeProfile) {
            setCurrentUser(createUserFromZustand())
          }
          return
        }

        if (userData) {
          const formattedUser: User = {
            id: userData.user_id,
            email: userData.email || "",
            name: userData.full_name?.trim() ||
                  (userData.first_name && userData.last_name
                    ? `${userData.first_name} ${userData.last_name}`.trim()
                    : storeName || ""),
            avatar_url: userData.avatar_url || "",
            position: userData.position_name === "Без должности" ? "" : userData.position_name || "",
            subdivision: userData.subdivision_name || "",
            subdivisionId: userData.subdivision_id || undefined,
            department: userData.department_name === "Без отдела" ? "" : userData.department_name || "",
            departmentId: userData.department_id || undefined,
            team: userData.team_name || "",
            teamId: userData.team_id || undefined,
            category: userData.category_name === "Не применяется" ? "" : userData.category_name || "",
            role: userData.roles_display_string || "",

            dateJoined: userData.created_at || "",
            workLocation:
              userData.work_format === "Гибридный" ? "hybrid" :
              userData.work_format === "В офисе" ? "office" :
              userData.work_format === "Удаленно" ? "remote" :
              "office",
            country: userData.country_name || "",
            city: userData.city_name || "",
            employmentRate: userData.employment_rate ? parseFloat(String(userData.employment_rate)) : 1,
            salary: userData.salary ? parseFloat(String(userData.salary)) : 0,
            isHourly: userData.is_hourly || false
          }

          setCurrentUser(formattedUser)
        }

      } catch (error) {
        console.error("Критическая ошибка при получении данных пользователя:", error)
        Sentry.captureException(error, { tags: { module: 'users', component: 'CurrentUserCard', action: 'load_user_view_unexpected', error_type: 'unexpected' }, extra: { user_id: storeUserId } })
        if (storeProfile) {
          setCurrentUser(createUserFromZustand())
        }
      } finally {
        setIsLoading(false)
      }
    }

    // Функция для создания пользователя из данных Zustand (fallback)
    function createUserFromZustand(): User {
      return {
        id: storeUserId!,
        email: storeEmail || "",
        name: storeProfile?.first_name && storeProfile?.last_name
          ? `${storeProfile.first_name} ${storeProfile.last_name}`
          : storeName || "",
        avatar_url: storeProfile?.avatar_url || "",
        position: "",
        department: "",
        team: "",
        category: "",
        role: "",

        dateJoined: "",
        workLocation:
          storeProfile?.work_format === "Гибридный" ? "hybrid" :
          storeProfile?.work_format === "В офисе" ? "office" :
          storeProfile?.work_format === "Удаленно" ? "remote" :
          "office",
        country: "",
        city: "",
        employmentRate: storeProfile?.employment_rate || 1,
        salary: storeProfile?.salary || 0,
        isHourly: storeProfile?.is_hourly || false
      }
    }

    fetchUserData()
  }, [isAuthenticated, storeUserId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Fallback к переданному пользователю, если нет данных
  useEffect(() => {
    if (!currentUser && !isLoading && fallbackUser) {
      // console.log("CurrentUserCard: Используем fallbackUser, т.к. нет данных из view_users")
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
    Sentry.addBreadcrumb({ category: 'ui.action', level: 'info', message: 'CurrentUserCard: avatar uploaded' })
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
    // console.log("CurrentUserCard: Отображаем заглушку, загрузка:", isLoading, "currentUser:", !!currentUser)
    return (
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-center h-16">
            <p className="text-muted-foreground">
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
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-medium">{currentUser.name}</h3>
                {/* Первая строка: Должность • Подразделение • Отдел */}
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  {currentUser.position && <span>{currentUser.position}</span>}
                  {currentUser.position && (currentUser.subdivision || currentUser.department) && <span>•</span>}
                  {currentUser.subdivision && <span className="truncate max-w-[200px]">{currentUser.subdivision}</span>}
                  {currentUser.subdivision && currentUser.department && <span>•</span>}
                  {currentUser.department && <span className="truncate max-w-[150px]">{currentUser.department}</span>}
                </div>
                {/* Вторая строка: Команда • Расположение • Роль */}
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  {currentUser.team && <span className="truncate max-w-[120px]">{currentUser.team}</span>}
                  {currentUser.team && currentUser.workLocation && <span>•</span>}
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
                        <p>
                          {currentUser.country && currentUser.city
                            ? `${currentUser.city}, ${currentUser.country}`
                            : currentUser.country
                              ? currentUser.country
                              : currentUser.city
                                ? currentUser.city
                                : "Местоположение не указано"}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                  {currentUser.role && (currentUser.team || currentUser.workLocation) && <span>•</span>}
                  {currentUser.role && (
                    <span className="text-muted-foreground font-medium">
                      {currentUser.role}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => {
              Sentry.addBreadcrumb({ category: 'ui.open', level: 'info', message: 'CurrentUserCard: open user dialog' })
              setIsDialogOpen(true)
            }}>
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

export default Sentry.withProfiler(CurrentUserCard, { name: 'CurrentUserCard' })
