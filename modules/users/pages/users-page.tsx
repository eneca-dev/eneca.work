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
import { AdminPanel } from "@/modules/users/admin"
import { useUserStore } from "@/stores/useUserStore"
import { AdminAccessCheck } from "../components/admin-access-check"
import { useSearchParams, useRouter } from "next/navigation"

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
  
  const searchParams = useSearchParams()
  const router = useRouter()
  const tabFromUrl = searchParams.get('tab')
  const permissions = useUserStore((state) => state.permissions)
  const canViewAdminPanel = permissions.includes("user_admin_panel_can_view")
  
  // Set initial tab value based on URL
  const [adminTab, setAdminTab] = useState(
    tabFromUrl && ["list", "payment", "analytics", "admin"].includes(tabFromUrl)
      ? tabFromUrl
      : "list"
  )

  // If user switched to admin tab but doesn't have permission, reset to list
  useEffect(() => {
    if (adminTab === "admin" && !canViewAdminPanel) {
      setAdminTab("list")
      
      // Update URL, removing tab=admin parameter
      if (tabFromUrl === "admin") {
        router.replace("/dashboard/users?tab=list")
      }
    }
  }, [adminTab, canViewAdminPanel, tabFromUrl, router])
  
  // Update URL when tab changes
  const handleTabChange = (value: string) => {
    setAdminTab(value)
    router.replace(`/dashboard/users?tab=${value}`)
  }

  const loadUsers = async () => {
    try {
      setIsLoading(true)
      const loadedUsers = await getUsers()
      setUsers(loadedUsers)

      // Get current user (first in list for demonstration)
      if (loadedUsers.length > 0) {
        setCurrentUser(loadedUsers[0])
      }
    } catch (error) {
      console.error("Error loading users:", error)
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
    // Reload user list after update
    loadUsers()
  }

  // If data is loading, show loading indicator
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mx-auto"></div>
          <p className="mt-4 text-gray-500">Loading data...</p>
        </div>
      </div>
    )
  }

  // If no current user, create fallback
  const defaultUser = currentUser || {
    id: "current",
    name: "Иван Иванов",
    email: "ivan@eneca.work",
    avatar_url: "/placeholder.svg?height=40&width=40&text=ИИ",
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

      <CurrentUserCard fallbackUser={defaultUser} onUserUpdated={handleUserUpdated} />

      <Tabs value={adminTab} onValueChange={handleTabChange} className="w-full">
        <TabsList>
          <TabsTrigger value="list">Список пользователей</TabsTrigger>
          <TabsTrigger value="payment">Оплата</TabsTrigger>
          <TabsTrigger value="analytics">Аналитика</TabsTrigger>
          {canViewAdminPanel && <TabsTrigger value="admin">Администратор</TabsTrigger>}
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
        <TabsContent value="admin">
          <AdminAccessCheck>
            <AdminPanel />
          </AdminAccessCheck>
        </TabsContent>
      </Tabs>
    </div>
  )
}
