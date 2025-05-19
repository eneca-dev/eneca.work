import { useState } from "react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import DepartmentsTab from "./DepartmentsTab"
import TeamsTab from "./TeamsTab"
import PositionsTab from "./PositionsTab"
import CategoriesTab from "./CategoriesTab"
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
        </TabsList>
        <TabsContent value="departments"><DepartmentsTab /></TabsContent>
        <TabsContent value="teams"><TeamsTab /></TabsContent>
        <TabsContent value="positions"><PositionsTab /></TabsContent>
        <TabsContent value="categories"><CategoriesTab /></TabsContent>
      </Tabs>
    </NotificationProvider>
  )
} 