"use client"

import { useState, useEffect } from "react"
import { useUserStore } from "@/stores/useUserStore"
import { usePermissionsStore } from "@/modules/permissions/store/usePermissionsStore"
// Убираем старую отладочную панель ролей/разрешений
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { createClient } from "@/utils/supabase/client"
import { Copy, RefreshCw } from "lucide-react"
import { toast } from "@/components/ui/use-toast"
import { usePermissionsLoader } from "@/modules/permissions/hooks/usePermissionsLoader"

export default function DebugPage() {
  const [refreshCounter, setRefreshCounter] = useState(0)
  const [supabaseData, setSupabaseData] = useState<any>(null)
  const [isSyncing, setIsSyncing] = useState(false)
  const [rpcPermissions, setRpcPermissions] = useState<string[] | null>(null)
  const [livePermissions, setLivePermissions] = useState<string[] | null>(null)
  const [localCaches, setLocalCaches] = useState<{ user?: any; permissions?: any }>({})
  const userState = useUserStore()
  const permissionsState = usePermissionsStore()
  const { reloadPermissions } = usePermissionsLoader()
  
  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient()
      const sessionData = await supabase.auth.getSession()
      const userData = sessionData.data.session ? await supabase.auth.getUser() : null
      
      setSupabaseData({
        session: sessionData.data,
        user: userData?.data
      })

      // Загружаем сравнения RPC и live join (без кэша)
      if (userState.id) {
        const { data: rpc } = await supabase.rpc('get_user_permissions', { p_user_id: userState.id })
        setRpcPermissions(rpc || [])

        // Прямой live-join без MV (диагностика)
        const { data: live } = await supabase
          .from('role_permissions')
          .select('permissions(name), roles(name), user_roles!inner(user_id)')
          .eq('user_roles.user_id', userState.id)
        const liveList = Array.from(new Set((live || []).map((row: any) => row.permissions?.name).filter(Boolean))).sort()
        setLivePermissions(liveList)
      }

      // Локальные кеши из localStorage
      if (typeof window !== 'undefined') {
        try {
          const userStorage = window.localStorage.getItem('user-storage')
          const permStorage = window.localStorage.getItem('permissions-store')
          setLocalCaches({
            user: userStorage ? JSON.parse(userStorage) : undefined,
            permissions: permStorage ? JSON.parse(permStorage) : undefined,
          })
        } catch (_) {
          setLocalCaches({})
        }
      }
    }
    
    fetchData()
  }, [refreshCounter, userState.id])
  
  const handleRefresh = () => {
    setRefreshCounter(prev => prev + 1)
    window.location.reload()
  }
  
  const handleSync = async () => {
    setIsSyncing(true)
    try {
      reloadPermissions()
      toast({ title: "Стор обновлён", description: "Разрешения перезагружены" })
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
  
  // Вычисляем текущую роль из permissions стора (нормализованный приоритет)
  const computeRole = (perms: string[]) => {
    const set = new Set(perms)
    if (set.has('hierarchy.is_admin')) return 'admin'
    if (set.has('hierarchy.is_department_head')) return 'department_head'
    if (set.has('hierarchy.is_team_lead')) return 'team_lead'
    if (set.has('hierarchy.is_user')) return 'user'
    return 'none'
  }
  const currentRole = computeRole(permissionsState.permissions)

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
        {/* Текущая роль и разрешения из permissions store */}
        <Card className="p-6 border border-gray-200 rounded-lg shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Доступ (permissions store)</h2>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex items-center gap-1" onClick={handleSync}>
                <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} /> Обновить стор
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <h3 className="font-medium mb-2">Текущая роль</h3>
              <div className="bg-gray-50 p-3 rounded">
                <span className="text-xs font-mono">{currentRole}</span>
              </div>
            </div>
            <div className="md:col-span-2">
              <h3 className="font-medium mb-2">Permissions ({permissionsState.permissions.length})</h3>
              <div className="bg-gray-50 p-3 rounded max-h-[180px] overflow-auto">
                {permissionsState.permissions.length > 0 ? (
                  permissionsState.permissions.map((perm, i) => (
                    <div key={i} className="text-xs text-gray-600 font-mono">{perm}</div>
                  ))
                ) : (
                  <div className="text-xs text-gray-400">Нет разрешений</div>
                )}
              </div>
            </div>
          </div>
        </Card>

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

        {/* Comparisons */}
        <Card className="p-6 border border-gray-200 rounded-lg shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Permissions comparisons</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <h3 className="font-medium mb-2">get_user_permissions (rpc)</h3>
              <pre className="bg-gray-50 p-3 rounded max-h-[180px] overflow-auto">{JSON.stringify(rpcPermissions, null, 2)}</pre>
            </div>
            <div>
              <h3 className="font-medium mb-2">live join (no cache)</h3>
              <pre className="bg-gray-50 p-3 rounded max-h-[180px] overflow-auto">{JSON.stringify(livePermissions, null, 2)}</pre>
            </div>
          </div>
        </Card>

        {/* Local caches */}
        <Card className="p-6 border border-gray-200 rounded-lg shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Local caches (localStorage)</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <h3 className="font-medium mb-2">permissions-store</h3>
              <pre className="bg-gray-50 p-3 rounded max-h-[180px] overflow-auto">{JSON.stringify(localCaches.permissions, null, 2)}</pre>
            </div>
            <div>
              <h3 className="font-medium mb-2">user-storage</h3>
              <pre className="bg-gray-50 p-3 rounded max-h-[180px] overflow-auto">{JSON.stringify(localCaches.user, null, 2)}</pre>
            </div>
          </div>
        </Card>

        {/* Старые окна дебага ролей/разрешений удалены */}

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