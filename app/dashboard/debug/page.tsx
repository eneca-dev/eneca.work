"use client"

import { useState, useEffect } from "react"
import { useUserStore } from "@/stores/useUserStore"
import { usePermissionsStore } from "@/modules/permissions/store/usePermissionsStore"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { createClient } from "@/utils/supabase/client"
import { Copy, RefreshCw } from "lucide-react"
import { toast } from "@/components/ui/use-toast"

export default function DebugPage() {
  const [refreshCounter, setRefreshCounter] = useState(0)
  const [supabaseData, setSupabaseData] = useState<any>(null)
  const [isSyncing, setIsSyncing] = useState(false)
  const userState = useUserStore()
  const permissionsState = usePermissionsStore()
  
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
            <h2 className="text-lg font-semibold">User Store</h2>
            <Button 
              variant="outline" 
              size="sm" 
              className="flex items-center gap-1"
              onClick={() => copyToClipboard(JSON.stringify(userState, null, 2), "User Store")}
            >
              <Copy className="h-4 w-4" /> Копировать
            </Button>
          </div>
          <pre className="bg-gray-50 p-4 rounded-md overflow-auto text-xs h-[200px]">
            {JSON.stringify(userState, null, 2)}
          </pre>
        </Card>

        <Card className="p-6 border border-gray-200 rounded-lg shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Permissions Store</h2>
            <Button 
              variant="outline" 
              size="sm" 
              className="flex items-center gap-1"
              onClick={() => copyToClipboard(JSON.stringify({
                permissions: permissionsState.permissions,
                isLoading: permissionsState.isLoading,
                error: permissionsState.error,
                lastUpdated: permissionsState.lastUpdated
              }, null, 2), "Permissions Store")}
            >
              <Copy className="h-4 w-4" /> Копировать
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <h3 className="font-medium mb-2">Permissions ({permissionsState.permissions.length})</h3>
              <div className="bg-gray-50 p-3 rounded max-h-[150px] overflow-auto">
                {permissionsState.permissions.length > 0 ? (
                  permissionsState.permissions.map((perm, i) => (
                    <div key={i} className="text-xs text-gray-600">{perm}</div>
                  ))
                ) : (
                  <div className="text-xs text-gray-400">Нет разрешений</div>
                )}
              </div>
            </div>
            {/* Roles view удален в упрощенной версии */}
            <div>
              <h3 className="font-medium mb-2">Status</h3>
              <div className="bg-gray-50 p-3 rounded space-y-1">
                <div className="text-xs">
                  Loading: <span className={permissionsState.isLoading ? "text-yellow-600" : "text-green-600"}>
                    {permissionsState.isLoading ? "Yes" : "No"}
                  </span>
                </div>
                <div className="text-xs">
                  Error: <span className={permissionsState.error ? "text-red-600" : "text-green-600"}>
                    {permissionsState.error || "None"}
                  </span>
                </div>
                {/* User ID удален из permissions store */}
                <div className="text-xs">
                  Updated: <span className="text-gray-600">
                    {permissionsState.lastUpdated?.toLocaleTimeString() || "Never"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Data Scope Store блок удален в упрощенной версии */}
        
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