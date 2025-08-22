"use client"

import React, { useState, useEffect, useCallback, useMemo } from "react"

import UsersList from "../components/users-list"
import { CurrentUserCard } from "../components/current-user-card"
import { AdminPanel } from "@/modules/users/admin"
import { AdminAccessCheck } from "../components/admin-access-check"
import { AddUserForm } from "../components/add-user-form"
import UserAnalytics from "../components/user-analytics"
import PaymentList from "../components/payment-list"
import { PaymentAccessCheck } from "../components/payment-access-check"
import { getUsers } from "@/services/org-data-service"
import type { User } from "@/types/db"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useSearchParams, useRouter } from "next/navigation"
import { PermissionGuard, PERMISSIONS } from "@/modules/permissions"

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  

  const searchParams = useSearchParams()
  const router = useRouter()
  const tabFromUrl = searchParams.get('tab')
  
  // Set initial tab value based on URL
  const [adminTab, setAdminTab] = useState(
    tabFromUrl && ["list", "add-user", "payment", "analytics", "admin"].includes(tabFromUrl)
      ? tabFromUrl
      : "list"
  )

  // ОПТИМИЗАЦИЯ: Мемоизируем функцию загрузки пользователей
  const loadUsers = useCallback(async () => {
    try {
      console.log("UsersPage: Начинаем загрузку пользователей")
      setIsLoading(true)
      setError(null)
      
      const loadedUsers = await getUsers()
      
      console.log("UsersPage: Загружено пользователей:", loadedUsers.length)
      setUsers(loadedUsers)

      // Устанавливаем текущего пользователя (первый в списке для демонстрации)
      if (loadedUsers.length > 0) {
        setCurrentUser(loadedUsers[0])
        console.log("UsersPage: Установлен текущий пользователь:", loadedUsers[0].name)
      }
    } catch (error) {
      console.error("UsersPage: Ошибка загрузки пользователей:", error)
      setError("Не удалось загрузить пользователей")
    } finally {
      setIsLoading(false)
      console.log("UsersPage: Загрузка завершена")
    }
  }, [])

  // Загрузка пользователей при монтировании
  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  // ОПТИМИЗАЦИЯ: Мемоизируем обработчик изменения вкладки
  const handleTabChange = useCallback((value: string) => {
    setAdminTab(value)
    router.replace(`/dashboard/users?tab=${value}`)
  }, [router])

  // ОПТИМИЗАЦИЯ: Мемоизируем обработчик обновления пользователя
  const handleUserUpdated = useCallback(() => {
    console.log("UsersPage: Пользователь обновлен, перезагружаем список")
    loadUsers()
  }, [loadUsers])

  // ОПТИМИЗАЦИЯ: Мемоизируем fallback пользователя
  const fallbackUser = useMemo(() => currentUser || {
    id: "current",
    name: "Текущий пользователь",
    email: "user@eneca.work",
    avatar_url: "/placeholder.svg?height=40&width=40&text=ТП",
    position: "Сотрудник",
    department: "Общий",
    team: "Основная команда",
    category: "Штатный сотрудник",
    role: "user",
    isActive: true,
    dateJoined: new Date().toISOString(),
    workLocation: "hybrid" as const,
    country: "Belarus",
    city: "Minsk",
    employmentRate: 1,
    salary: 1500,
    isHourly: false,
  }, [currentUser])

  if (error) {
    return (
      <div className="px-4 md:px-6 py-8">
        <div className="text-center">
          <div className="text-red-500 text-lg font-semibold mb-2">Ошибка</div>
          <div className="text-gray-600 mb-4">{error}</div>
          <button 
            onClick={loadUsers}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Попробовать снова
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="px-0 pt-0 pb-0">
      
      
      <div className="px-1 md:px-2 space-y-6">
        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mx-auto"></div>
              <p className="mt-4 text-gray-500">Загрузка пользователей...</p>
            </div>
          </div>
        ) : (
          <>
            {/* Карточка текущего пользователя */}
            <CurrentUserCard 
              fallbackUser={fallbackUser} 
              onUserUpdated={handleUserUpdated} 
            />

            {/* Вкладки */}
            <Tabs value={adminTab} onValueChange={handleTabChange} className="w-full">
              <TabsList className="flex-wrap h-auto items-start py-2 gap-y-1">
                <TabsTrigger value="list">Список пользователей</TabsTrigger>
                <TabsTrigger value="add-user">Ручное добавление</TabsTrigger>
                <TabsTrigger value="payment">Оплата</TabsTrigger>
                <TabsTrigger value="analytics">Аналитика</TabsTrigger>
                <PermissionGuard permission={PERMISSIONS.USERS.ADMIN_PANEL}>
                  <TabsTrigger value="admin">Администратор</TabsTrigger>
                </PermissionGuard>
              </TabsList>
              
              <TabsContent value="list" className="space-y-4">
                <UsersList 
                  users={users} 
                  onUserUpdated={handleUserUpdated} 
                />
              </TabsContent>
              
              <TabsContent value="add-user" className="space-y-4">
                <AddUserForm onUserAdded={handleUserUpdated} />
              </TabsContent>
              
              <TabsContent value="payment" className="space-y-4">
                <PaymentAccessCheck>
                  <PaymentList users={users} filters={{
                    departments: [],
                    teams: [],
                    categories: [],
                    positions: [],
                    workLocations: [],
                    roles: []
                  }} />
                </PaymentAccessCheck>
              </TabsContent>
              
              <TabsContent value="analytics">
                <UserAnalytics />
              </TabsContent>
              
              <TabsContent value="admin">
                <AdminAccessCheck>
                  <AdminPanel />
                </AdminAccessCheck>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </div>
  )
}
