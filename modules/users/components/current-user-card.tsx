"use client"

import { useState } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { User } from "../lib/types"
import { Settings, Building2, Home, Briefcase } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { UserDialog } from "./user-dialog"

interface CurrentUserCardProps {
  user: User
  onUserUpdated?: () => void
}

export function CurrentUserCard({ user, onUserUpdated }: CurrentUserCardProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)

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

  return (
    <TooltipProvider>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="h-12 w-12">
                <AvatarImage src={user.avatar || "/placeholder.svg"} alt={user.name} />
                <AvatarFallback>
                  {user.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="text-lg font-medium">{user.name}</h3>
                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                  <span>{user.position}</span>
                  <span>•</span>
                  <span>{user.department}</span>
                  <span>•</span>
                  <span>{user.team}</span>
                  {user.workLocation && (
                    <>
                      <span>•</span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge
                            variant={getLocationBadge(user.workLocation).variant}
                            className={`flex items-center ${getLocationBadge(user.workLocation).className}`}
                          >
                            {getLocationBadge(user.workLocation).icon}
                            {getLocationBadge(user.workLocation).label}
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{user.address}</p>
                        </TooltipContent>
                      </Tooltip>
                    </>
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
        user={user}
        onUserUpdated={onUserUpdated}
        isSelfEdit={true}
      />
    </TooltipProvider>
  )
}
