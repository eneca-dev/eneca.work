"use client"

import { useEffect, useMemo, useState } from "react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import DepartmentsTab from "./components/DepartmentsTab"
import TeamsTab from "./components/TeamsTab"
import PositionsTab from "./components/PositionsTab"
import CategoriesTab from "./components/CategoriesTab"
import RolesTab from "./components/RolesTab"
import { Toaster } from "sonner"
import { NotificationProvider } from "@/lib/notification-context"
import { useAdminPermissions } from "./hooks/useAdminPermissions"
import { useUserStore } from "@/stores/useUserStore"

// Определяем типы для вкладок
type TabKey = "departments" | "teams" | "positions" | "categories" | "roles"
type VisibleTabs = Record<TabKey, boolean>

const TAB_LABELS = {
  departments: "Отделы",
  teams: "Команды",
  positions: "Должности",
  categories: "Категории",
  roles: "Управление ролями"
} as const

// Порядок вкладок для определения первой доступной
export const TAB_ORDER: (keyof typeof TAB_LABELS)[] = [
  "departments",
  "teams",
  "positions",
  "categories",
  "roles"
]


export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState<TabKey>("departments")
  const perms = useAdminPermissions()
  const userProfile = useUserStore(state => state.profile)

  // Определяем, какие вкладки показывать
  const visibleTabs = useMemo<VisibleTabs>(() => {
    return {
      departments: perms.canManageDepartments || perms.canEditDepartment,
      teams: perms.canManageTeams || perms.canEditTeam,
      positions: perms.canManagePositions,
      categories: perms.canManageCategories,
      roles: perms.canManageRoles
    }
  }, [perms])

  // Подбираем первый доступный таб
  const firstVisibleTab = useMemo<TabKey | null>(() => {
    for (const key of TAB_ORDER) {
      if (visibleTabs[key]) return key
    }
    return null
  }, [visibleTabs])

  // Если активная вкладка скрыта, переключаемся на первую доступную
  useEffect(() => {
    const isActiveVisible = visibleTabs[activeTab]
    if (!isActiveVisible && firstVisibleTab) {
      setActiveTab(firstVisibleTab)
    }
  }, [visibleTabs, activeTab, firstVisibleTab])

  // Если нет доступных вкладок, показываем пустое состояние
  if (!firstVisibleTab) {
    return (
      <NotificationProvider>
        <Toaster
          richColors
          position="top-right"
          theme="system"
          className="toaster-with-shadow"
        />
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          <p>Нет доступных разделов</p>
        </div>
      </NotificationProvider>
    )
  }

  return (
    <NotificationProvider>
      <Toaster
        richColors
        position="top-right"
        theme="system"
        className="toaster-with-shadow"
      />
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TabKey)} className="w-full">
        <TabsList className="mb-6">
          {visibleTabs.departments && (
            <TabsTrigger value="departments">{TAB_LABELS.departments}</TabsTrigger>
          )}
          {visibleTabs.teams && (
            <TabsTrigger value="teams">{TAB_LABELS.teams}</TabsTrigger>
          )}
          {visibleTabs.positions && (
            <TabsTrigger value="positions">{TAB_LABELS.positions}</TabsTrigger>
          )}
          {visibleTabs.categories && (
            <TabsTrigger value="categories">{TAB_LABELS.categories}</TabsTrigger>
          )}
          {visibleTabs.roles && (
            <TabsTrigger value="roles">{TAB_LABELS.roles}</TabsTrigger>
          )}
        </TabsList>

        {visibleTabs.departments && (
          <TabsContent value="departments">
            <DepartmentsTab
              {...(perms.canManageDepartments
                ? {}
                : (() => {
                    const deptId = userProfile?.departmentId || userProfile?.department_id
                    return deptId ? { scope: 'department', departmentId: deptId } : {}
                  })()
              )}
            />
          </TabsContent>
        )}

        {visibleTabs.teams && (
          <TabsContent value="teams">
            <TeamsTab
              {...(perms.canManageTeams
                ? {}
                : (() => {
                    const deptId = userProfile?.departmentId || userProfile?.department_id
                    return deptId ? { scope: 'department', departmentId: deptId } : {}
                  })()
              )}
            />
          </TabsContent>
        )}

        {visibleTabs.positions && (
          <TabsContent value="positions">
            <PositionsTab />
          </TabsContent>
        )}

        {visibleTabs.categories && (
          <TabsContent value="categories">
            <CategoriesTab />
          </TabsContent>
        )}

        {visibleTabs.roles && (
          <TabsContent value="roles">
            <RolesTab />
          </TabsContent>
        )}
      </Tabs>
    </NotificationProvider>
  )
} 