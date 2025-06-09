"use client"

import React, { useState, useEffect, useMemo, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  Edit,
  MoreHorizontal,
  Search,
  Trash,
  ChevronDown,
  ChevronRight,
  Home,
  Building2,
  Briefcase,
  Users,
} from "lucide-react"
import { UserDialog } from "./user-dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { deleteUser } from "@/services/org-data-service"
import type { User, UsersFilter } from "@/types/db"
import { toast } from "@/components/ui/use-toast"
import { useRouter } from "next/navigation"
import { useUserPermissions } from "../hooks/useUserPermissions"
import { Separator } from "@/components/ui/separator"
import { EmptyState } from "@/components/ui/empty-state"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"

interface UsersListProps {
  users: User[]
  filters: {
    departments: string[]
    teams: string[]
    categories: string[]
    positions: string[]
    workLocations: string[]
    roles: string[]
  }
  onUserUpdated?: () => void
}

// Изменим тип для группировки
type GroupBy = "none" | "department" | "nested"

export default function UsersList({ users: initialUsers, filters: initialFilters, onUserUpdated }: UsersListProps) {
  const [users, setUsers] = useState<User[]>(initialUsers)
  const [filteredUsers, setFilteredUsers] = useState<User[]>(initialUsers)
  const [searchTerm, setSearchTerm] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [groupBy, setGroupBy] = useState<GroupBy>("none")
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const router = useRouter()

  // Получаем разрешения пользователя
  const { canEditAllUsers } = useUserPermissions()

  // Состояние для фильтров
  const [filters, setFilters] = useState(initialFilters)

  // Применение фильтров и поиска
  useEffect(() => {
    let result = [...users]

    // Применение поиска
    if (searchTerm) {
      result = result.filter(
        (user) =>
          user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
          user.department.toLowerCase().includes(searchTerm.toLowerCase()) ||
          user.team.toLowerCase().includes(searchTerm.toLowerCase()) ||
          user.position.toLowerCase().includes(searchTerm.toLowerCase()),
      )
    }

    // Применение фильтров
    if (filters.departments.length > 0) {
      result = result.filter((user) => filters.departments.includes(user.department))
    }

    if (filters.teams.length > 0) {
      result = result.filter((user) => filters.teams.includes(user.team))
    }

    if (filters.categories.length > 0) {
      result = result.filter((user) => filters.categories.includes(user.category))
    }

    // Добавим фильтрацию по должностям
    if (filters.positions.length > 0) {
      result = result.filter((user) => filters.positions.includes(user.position))
    }

    // Добавим фильтрацию по расположению
    if (filters.workLocations.length > 0) {
      result = result.filter((user) => user.workLocation && filters.workLocations.includes(user.workLocation))
    }

    // Добавим фильтрацию по ролям
    if (filters.roles.length > 0) {
      result = result.filter((user) => filters.roles.includes(user.role))
    }

    setFilteredUsers(result)
  }, [users, searchTerm, filters])

  useEffect(() => {
    setFilters(initialFilters)
  }, [initialFilters])

  // Заменим функцию группировки пользователей на новую с поддержкой вложенной структуры
  const groupUsers = () => {
    if (groupBy === "none") return { "": filteredUsers }

    if (groupBy === "department") {
      const groups: Record<string, User[]> = {}

      filteredUsers.forEach((user) => {
        const groupKey = user.department
        if (!groups[groupKey]) {
          groups[groupKey] = []
        }
        groups[groupKey].push(user)
      })

      return groups
    }

    // Вложенная группировка: отделы -> команды
    const nestedGroups: Record<string, Record<string, User[]>> = {}

    filteredUsers.forEach((user) => {
      const department = user.department
      const team = user.team

      if (!nestedGroups[department]) {
        nestedGroups[department] = {}
      }

      if (!nestedGroups[department][team]) {
        nestedGroups[department][team] = []
      }

      nestedGroups[department][team].push(user)
    })

    return nestedGroups
  }

  const groupedUsers = groupUsers()

  // Функция для переключения состояния развернутости группы
  const toggleGroup = (groupName: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupName]: !prev[groupName],
    }))
  }

  // Инициализируем состояние развернутости для всех групп
  const initializeExpandedGroups = () => {
    const newExpandedGroups: Record<string, boolean> = {}
    Object.keys(groupedUsers).forEach((group) => {
      if (!expandedGroups.hasOwnProperty(group)) {
        newExpandedGroups[group] = true // По умолчанию все группы развернуты
      }
    })
    if (Object.keys(newExpandedGroups).length > 0) {
      setExpandedGroups((prev) => ({ ...prev, ...newExpandedGroups }))
    }
  }

  // Вызываем инициализацию при изменении групп
  React.useEffect(() => {
    initializeExpandedGroups()
  }, [groupBy, filteredUsers.length])

  const handleEditUser = (user: User) => {
    setSelectedUser(user)
    setIsDialogOpen(true)
  }

  const handleDeleteUser = async (userId: string) => {
    if (confirm("Вы уверены, что хотите удалить этого пользователя?")) {
      setIsDeleting(userId)
      try {
        await deleteUser(userId)
        onUserUpdated?.()
        toast({
          title: "Успешно",
          description: "Пользователь успешно удален",
        })
      } catch (error) {
        console.error("Ошибка при удалении пользователя:", error)
        toast({
          title: "Ошибка",
          description: "Не удалось удалить пользователя",
          variant: "destructive",
        })
      } finally {
        setIsDeleting(null)
      }
    }
  }

  const handleUserUpdated = () => {
    // Обновляем список пользователей после изменения
    onUserUpdated?.()
  }

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

  // Функция для получения общего количества отображаемых пользователей
  const getTotalDisplayedUsers = () => {
    if (groupBy !== "nested") {
      return filteredUsers.length
    } else {
      // Для вложенной группировки нужно посчитать сумму всех пользователей во всех командах
      let total = 0
      Object.values(groupedUsers as Record<string, Record<string, User[]>>).forEach((teams) => {
        Object.values(teams).forEach((users) => {
          total += users.length
        })
      })
      return total
    }
  }

  // Получаем общее количество отображаемых пользователей
  const totalDisplayedUsers = getTotalDisplayedUsers()

  // Формируем текст для счетчика
  const getCounterText = () => {
    const total = users.length
    const filtered = totalDisplayedUsers

    if (filtered === total) {
      return `Показано ${filtered} из ${total} сотрудников`
    } else {
      return `Отфильтровано: ${filtered} из ${total} сотрудников`
    }
  }

  return (
    <TooltipProvider>
      <Card>
        <CardContent className="p-0">
          <div className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center w-full">
              <div className="relative w-full sm:w-64 lg:w-96">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500 dark:text-gray-400" />
                <Input
                  type="search"
                  placeholder="Поиск пользователей..."
                  className="w-full pl-8"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="w-full sm:w-auto">
                <Select value={groupBy} onValueChange={(value) => setGroupBy(value as GroupBy)}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="Группировка" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Без группировки</SelectItem>
                    <SelectItem value="department">По отделам</SelectItem>
                    <SelectItem value="nested">Отделы и команды</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 ml-auto">
                <Users className="h-4 w-4 mr-1" />
                <span>{getCounterText()}</span>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-200 dark:border-gray-800">
            <div className="relative overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[300px]">Пользователь</TableHead>
                    <TableHead>Отдел</TableHead>
                    <TableHead>Команда</TableHead>
                    <TableHead>Должность</TableHead>
                    <TableHead>Категория</TableHead>
                    <TableHead>Роль</TableHead>
                    <TableHead>Расположение</TableHead>
                    {canEditAllUsers && <TableHead className="text-center">Действия</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groupBy !== "nested"
                    ? // Обычная группировка (без группировки или только по отделам)
                      Object.entries(groupedUsers as Record<string, User[]>).map(([groupName, groupUsers]) => (
                        <React.Fragment key={groupName || "ungrouped"}>
                          {groupName && (
                            <TableRow className="bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800/70 transition-colors">
                              <TableCell colSpan={canEditAllUsers ? 8 : 7} className="py-2 border-l-4 border-gray-200 dark:border-gray-700">
                                <div
                                  className="flex items-center cursor-pointer"
                                  onClick={() => toggleGroup(groupName)}
                                >
                                  {expandedGroups[groupName] ? (
                                    <ChevronDown className="h-4 w-4 mr-2 text-emerald-600 dark:text-emerald-500" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4 mr-2 text-emerald-600 dark:text-emerald-500" />
                                  )}
                                  <span className="font-medium">
                                    {groupBy === "department" ? "Отдел: " : ""}
                                    {groupName}
                                  </span>
                                  <span className="ml-2 text-gray-500 dark:text-gray-400 text-sm">
                                    ({groupUsers.length})
                                  </span>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}

                          {(groupName === "" || expandedGroups[groupName]) &&
                            groupUsers.map((user) => (
                              <TableRow key={user.id}>
                                <TableCell className="font-medium">
                                  <div className="flex items-center gap-3">
                                    <Avatar>
                                      <AvatarImage src={user.avatar_url || "/placeholder.svg"} alt={user.name} />
                                      <AvatarFallback>
                                        {user.name
                                          .split(" ")
                                          .map((n) => n[0])
                                          .join("")}
                                      </AvatarFallback>
                                    </Avatar>
                                    <div>
                                      <div className="font-medium">{user.name}</div>
                                      <div className="text-sm text-gray-500 dark:text-gray-400">{user.email}</div>
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell>{user.department}</TableCell>
                                <TableCell>{user.team}</TableCell>
                                <TableCell>{user.position}</TableCell>
                                <TableCell>{user.category}</TableCell>
                                <TableCell>{user.role}</TableCell>
                                <TableCell>
                                  {user.workLocation && (
                                    <TooltipProvider>
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
                                    </TooltipProvider>
                                  )}
                                </TableCell>
                                {canEditAllUsers && (
                                  <TableCell className="text-center">
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon">
                                          <MoreHorizontal className="h-4 w-4" />
                                          <span className="sr-only">Меню</span>
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => handleEditUser(user)}>
                                          <Edit className="mr-2 h-4 w-4" />
                                          Редактировать
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                          className="text-red-600 dark:text-red-400"
                                          onClick={() => handleDeleteUser(user.id)}
                                          disabled={isDeleting === user.id}
                                        >
                                          <Trash className="mr-2 h-4 w-4" />
                                          {isDeleting === user.id ? "Удаление..." : "Удалить"}
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </TableCell>
                                )}
                              </TableRow>
                            ))}
                        </React.Fragment>
                      ))
                    : // Вложенная группировка (отделы -> команды)
                      Object.entries(groupedUsers as Record<string, Record<string, User[]>>).map(
                        ([department, teams]) => (
                          <React.Fragment key={department}>
                            {/* Заголовок отдела */}
                            <TableRow className="bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800/70 transition-colors">
                              <TableCell colSpan={canEditAllUsers ? 8 : 7} className="py-2 border-l-4 border-gray-200 dark:border-gray-700">
                                <div
                                  className="flex items-center cursor-pointer"
                                  onClick={() => toggleGroup(department)}
                                >
                                  {expandedGroups[department] ? (
                                    <ChevronDown className="h-4 w-4 mr-2 text-emerald-600 dark:text-emerald-500" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4 mr-2 text-emerald-600 dark:text-emerald-500" />
                                  )}
                                  <span className="font-medium">{department}</span>
                                  <span className="ml-2 text-gray-500 dark:text-gray-400 text-sm">
                                    ({Object.values(teams).flat().length})
                                  </span>
                                </div>
                              </TableCell>
                            </TableRow>

                            {/* Команды внутри отдела */}
                            {expandedGroups[department] &&
                              Object.entries(teams).map(([team, users]) => (
                                <React.Fragment key={`${department}-${team}`}>
                                  {/* Заголовок команды */}
                                  <TableRow className="bg-gray-50/50 dark:bg-gray-800/30 hover:bg-gray-100/70 dark:hover:bg-gray-800/40 transition-colors">
                                    <TableCell
                                      colSpan={canEditAllUsers ? 8 : 7}
                                      className="py-1 pl-8 border-l-2 border-gray-200 dark:border-gray-700 ml-4"
                                    >
                                      <div
                                        className="flex items-center cursor-pointer"
                                        onClick={() => toggleGroup(`${department}-${team}`)}
                                      >
                                        {expandedGroups[`${department}-${team}`] ? (
                                          <ChevronDown className="h-3 w-3 mr-2 text-emerald-500 dark:text-emerald-400" />
                                        ) : (
                                          <ChevronRight className="h-3 w-3 mr-2 text-emerald-500 dark:text-emerald-400" />
                                        )}
                                        <span className="font-medium text-sm">{team}</span>
                                        <span className="ml-2 text-gray-500 dark:text-gray-400 text-xs">
                                          ({users.length})
                                        </span>
                                      </div>
                                    </TableCell>
                                  </TableRow>

                                  {/* Пользователи в команде */}
                                  {expandedGroups[`${department}-${team}`] &&
                                    users.map((user) => (
                                      <TableRow
                                        key={user.id}
                                        className="hover:bg-gray-50/80 dark:hover:bg-gray-900/30 transition-colors"
                                      >
                                        <TableCell className="font-medium pl-12">
                                          <div className="flex items-center gap-3">
                                            <Avatar>
                                              <AvatarImage src={user.avatar_url || "/placeholder.svg"} alt={user.name} />
                                              <AvatarFallback>
                                                {user.name
                                                  .split(" ")
                                                  .map((n) => n[0])
                                                  .join("")}
                                              </AvatarFallback>
                                            </Avatar>
                                            <div>
                                              <div className="font-medium">{user.name}</div>
                                              <div className="text-sm text-gray-500 dark:text-gray-400">
                                                {user.email}
                                              </div>
                                            </div>
                                          </div>
                                        </TableCell>
                                        <TableCell>{user.department}</TableCell>
                                        <TableCell>{user.team}</TableCell>
                                        <TableCell>{user.position}</TableCell>
                                        <TableCell>{user.category}</TableCell>
                                        <TableCell>{user.role}</TableCell>
                                        <TableCell>
                                          {user.workLocation && (
                                            <TooltipProvider>
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
                                            </TooltipProvider>
                                          )}
                                        </TableCell>
                                        {canEditAllUsers && (
                                          <TableCell className="text-center">
                                            <DropdownMenu>
                                              <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon">
                                                  <MoreHorizontal className="h-4 w-4" />
                                                  <span className="sr-only">Меню</span>
                                                </Button>
                                              </DropdownMenuTrigger>
                                              <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => handleEditUser(user)}>
                                                  <Edit className="mr-2 h-4 w-4" />
                                                  Редактировать
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem
                                                  className="text-red-600 dark:text-red-400"
                                                  onClick={() => handleDeleteUser(user.id)}
                                                  disabled={isDeleting === user.id}
                                                >
                                                  <Trash className="mr-2 h-4 w-4" />
                                                  {isDeleting === user.id ? "Удаление..." : "Удалить"}
                                                </DropdownMenuItem>
                                              </DropdownMenuContent>
                                            </DropdownMenu>
                                          </TableCell>
                                        )}
                                      </TableRow>
                                    ))}
                                </React.Fragment>
                              ))}
                          </React.Fragment>
                        ),
                      )}

                  {filteredUsers.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={canEditAllUsers ? 8 : 7} className="h-24 text-center">
                        Пользователи не найдены.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>

      <UserDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        user={selectedUser}
        onUserUpdated={handleUserUpdated}
      />
    </TooltipProvider>
  )
}
