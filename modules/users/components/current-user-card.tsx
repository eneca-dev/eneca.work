"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Settings, Building2, Home, Briefcase } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { UserDialog } from "./user-dialog"
import { useUserStore } from "@/stores/useUserStore"
import { AvatarUploader } from "./avatar-uploader"
import { toast } from "sonner"
import * as Sentry from "@sentry/nextjs"
import type { UserPresentation } from "@/modules/users/lib/types"

interface CurrentUserCardProps {
  onUserUpdated?: () => void
  user: UserPresentation
}

function CurrentUserCard({ onUserUpdated, user: userProp }: CurrentUserCardProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const updateAvatar = useUserStore(state => state.updateAvatar)

  // Локальный override аватара (мгновенный фидбек после загрузки, до инвалидации родительского query)
  const [avatarOverride, setAvatarOverride] = useState<string | null>(null)

  // Данные пользователя берём из родительского TanStack Query — без дублирующего запроса
  const currentUser = avatarOverride
    ? { ...userProp, avatar_url: avatarOverride }
    : userProp

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
    // Мгновенный фидбек — локальный override аватара
    setAvatarOverride(url)
    // Обновляем аватар в Zustand
    updateAvatar(url)

    toast.success("После обработки аватар будет автоматически применен", {
      description: "Повторно загрузить аватар можно будет через 15 минут"
    })

    // Инвалидируем родительский query для обновления данных
    if (onUserUpdated) {
      onUserUpdated()
    }
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
