"use client"

import { useState, useEffect } from "react"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Check, UserPlus } from "lucide-react"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { mockProfiles, getFullName, getPositionName, profileToResponsible, mockTeams } from "@/data/mock-profiles"
import type { SectionResponsible } from "@/types/project-types"
import { useTheme } from "next-themes"

interface ResponsibleSelectorProps {
  value?: string
  onChange: (responsible: SectionResponsible) => void
  isCollapsed?: boolean
}

export function ResponsibleSelector({ value, onChange, isCollapsed = false }: ResponsibleSelectorProps) {
  const [open, setOpen] = useState(false)
  const [selectedProfile, setSelectedProfile] = useState<SectionResponsible | null>(null)
  // Используем хук useTheme для реактивного отслеживания темы
  const { resolvedTheme } = useTheme()
  const isDarkTheme = resolvedTheme === "dark"

  // Инициализация выбранного профиля при загрузке компонента
  useEffect(() => {
    if (value) {
      const profile = mockProfiles.find((p) => p.user_id === value)
      if (profile) {
        setSelectedProfile(profileToResponsible(profile))
      }
    }
  }, [value])

  // Получаем инициалы для аватара
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((part) => part.charAt(0))
      .join("")
      .toUpperCase()
      .substring(0, 2)
  }

  // Определяем цвета для аватара в зависимости от темы
  const avatarBgColor = isDarkTheme ? "rgba(34, 197, 94, 0.2)" : "rgba(34, 197, 94, 0.1)"
  const avatarTextColor = isDarkTheme ? "rgb(134, 239, 172)" : "rgb(34, 197, 94)"
  const avatarBorderColor = isDarkTheme ? "rgba(34, 197, 94, 0.5)" : "rgba(34, 197, 94, 0.3)"

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "p-0 h-auto",
            isCollapsed ? "w-8 h-8 flex items-center justify-center" : "w-full justify-start",
            !selectedProfile && "text-slate-500",
          )}
        >
          {selectedProfile ? (
            <div className={cn("flex items-center", isCollapsed ? "justify-center" : "gap-2 w-full")}>
              <Avatar className="h-7 w-7 flex-shrink-0 border border-primary/30 dark:border-primary/50">
                <AvatarImage src={selectedProfile.avatarUrl} alt={selectedProfile.name} />
                <AvatarFallback
                  className="text-xs font-semibold"
                  style={{
                    backgroundColor: avatarBgColor,
                    color: avatarTextColor,
                    border: `1px solid ${avatarBorderColor}`,
                  }}
                >
                  {getInitials(selectedProfile.name)}
                </AvatarFallback>
              </Avatar>
              {!isCollapsed && (
                <div className="flex flex-col items-start min-w-0 flex-1">
                  <span className="text-xs font-medium text-gray-800 dark:text-gray-100 truncate w-full text-left">
                    {selectedProfile.name}
                  </span>
                  <span className="text-[10px] text-gray-500 dark:text-gray-400 truncate w-full text-left">
                    {selectedProfile.position}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className={cn("flex items-center", isCollapsed ? "justify-center" : "gap-2 w-full")}>
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
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[300px] dark:bg-slate-800">
        <Command className="dark:bg-slate-800">
          <CommandInput
            placeholder="Поиск ответственного..."
            className="dark:bg-slate-800 dark:text-slate-200 dark:placeholder:text-slate-400"
          />
          <CommandEmpty className="dark:text-slate-300">Ответственный не найден.</CommandEmpty>
          <CommandList className="dark:bg-slate-800">
            <CommandGroup heading="Сотрудники" className="dark:text-slate-300">
              {mockProfiles.map((profile) => {
                // Получаем информацию о команде
                const team = mockTeams.find((t) => t.team_id === profile.team_id)
                const teamName = team?.name || ""

                return (
                  <CommandItem
                    key={profile.user_id}
                    value={getFullName(profile)}
                    onSelect={() => {
                      const responsible = profileToResponsible(profile)
                      setSelectedProfile(responsible)
                      onChange(responsible)
                      setOpen(false)
                    }}
                    className="dark:text-slate-200 dark:hover:bg-slate-700"
                  >
                    <div className="flex items-center gap-2">
                      <Avatar className="h-7 w-7 border border-primary/30 dark:border-primary/50">
                        <AvatarImage src={profile.avatar_url} alt={getFullName(profile)} />
                        <AvatarFallback
                          className="text-xs font-semibold"
                          style={{
                            backgroundColor: avatarBgColor,
                            color: avatarTextColor,
                            border: `1px solid ${avatarBorderColor}`,
                          }}
                        >
                          {getInitials(getFullName(profile))}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <span className="font-medium dark:text-slate-100">{getFullName(profile)}</span>
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-gray-500 dark:text-gray-400">{getPositionName(profile)}</span>
                          {teamName && <span className="text-xs text-blue-600 dark:text-blue-400">• {teamName}</span>}
                        </div>
                      </div>
                    </div>
                    <Check
                      className={cn(
                        "ml-auto h-4 w-4",
                        selectedProfile?.id === profile.user_id ? "opacity-100" : "opacity-0",
                      )}
                    />
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

