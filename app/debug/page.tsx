"use client"

import { useState, useEffect } from "react"
import { useUserStore } from "@/stores/useUserStore"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function DebugPage() {
  const [refreshCounter, setRefreshCounter] = useState(0)
  const userState = useUserStore()
  
  useEffect(() => {
    console.log("Страница отладки обновлена, состояние:", userState)
  }, [userState, refreshCounter])
  
  const handleRefresh = () => {
    setRefreshCounter(prev => prev + 1)
  }
  
  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Отладка: сырые данные</h1>
        <Button onClick={handleRefresh}>Перезагрузить</Button>
      </div>
      
      <Card>
        <CardHeader className="bg-primary/5">
          <CardTitle>Состояние пользователя (Zustand)</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <pre className="bg-gray-100 dark:bg-gray-800 p-4 rounded-md overflow-auto text-xs">
            {JSON.stringify(userState, null, 2)}
          </pre>
        </CardContent>
      </Card>
    </div>
  )
} 