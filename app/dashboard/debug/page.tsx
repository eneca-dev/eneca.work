"use client"

import { useState, useEffect, useRef } from "react"
import { useUserStore } from "@/stores/useUserStore"
import { usePermissionsStore } from "@/modules/permissions/store/usePermissionsStore"
// Убираем старую отладочную панель ролей/разрешений
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { createClient } from "@/utils/supabase/client"
import { Copy, RefreshCw } from "lucide-react"
import { toast } from "@/components/ui/use-toast"
import { useUserPermissionsSync } from "@/modules/permissions"
import { Input } from "@/components/ui/input"

export default function DebugPage() {
  const [refreshCounter, setRefreshCounter] = useState(0)
  const [supabaseData, setSupabaseData] = useState<any>(null)
  const [isSyncing, setIsSyncing] = useState(false)
  const [rpcPermissions, setRpcPermissions] = useState<string[] | null>(null)
  const [livePermissions, setLivePermissions] = useState<string[] | null>(null)
  const [localCaches, setLocalCaches] = useState<{ user?: any; permissions?: any }>({})
  const userState = useUserStore()
  const permissionsState = usePermissionsStore()
  const { reloadPermissions } = useUserPermissionsSync()
  
  // Chat debug state
  const [conversationId, setConversationId] = useState<string>("")
  const [chatEvents, setChatEvents] = useState<any[]>([])
  const [stepIndex, setStepIndex] = useState<number>(0)
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null)
  
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
  
  // Chat: subscribe to conversation messages via Supabase Realtime
  const subscribeToConversation = async (convId: string) => {
    if (!convId) return
    const supabase = createClient()
    if (channelRef.current) {
      try { channelRef.current.unsubscribe() } catch {}
      channelRef.current = null
    }
    const channel = supabase
      .channel(`realtime:chat_messages:${convId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `conversation_id=eq.${convId}` }, (payload) => {
        setChatEvents(prev => [payload.new, ...prev].slice(0, 200))
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_messages', filter: `conversation_id=eq.${convId}` }, (payload) => {
        setChatEvents(prev => [payload.new, ...prev].slice(0, 200))
      })
      .subscribe((status) => {
        console.log('📡 CHAT Realtime статус подписки:', status)
      })
    channelRef.current = channel
    toast({ title: 'Подписка активна', description: `conversation_id=${convId}` })
  }
  
  const unsubscribeConversation = () => {
    if (channelRef.current) {
      try { channelRef.current.unsubscribe() } catch {}
      channelRef.current = null
      toast({ title: 'Подписка остановлена' })
    }
  }
  
  // Chat: create test conversation for current user
  const handleCreateConversation = async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      toast({ title: 'Не авторизован', description: 'Войдите в систему', variant: 'destructive' })
      return
    }
    const { data, error } = await supabase
      .from('chat_conversations')
      .insert({ user_id: user.id, status: 'active' })
      .select('id')
      .single()
    if (error) {
      console.error('Create conversation error', error)
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' })
      return
    }
    setConversationId(data.id)
    setChatEvents([])
    setStepIndex(0)
    await subscribeToConversation(data.id)
  }
  
  // Chat: insert test user message
  const handleInsertUserMessage = async () => {
    if (!conversationId) return
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await supabase
      .from('chat_messages')
      .insert({
        conversation_id: conversationId,
        user_id: user.id,
        role: 'user',
        kind: 'message',
        content: `Тестовое пользовательское сообщение ${new Date().toLocaleTimeString()}`,
        is_final: false,
      })
    if (error) {
      console.error('Insert user message error', error)
      toast({ title: 'Ошибка вставки', description: error.message, variant: 'destructive' })
    } else {
      toast({ title: 'Вставлено', description: 'User message' })
    }
  }
  
  // Chat: insert test thinking step
  const handleInsertThinking = async () => {
    if (!conversationId) return
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const next = stepIndex + 1
    const { error } = await supabase
      .from('chat_messages')
      .insert({
        conversation_id: conversationId,
        user_id: user.id,
        role: 'assistant',
        kind: 'thinking',
        content: `Шаг мышления #${next}`,
        step_index: next,
        is_final: false,
      })
    if (error) {
      console.error('Insert thinking error', error)
      toast({ title: 'Ошибка вставки', description: error.message, variant: 'destructive' })
    } else {
      setStepIndex(next)
      toast({ title: 'Вставлено', description: `Thinking #${next}` })
    }
  }
  
  // Chat: insert test final assistant message
  const handleInsertFinal = async () => {
    if (!conversationId) return
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await supabase
      .from('chat_messages')
      .insert({
        conversation_id: conversationId,
        user_id: user.id,
        role: 'assistant',
        kind: 'message',
        content: `Финальный ответ ассистента ${new Date().toLocaleTimeString()}`,
        is_final: true,
      })
    if (error) {
      console.error('Insert final error', error)
      toast({ title: 'Ошибка вставки', description: error.message, variant: 'destructive' })
    } else {
      toast({ title: 'Вставлено', description: 'Final assistant message' })
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
        
        {/* Chat Realtime Debug */}
        <Card className="p-6 border border-gray-200 rounded-lg shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Chat Realtime Debug</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            <div className="col-span-2 flex items-center gap-2">
              <Input
                placeholder="conversation_id"
                value={conversationId}
                onChange={(e) => setConversationId(e.target.value)}
              />
              <Button variant="outline" onClick={() => subscribeToConversation(conversationId)} disabled={!conversationId}>Подписаться</Button>
              <Button variant="outline" onClick={unsubscribeConversation}>Стоп</Button>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={handleCreateConversation} className="bg-blue-600 hover:bg-blue-700">Новая беседа</Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mb-4">
            <Button variant="secondary" onClick={handleInsertUserMessage} disabled={!conversationId}>Вставить user message</Button>
            <Button variant="secondary" onClick={handleInsertThinking} disabled={!conversationId}>Вставить thinking</Button>
            <Button variant="secondary" onClick={handleInsertFinal} disabled={!conversationId}>Вставить final</Button>
          </div>
          <div className="text-xs">
            <h3 className="font-medium mb-2">Последние события (вверх новые)</h3>
            <div className="bg-gray-50 p-3 rounded max-h-[280px] overflow-auto">
              {chatEvents.length === 0 ? (
                <div className="text-gray-400">Нет событий</div>
              ) : (
                chatEvents.map((ev, idx) => (
                  <div key={idx} className="mb-2 font-mono">
                    {JSON.stringify(ev)}
                  </div>
                ))
              )}
            </div>
          </div>
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