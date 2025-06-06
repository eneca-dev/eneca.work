"use client"

import { useState } from "react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import DepartmentsTab from "./components/DepartmentsTab"
import TeamsTab from "./components/TeamsTab"
import PositionsTab from "./components/PositionsTab"
import CategoriesTab from "./components/CategoriesTab"
import RolesTab from "./components/RolesTab"
import { Toaster } from "sonner"
import { NotificationProvider } from "@/lib/notification-context"

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
          {Object.entries(TAB_LABELS).map(([key, label]) => (
            <TabsTrigger key={key} value={key}>
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
        
        {Object.entries(TAB_COMPONENTS).map(([key, Component]) => (
          <TabsContent key={key} value={key}>
            <Component />
          </TabsContent>
        ))}
      </Tabs>
    </NotificationProvider>
  )
} 