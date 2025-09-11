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

const TAB_LABELS = {
  departments: "Отделы",
  teams: "Команды", 
  positions: "Должности",
  categories: "Категории",
  roles: "Управление ролями"
} as const

const TAB_COMPONENTS = {
  departments: DepartmentsTab,
  teams: TeamsTab,
  positions: PositionsTab,
  categories: CategoriesTab,
  roles: RolesTab
} as const

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState<keyof typeof TAB_LABELS>("departments")
  const perms = useAdminPermissions()
  const userProfile = useUserStore(state => state.profile)

  // Определяем, какие вкладки показывать
  const visibleTabs = useMemo(() => {
    return {
      departments: perms.canManageDepartments || perms.canEditDepartment,
      teams: perms.canManageTeams || perms.canEditTeam,
      positions: perms.canManagePositions,
      categories: perms.canManageCategories,
      roles: perms.canManageRoles
    }
  }, [perms])

  // Подбираем первый доступный таб
  const firstVisibleTab = useMemo<keyof typeof TAB_LABELS | null>(() => {
    const order: (keyof typeof TAB_LABELS)[] = ["departments", "teams", "positions", "categories", "roles"]
    for (const key of order) {
      if ((visibleTabs as any)[key]) return key
    }
    return null
  }, [visibleTabs])

  // Если активная вкладка скрыта, переключаемся на первую доступную
  useEffect(() => {
    const isActiveVisible = (visibleTabs as any)[activeTab]
    if (!isActiveVisible && firstVisibleTab) {
      setActiveTab(firstVisibleTab)
    }
  }, [visibleTabs, activeTab, firstVisibleTab])
  
  return (
    <NotificationProvider>
      <Toaster 
        richColors 
        position="top-right" 
        theme="system"
        className="toaster-with-shadow"
      />
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as keyof typeof TAB_LABELS)} className="w-full">
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
              scope={perms.canManageDepartments ? 'all' : 'department'}
              departmentId={perms.canManageDepartments ? null : (userProfile?.departmentId || userProfile?.department_id || null)}
            />
          </TabsContent>
        )}

        {visibleTabs.teams && (
          <TabsContent value="teams">
            <TeamsTab 
              scope={perms.canManageTeams ? 'all' : 'department'}
              departmentId={perms.canManageTeams ? null : (userProfile?.departmentId || userProfile?.department_id || null)}
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