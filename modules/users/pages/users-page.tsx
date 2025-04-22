"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import UsersList from "../components/users-list"
import UserAnalytics from "../components/user-analytics"
import PaymentList from "../components/payment-list"
import { UserFilters } from "../components/user-filters"
import { CurrentUserCard } from "../components/current-user-card"
import { getUsers } from "@/services/org-data-service"
import { useState, useEffect } from "react"
import type { User } from "@/types/db"
import { PaymentAccessCheck } from "../components/payment-access-check"

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [filters, setFilters] = useState({
    departments: [] as string[],
    teams: [] as string[],
    categories: [] as string[],
    positions: [] as string[],
    workLocations: [] as string[],
  })

  const loadUsers = async () => {
    try {
      setIsLoading(true)
      const loadedUsers = await getUsers()
      setUsers(loadedUsers)

      // Получаем текущего пользователя (первого в списке для демонстрации)
      if (loadedUsers.length > 0) {
        setCurrentUser(loadedUsers[0])
      }
    } catch (error) {
      console.error("Ошибка загрузки пользователей:", error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadUsers()
  }, [])

  const handleFilterChange = (newFilters: {
    departments: string[]
    teams: string[]
    categories: string[]
    positions: string[]
    workLocations: string[]
  }) => {
    setFilters(newFilters)
  }

  const handleUserUpdated = () => {
    // Перезагружаем список пользователей после обновления
    loadUsers()
  }

  // Если данные загружаются, показываем индикатор загрузки
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mx-auto"></div>
          <p className="mt-4 text-gray-500">Загрузка данных...</p>
        </div>
      </div>
    )
  }

  // Если нет текущего пользователя, создаем заглушку
  const defaultUser = currentUser || {
    id: "current",
    name: "Иван Иванов",
    email: "ivan@eneca.work",
    avatar: "/placeholder.svg?height=40&width=40&text=ИИ",
    position: "Разработчик",
    department: "Разработка",
    team: "Frontend",
    category: "Штатный сотрудник",
    isActive: true,
    dateJoined: new Date().toISOString(),
    workLocation: "hybrid" as const,
    address: "ул. Ленина, 10, Москва / Домашний офис",
    employmentRate: 1,
    salary: 1500,
    isHourly: false,
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Управление пользователями</h1>
      </div>

      <CurrentUserCard user={defaultUser} onUserUpdated={handleUserUpdated} />

      <Tabs defaultValue="list" className="w-full">
        <TabsList>
          <TabsTrigger value="list">Список пользователей</TabsTrigger>
          <TabsTrigger value="payment">Оплата</TabsTrigger>
          <TabsTrigger value="analytics">Аналитика</TabsTrigger>
        </TabsList>
        <TabsContent value="list" className="space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="w-full md:w-64 lg:w-72">
              <UserFilters onFilterChange={handleFilterChange} users={users} />
            </div>
            <div className="flex-1">
              <UsersList users={users} filters={filters} />
            </div>
          </div>
        </TabsContent>
        <TabsContent value="payment" className="space-y-4">
          <PaymentAccessCheck>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="w-full md:w-64 lg:w-72">
                <UserFilters onFilterChange={handleFilterChange} users={users} />
              </div>
              <div className="flex-1">
                <PaymentList users={users} filters={filters} />
              </div>
            </div>
          </PaymentAccessCheck>
        </TabsContent>
        <TabsContent value="analytics">
          <UserAnalytics />
        </TabsContent>
      </Tabs>
    </div>
  )
}
