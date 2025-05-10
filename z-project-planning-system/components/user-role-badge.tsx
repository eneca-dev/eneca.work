"use client"

import { Badge } from "@/components/ui/badge"
import { UserIcon, Users, Building2, FolderKanban, ShieldCheck } from "lucide-react"

export type UserRole = "Пользователь" | "Тимлид" | "Руководитель отдела" | "Руководитель проектов" | "Администратор"

interface UserRoleBadgeProps {
  role: UserRole
}

export function UserRoleBadge({ role }: UserRoleBadgeProps) {
  // Определяем иконку и цвет в зависимости от роли
  const getRoleIcon = () => {
    switch (role) {
      case "Пользователь":
        return <UserIcon className="h-3.5 w-3.5 mr-1" />
      case "Тимлид":
        return <Users className="h-3.5 w-3.5 mr-1" />
      case "Руководитель отдела":
        return <Building2 className="h-3.5 w-3.5 mr-1" />
      case "Руководитель проектов":
        return <FolderKanban className="h-3.5 w-3.5 mr-1" />
      case "Администратор":
        return <ShieldCheck className="h-3.5 w-3.5 mr-1" />
    }
  }

  const getRoleColor = () => {
    switch (role) {
      case "Пользователь":
        return "bg-slate-100 hover:bg-slate-200 text-slate-700"
      case "Тимлид":
        return "bg-blue-100 hover:bg-blue-200 text-blue-700"
      case "Руководитель отдела":
        return "bg-purple-100 hover:bg-purple-200 text-purple-700"
      case "Руководитель проектов":
        return "bg-amber-100 hover:bg-amber-200 text-amber-700"
      case "Администратор":
        return "bg-red-100 hover:bg-red-200 text-red-700"
    }
  }

  return (
    <Badge variant="outline" className={`flex items-center ${getRoleColor()}`}>
      {getRoleIcon()}
      <span className="text-xs font-medium">{role}</span>
    </Badge>
  )
}

