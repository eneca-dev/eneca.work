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
} as const;

export default function AdminPanel() {
  const [tab, setTab] = useState("departments")
  
  return (
    <NotificationProvider>
      <Toaster 
        richColors 
        position="top-right" 
        theme="system"
        className="toaster-with-shadow"
      />
      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="departments">{TAB_LABELS.departments}</TabsTrigger>
          <TabsTrigger value="teams">{TAB_LABELS.teams}</TabsTrigger>
          <TabsTrigger value="positions">{TAB_LABELS.positions}</TabsTrigger>
          <TabsTrigger value="categories">{TAB_LABELS.categories}</TabsTrigger>
          <TabsTrigger value="roles">{TAB_LABELS.roles}</TabsTrigger>
        </TabsList>
        <TabsContent value="departments"><DepartmentsTab /></TabsContent>
        <TabsContent value="teams"><TeamsTab /></TabsContent>
        <TabsContent value="positions"><PositionsTab /></TabsContent>
        <TabsContent value="categories"><CategoriesTab /></TabsContent>
        <TabsContent value="roles"><RolesTab /></TabsContent>
      </Tabs>
    </NotificationProvider>
  )
} 