"use client"

import React from "react"
import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
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
import { Edit, MoreHorizontal, Search, Clock, DollarSign, Users } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import type { User } from "../lib/types"
import { useRouter } from "next/navigation"
import { PaymentDialog } from "./payment-dialog"

interface PaymentListProps {
  users: User[]
  filters: {
    departments: string[]
    teams: string[]
    categories: string[]
    positions: string[]
    workLocations: string[]
    roles: string[]
  }
}

export default function PaymentList({ users: initialUsers, filters: initialFilters }: PaymentListProps) {
  const [users, setUsers] = useState<User[]>(initialUsers)
  const [filteredUsers, setFilteredUsers] = useState<User[]>(initialUsers)
  const [searchTerm, setSearchTerm] = useState("")
  const [groupBy, setGroupBy] = useState<"none" | "department" | "team">("none")
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})
  const router = useRouter()

  // Состояние для фильтров
  const [filters, setFilters] = useState(initialFilters)

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)

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

    if (filters.positions.length > 0) {
      result = result.filter((user) => filters.positions.includes(user.position))
    }

    if (filters.workLocations.length > 0) {
      result = result.filter((user) => user.workLocation && filters.workLocations.includes(user.workLocation))
    }

    if (filters.roles.length > 0) {
      result = result.filter((user) => filters.roles.includes(user.role))
    }

    setFilteredUsers(result)
  }, [users, searchTerm, filters])

  useEffect(() => {
    setFilters(initialFilters)
  }, [initialFilters])

  // Группировка пользователей
  const groupUsers = () => {
    if (groupBy === "none") return { "": filteredUsers }

    const groups: Record<string, User[]> = {}

    filteredUsers.forEach((user) => {
      const groupKey = groupBy === "department" ? user.department : user.team
      if (!groups[groupKey]) {
        groups[groupKey] = []
      }
      groups[groupKey].push(user)
    })

    return groups
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

  const handleEditPayment = (user: User) => {
    setSelectedUser(user)
    setIsDialogOpen(true)
  }

  // Функция для форматирования зарплаты
  const formatSalary = (salary: number, isHourly: boolean) => {
    return (
      new Intl.NumberFormat("ru-BY", {
        style: "currency",
        currency: "BYN",
        minimumFractionDigits: isHourly ? 2 : 0,
        maximumFractionDigits: isHourly ? 2 : 0,
      }).format(salary) + (isHourly ? "/час" : "/мес")
    )
  }

  // Функция для отображения занятости
  const getEmploymentRateBadge = (rate: number) => {
    let color = "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300"

    if (rate < 0.5) {
      color = "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300"
    } else if (rate < 1) {
      color = "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300"
    } else if (rate === 1) {
      color = "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
    } else {
      color = "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300"
    }

    return (
      <Badge variant="outline" className={`${color}`}>
        {rate * 100}%
      </Badge>
    )
  }

  // Функция для получения общего количества отображаемых пользователей
  const getTotalDisplayedUsers = () => {
    return filteredUsers.length
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

  // Расчет общей суммы зарплат
  const getTotalSalary = () => {
    return filteredUsers.reduce((total, user) => {
      const employmentRate = user.employmentRate || 1
      const salary = user.salary || 0
      // Для почасовой оплаты считаем примерную месячную зарплату (168 часов в месяц)
      const monthlySalary = user.isHourly ? salary * 168 * employmentRate : salary * employmentRate
      return total + monthlySalary
    }, 0)
  }

  const totalSalary = getTotalSalary()

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
                  placeholder="Поиск сотрудников..."
                  className="w-full pl-8"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="w-full sm:w-auto">
                <Select value={groupBy} onValueChange={(value) => setGroupBy(value as "none" | "department" | "team")}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="Группировка" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Без группировки</SelectItem>
                    <SelectItem value="department">По отделам</SelectItem>
                    <SelectItem value="team">По командам</SelectItem>
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
            <div className="p-4 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
              <div className="text-sm font-medium">
                Общий фонд оплаты труда:
                <span className="ml-2 text-emerald-600 dark:text-emerald-400 font-bold">
                  {new Intl.NumberFormat("ru-BY", {
                    style: "currency",
                    currency: "BYN",
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  }).format(totalSalary)}
                </span>
              </div>
            </div>
            <div className="relative overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[250px]">Сотрудник</TableHead>
                    <TableHead>Отдел / Команда</TableHead>
                    <TableHead>Должность</TableHead>
                    <TableHead>Занятость</TableHead>
                    <TableHead>Тип оплаты</TableHead>
                    <TableHead>Ставка</TableHead>
                    <TableHead className="text-right">Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(groupedUsers).map(([groupName, groupUsers]) => (
                    <React.Fragment key={groupName || "ungrouped"}>
                      {groupName && (
                        <TableRow className="bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800/70 transition-colors">
                          <TableCell colSpan={7} className="py-1 border-l-4 border-gray-200 dark:border-gray-700">
                            <div className="flex items-center cursor-pointer" onClick={() => toggleGroup(groupName)}>
                              {expandedGroups[groupName] ? (
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  width="16"
                                  height="16"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  className="mr-2 text-emerald-600 dark:text-emerald-500"
                                >
                                  <path d="m18 15-6-6-6 6" />
                                </svg>
                              ) : (
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  width="16"
                                  height="16"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  className="mr-2 text-emerald-600 dark:text-emerald-500"
                                >
                                  <path d="m9 18 6-6-6-6" />
                                </svg>
                              )}
                              <span className="font-medium">
                                {groupBy === "department" ? "Отдел: " : groupBy === "team" ? "Команда: " : ""}
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
                          <TableRow key={user.id} className="h-12">
                            <TableCell className="py-1">
                              <div className="flex items-center gap-2">
                                <Avatar className="h-8 w-8">
                                  <AvatarImage src={user.avatar_url || "/placeholder.svg"} alt={user.name} />
                                  <AvatarFallback>
                                    {user.name
                                      .split(" ")
                                      .map((n) => n[0])
                                      .join("")}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <div className="font-medium text-sm">{user.name}</div>
                                  <div className="text-xs text-gray-500 dark:text-gray-400">{user.email}</div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="py-1">
                              <div className="text-sm">{user.department}</div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">{user.team}</div>
                            </TableCell>
                            <TableCell className="py-1">
                              <div className="text-sm">{user.position}</div>
                            </TableCell>
                            <TableCell className="py-1">{getEmploymentRateBadge(user.employmentRate)}</TableCell>
                            <TableCell className="py-1">
                              <div className="flex items-center">
                                {user.isHourly ? (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div className="flex items-center text-blue-600 dark:text-blue-400">
                                        <Clock className="h-4 w-4 mr-1" />
                                        <span className="text-sm">Почасовая</span>
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Оплата за час работы</p>
                                    </TooltipContent>
                                  </Tooltip>
                                ) : (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div className="flex items-center text-green-600 dark:text-green-400">
                                        <DollarSign className="h-4 w-4 mr-1" />
                                        <span className="text-sm">Оклад</span>
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Фиксированный месячный оклад</p>
                                    </TooltipContent>
                                  </Tooltip>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="py-1">
                              <div className="font-medium text-sm">
                                {formatSalary(user.salary || 0, user.isHourly || false)}
                              </div>
                            </TableCell>
                            <TableCell className="text-right py-1">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                    <MoreHorizontal className="h-4 w-4" />
                                    <span className="sr-only">Меню</span>
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => handleEditPayment(user)}>
                                    <Edit className="mr-2 h-4 w-4" />
                                    Редактировать оплату
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem>
                                    <DollarSign className="mr-2 h-4 w-4" />
                                    История выплат
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))}
                    </React.Fragment>
                  ))}

                  {filteredUsers.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center">
                        Сотрудники не найдены.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>
      <PaymentDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        user={selectedUser}
        onUserUpdated={() => router.refresh()}
      />
    </TooltipProvider>
  )
}
