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
          <TabsTrigger value="departments">Отделы</TabsTrigger>
          <TabsTrigger value="teams">Команды</TabsTrigger>
          <TabsTrigger value="positions">Должности</TabsTrigger>
          <TabsTrigger value="categories">Категории</TabsTrigger>
          <TabsTrigger value="roles">Управление ролями</TabsTrigger>
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