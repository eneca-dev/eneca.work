"use client"

import { useState, useEffect } from "react"
import { useUserStore } from "@/stores/useUserStore"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { createClient } from "@/utils/supabase/client"
import { Copy, RefreshCw } from "lucide-react"
import { toast } from "@/components/ui/use-toast"
// УДАЛЕНО: Legacy import syncCurrentUserState - теперь синхронизация автоматическая

export default function DebugPage() {
  const [refreshCounter, setRefreshCounter] = useState(0)
  const [supabaseData, setSupabaseData] = useState<any>(null)
  const [isSyncing, setIsSyncing] = useState(false)
  const userState = useUserStore()
  
  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient()
      const sessionData = await supabase.auth.getSession()
      const userData = sessionData.data.session ? await supabase.auth.getUser() : null
      
      setSupabaseData({
        session: sessionData.data,
        user: userData?.data
      })
    }
    
    fetchData()
  }, [refreshCounter])
  
  const handleRefresh = () => {
    setRefreshCounter(prev => prev + 1)
    window.location.reload()
  }
  
  const handleSync = async () => {
    setIsSyncing(true)
    try {
      // ОБНОВЛЕНО: Синхронизация теперь происходит автоматически через permissions модуль
      toast({
        title: "Автосинхронизация активна",
        description: "Разрешения синхронизируются автоматически через новую систему permissions",
      })
      setRefreshCounter(prev => prev + 1)
    } catch (error) {
      console.error("Ошибка при синхронизации:", error)
      toast({
        title: "Ошибка",
        description: "Произошла ошибка при синхронизации данных",
        variant: "destructive",
      })
    } finally {
      setIsSyncing(false)
    }
  }
  
  const copyToClipboard = (text: string, name: string) => {
    navigator.clipboard.writeText(text)
      .then(() => {
        toast({
          title: "Скопировано",
          description: `${name} скопирован в буфер обмена`,
        })
      })
      .catch((err) => {
        console.error('Ошибка при копировании:', err)
        toast({
          title: "Ошибка",
          description: "Не удалось скопировать в буфер обмена",
          variant: "destructive",
        })
      })
  }
  
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Отладка</h1>
        <div className="flex space-x-2">
          <Button 
            onClick={handleSync} 
            variant="outline" 
            disabled={isSyncing}
            className="flex items-center gap-1"
          >
            <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? "Синхронизация..." : "Синхронизировать данные"}
          </Button>
          <Button onClick={handleRefresh} className="bg-blue-600 hover:bg-blue-700">
            Перезагрузить страницу
          </Button>
        </div>
      </div>
      
      <div className="space-y-6">
        <Card className="p-6 border border-gray-200 rounded-lg shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Zustand Store</h2>
            <Button 
              variant="outline" 
              size="sm" 
              className="flex items-center gap-1"
              onClick={() => copyToClipboard(JSON.stringify(userState, null, 2), "Zustand Store")}
            >
              <Copy className="h-4 w-4" /> Копировать
            </Button>
          </div>
          <pre className="bg-gray-50 p-4 rounded-md overflow-auto text-xs h-[300px]">
            {JSON.stringify(userState, null, 2)}
          </pre>
        </Card>
        
        <Card className="p-6 border border-gray-200 rounded-lg shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Supabase Data</h2>
            <Button 
              variant="outline" 
              size="sm" 
              className="flex items-center gap-1"
              onClick={() => copyToClipboard(JSON.stringify(supabaseData, null, 2), "Supabase Data")}
            >
              <Copy className="h-4 w-4" /> Копировать
            </Button>
          </div>
          <pre className="bg-gray-50 p-4 rounded-md overflow-auto text-xs h-[300px]">
            {JSON.stringify(supabaseData, null, 2)}
          </pre>
        </Card>
        
        <Card className="p-6 border border-gray-200 rounded-lg shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Environment</h2>
            <Button 
              variant="outline" 
              size="sm" 
              className="flex items-center gap-1"
              onClick={() => copyToClipboard(JSON.stringify({
                userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
                screenSize: typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : 'unknown',
                time: new Date().toISOString(),
                timeLocale: new Date().toLocaleString(),
              }, null, 2), "Environment")}
            >
              <Copy className="h-4 w-4" /> Копировать
            </Button>
          </div>
          <pre className="bg-gray-50 p-4 rounded-md overflow-auto text-xs h-[150px]">
            {JSON.stringify({
              userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
              screenSize: typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : 'unknown',
              time: new Date().toISOString(),
              timeLocale: new Date().toLocaleString(),
            }, null, 2)}
          </pre>
        </Card>
      </div>
    </div>
  )
} 