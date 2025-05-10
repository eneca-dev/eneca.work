"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import type { SectionResponsible } from "@/types/project-types"
import { UserPlus } from "lucide-react"
import { cn } from "@/lib/utils"
import { mockProfiles, mockTeams } from "@/data/mock-profiles"
import { useTheme } from "next-themes"

// Обновим интерфейс SectionResponsibleCardProps
interface SectionResponsibleCardProps {
  responsible?: SectionResponsible
  isCollapsed?: boolean
}

export function SectionResponsibleCard({ responsible, isCollapsed = false }: SectionResponsibleCardProps) {
  // Используем хук useTheme для реактивного отслеживания темы
  const { resolvedTheme } = useTheme()
  const isDarkTheme = resolvedTheme === "dark"

  // Если ответственный не назначен, показываем специальный индикатор
  if (!responsible) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={cn("flex items-center", isCollapsed ? "justify-center" : "gap-2")}>
              {isCollapsed ? (
                <div className="h-7 w-7 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                  <UserPlus size={14} className="text-slate-400 dark:text-slate-300" />
                </div>
              ) : (
                <>
                  <div className="h-7 w-7 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
                    <UserPlus size={14} className="text-slate-400 dark:text-slate-300" />
                  </div>
                  <span className="text-xs text-slate-400 dark:text-slate-300">Выбрать</span>
                </>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent side="right" className="bg-white dark:bg-slate-800 p-3 shadow-lg border-0">
            <div className="space-y-1.5">
              <p className="font-medium dark:text-slate-200">Ответственный не назначен</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Нажмите, чтобы выбрать ответственного</p>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  // Получаем информацию о команде ответственного
  const profile = mockProfiles.find((p) => p.user_id === responsible.id)
  const team = profile ? mockTeams.find((t) => t.team_id === profile.team_id) : null
  const teamName = team?.team_name || ""

  // Получаем инициалы для аватара
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((part) => part.charAt(0))
      .join("")
      .toUpperCase()
      .substring(0, 2)
  }

  const initials = getInitials(responsible.name)

  // Определяем цвета для аватара в зависимости от темы
  const avatarBgColor = isDarkTheme ? "rgba(34, 197, 94, 0.2)" : "rgba(34, 197, 94, 0.1)"
  const avatarTextColor = isDarkTheme ? "rgb(134, 239, 172)" : "rgb(34, 197, 94)"
  const avatarBorderColor = isDarkTheme ? "rgba(34, 197, 94, 0.5)" : "rgba(34, 197, 94, 0.3)"

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn("flex items-center", isCollapsed ? "justify-center" : "gap-2")}>
            <Avatar className="h-7 w-7 flex-shrink-0 border border-primary/30 dark:border-primary/50">
              <AvatarImage src={responsible.avatarUrl} alt={responsible.name} />
              <AvatarFallback
                className="text-xs font-semibold"
                style={{
                  backgroundColor: avatarBgColor,
                  color: avatarTextColor,
                  border: `1px solid ${avatarBorderColor}`,
                }}
              >
                {initials}
              </AvatarFallback>
            </Avatar>
            {!isCollapsed && (
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-xs font-medium text-gray-800 dark:text-gray-100 truncate w-full">
                  {responsible.name}
                </span>
                <span className="text-[10px] text-gray-500 dark:text-gray-400 truncate w-full">
                  {responsible.position}
                </span>
              </div>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="right" className="bg-white dark:bg-slate-800 p-3 shadow-lg border-0">
          <div className="space-y-1.5">
            <p className="font-medium dark:text-slate-100">{responsible.name}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{responsible.position}</p>
            {teamName && <p className="text-xs text-blue-600 dark:text-blue-400">Команда: {teamName}</p>}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

