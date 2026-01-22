"use client"

import React, { useState, useEffect, useCallback, useMemo } from "react"
import * as Sentry from "@sentry/nextjs"

import UsersList from "../components/users-list"
import CurrentUserCard from "../components/current-user-card"
import { AdminPanel } from "@/modules/users/admin"
import { AdminAccessCheck } from "../components/admin-access-check"
import AddUserForm from "../components/add-user-form"
import UserAnalytics from "../components/user-analytics"
import { getUsers } from "@/services/org-data-service"
import type { UserWithRoles } from "@/types/db"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useSearchParams, useRouter } from "next/navigation"
import { PermissionGuard } from "@/modules/permissions"
import { toast } from "@/components/ui/use-toast"
// Отладочный флаг для управления console.log вызовами
const debug = process.env.NEXT_PUBLIC_DEBUG === "true"

export default function UsersPage() {
  const [users, setUsers] = useState<UserWithRoles[]>([])
  const [currentUser, setCurrentUser] = useState<UserWithRoles | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  

  const searchParams = useSearchParams()
  const router = useRouter()
  const tabFromUrl = searchParams.get('tab')
  
  // Set initial tab value based on URL
  const [adminTab, setAdminTab] = useState(
    tabFromUrl && ["list", "add-user", "analytics", "admin"].includes(tabFromUrl)
      ? tabFromUrl
      : "list"
  )

  // ОПТИМИЗАЦИЯ: Мемоизируем функцию загрузки пользователей
  const loadUsers = useCallback(async () => {
    try {
      debug && console.log("UsersPage: Начинаем загрузку пользователей")
      setIsLoading(true)
      setError(null)
      
      const loadedUsers = await getUsers()

      debug && console.log("UsersPage: Загружено пользователей:", loadedUsers.length)
      setUsers(loadedUsers)

      // Устанавливаем текущего пользователя (первый в списке для демонстрации)
      if (loadedUsers.length > 0) {
        setCurrentUser(loadedUsers[0])
        debug && console.log("UsersPage: Установлен текущий пользователь:", loadedUsers[0].full_name)
      }
    } catch (error) {
      debug && console.error("UsersPage: Ошибка загрузки пользователей:", error)
      Sentry.captureException(error, { tags: { module: 'users', component: 'UsersPage', action: 'load_users', error_type: 'unexpected' } })
      setError("Не удалось загрузить пользователей")
    } finally {
      setIsLoading(false)
      debug && console.log("UsersPage: Загрузка завершена")
    }
  }, [])

  // Загрузка пользователей при монтировании
  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  // ОПТИМИЗАЦИЯ: Мемоизируем обработчик изменения вкладки
  const handleTabChange = useCallback((value: string) => {
    setAdminTab(value)
    router.replace(`/users?tab=${value}`)
  }, [router])

  // ОПТИМИЗАЦИЯ: Мемоизируем обработчик обновления пользователя
  const handleUserUpdated = useCallback(() => {
    debug && console.log("UsersPage: Пользователь обновлен, перезагружаем список")
    loadUsers()
  }, [loadUsers])

  // Принудительное обновление данных с индикатором загрузки
  const forceRefresh = useCallback(async () => {
    Sentry.addBreadcrumb({
      category: 'ui.action',
      level: 'info',
      message: 'UsersPage: forceRefresh clicked'
    })
    console.log("🔄 Принудительное обновление списка пользователей...")
    try {
      await Sentry.startSpan({ name: 'Users/UsersPage forceRefresh', op: 'ui.action' }, async () => {
        await loadUsers()
      })
      toast({
        title: "Данные обновлены",
        description: "Список пользователей успешно обновлён"
      })
    } catch (error) {
      console.error("Ошибка при обновлении данных:", error)
      toast({
        title: "Ошибка",
        description: "Не удалось обновить данные",
        variant: "destructive"
      })
    }
  }, [loadUsers])

  // ОПТИМИЗАЦИЯ: Мемоизируем fallback пользователя
  const fallbackUser = useMemo(() => currentUser || {
    user_id: "current",
    first_name: "Текущий",
    last_name: "пользователь",
    full_name: "Текущий пользователь",
    email: "user@eneca.work",
    avatar_url: "/placeholder.svg?height=40&width=40&text=ТП",
    position_name: "Сотрудник",
    department_name: "Общий",
    team_name: "Основная команда",
    category_name: "Штатный сотрудник",
    role_name: "user",
    is_active: true,
    created_at: new Date().toISOString(),
    work_format: "hybrid",
    country_name: "Belarus",
    city_name: "Minsk",
    employment_rate: "1",
    salary: "1500",
    is_hourly: false,
    roles_display_string: "user (осн.)",
    roles_count: 1,
    has_multiple_roles: false,
    // Остальные поля
    department_id: null,
    team_id: null,
    position_id: null,
    category_id: null,
    role_id: null,
    city_id: null,
    country_id: null,
    role_description: null
  }, [currentUser])

  // Преобразуем UserWithRoles в User для совместимости с компонентами
  const usersAsUserType = useMemo(() => {
    const transformed = users.map(user => ({
      id: user.user_id,
      name: user.full_name,
      email: user.email,
      avatar_url: user.avatar_url || undefined,
      position: user.position_name || "",
      subdivision: user.subdivision_name || "",
      subdivisionId: user.subdivision_id || undefined,
      department: user.department_name || "",
      departmentId: user.department_id || undefined,
      team: user.team_name || "",
      teamId: user.team_id || undefined,
      category: user.category_name || "",
      role: user.roles_display_string || "",
      roles_display_string: user.roles_display_string || "", // Добавляем явно
      dateJoined: user.created_at,
      workLocation: (user.work_format === "В офисе" ? "office" : user.work_format === "Удаленно" ? "remote" : "hybrid") as "office" | "remote" | "hybrid",
      country: user.country_name || "",
      city: user.city_name || "",
      employmentRate: user.employment_rate ? parseFloat(user.employment_rate) : 1,
      // Не подменяем: если salary отсутствует, оставляем как 0, а UI покажет "—"
      salary: user.salary ? parseFloat(user.salary) : 0,
      isHourly: user.is_hourly || false
    }))
    
    // ДИАГНОСТИКА: Проверяем что передается в UsersList
    if (transformed.length > 0) {
      const vadim = transformed.find(u => u.email === 'ghgjob123@gmail.com');
      if (vadim) {
        debug && console.log("=== USERS PAGE: ДАННЫЕ ДЛЯ USERSLIST ===");
        debug && console.log("Вадим в usersAsUserType:", vadim);
        debug && console.log("role:", vadim.role);
        debug && console.log("roles_display_string:", vadim.roles_display_string);
      }
    }
    
    return transformed
  }, [users])

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
        {isLoading && users.length === 0 ? (
          <div className="flex justify-center items-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mx-auto"></div>
              <p className="mt-4 text-gray-500">Загрузка пользователей...</p>
            </div>
          </div>
        ) : (
          <>
            {/* Карточка текущего пользователя */}
            <div className="mb-6">
              <CurrentUserCard 
                fallbackUser={{
                  id: fallbackUser.user_id,
                  name: fallbackUser.full_name,
                  email: fallbackUser.email,
                  avatar_url: fallbackUser.avatar_url || undefined,
                  position: fallbackUser.position_name || "",
                  department: fallbackUser.department_name || "",
                  team: fallbackUser.team_name || "",
                  category: fallbackUser.category_name || "",
                  role: fallbackUser.roles_display_string || "",
                  dateJoined: fallbackUser.created_at,
                  workLocation: (fallbackUser.work_format === "В офисе" ? "office" : fallbackUser.work_format === "Удаленно" ? "remote" : "hybrid") as "office" | "remote" | "hybrid",
                  country: fallbackUser.country_name || "",
                  city: fallbackUser.city_name || "",
                  employmentRate: fallbackUser.employment_rate ? parseFloat(fallbackUser.employment_rate) : 1,
                  salary: fallbackUser.salary ? parseFloat(fallbackUser.salary) : 1500,
                  isHourly: fallbackUser.is_hourly || false
                }}
                onUserUpdated={handleUserUpdated} 
              />
            </div>

            {/* Вкладки */}
            <Tabs value={adminTab} onValueChange={handleTabChange} className="w-full">
              <TabsList className="flex-wrap h-auto items-start py-2 gap-y-1">
                <TabsTrigger value="list">Список пользователей</TabsTrigger>
                {/* Показываем кнопку "Ручное добавление" только при users.manual_addition */}
                <PermissionGuard permission="users.manual_addition">
                  <TabsTrigger value="add-user">Ручное добавление</TabsTrigger>
                </PermissionGuard>
                <TabsTrigger value="analytics">Аналитика</TabsTrigger>
                {/* Показываем кнопку "Администратор" только при users.admin_panel */}
                <PermissionGuard permission="users.admin_panel">
                  <TabsTrigger value="admin">Администратор</TabsTrigger>
                </PermissionGuard>
              </TabsList>
              
              <TabsContent value="list" className="space-y-4">
                <UsersList
                  users={usersAsUserType}
                  onUserUpdated={handleUserUpdated}
                  onRefresh={forceRefresh}
                  isRefreshing={isLoading}
                />
              </TabsContent>
              
              <TabsContent value="add-user" className="space-y-4">
                <PermissionGuard permission="users.manual_addition">
                  <AddUserForm onUserAdded={handleUserUpdated} />
                </PermissionGuard>
              </TabsContent>
              
              
              <TabsContent value="analytics" className="space-y-4">
                <UserAnalytics />
              </TabsContent>
              
              <TabsContent value="admin">
                <AdminAccessCheck>
                  <PermissionGuard permission="users.admin_panel">
                    <AdminPanel />
                  </PermissionGuard>
                </AdminAccessCheck>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </div>
  )
}
