"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/modules/calendar/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/modules/calendar/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { X, Minimize2, Maximize2, Trash2 } from "lucide-react"
import { useUserStore } from "@/stores/useUserStore"
import { createClient } from "@/utils/supabase/client"

interface DebugLog {
  id: string
  timestamp: Date
  type: 'request' | 'response' | 'error' | 'permission_check'
  method: string
  url?: string
  data?: any
  status?: number
  duration?: number
}

interface PermissionCheck {
  id: string
  timestamp: Date
  permission: string
  userId: string | null
  userRole: string | null
  userPermissions: string[]
  hasPermission: boolean
  rawUserData: any
  rawRoleData?: any
  rawPermissionsData?: any
  checkSource: string
}

interface DebugWindowProps {
  isOpen: boolean
  onClose: () => void
}

export function DebugWindow({ isOpen }: DebugWindowProps) {
  const [logs, setLogs] = useState<DebugLog[]>([])
  const [permissionChecks, setPermissionChecks] = useState<PermissionCheck[]>([])
  const [activeTab, setActiveTab] = useState<'logs' | 'permissions'>('logs')
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const logCounterRef = useRef(0)
  const permissionCounterRef = useRef(0)
  const userStore = useUserStore()

  // Функция для добавления лога
  const addLog = (log: Omit<DebugLog, 'id' | 'timestamp'>) => {
    logCounterRef.current += 1
    const newLog: DebugLog = {
      ...log,
      id: `${Date.now()}-${logCounterRef.current}`,
      timestamp: new Date()
    }
    setLogs(prev => [...prev, newLog])
  }

  // Функция для добавления проверки разрешений
  const addPermissionCheck = (check: Omit<PermissionCheck, 'id' | 'timestamp'>) => {
    permissionCounterRef.current += 1
    const newCheck: PermissionCheck = {
      ...check,
      id: `perm-${Date.now()}-${permissionCounterRef.current}`,
      timestamp: new Date()
    }
    setPermissionChecks(prev => [...prev, newCheck])
  }

  // Перехватываем hasPermission в userStore для детального логирования
  useEffect(() => {
    if (!isOpen) return

    const originalHasPermission = userStore.hasPermission
    
    // Создаем обертку для hasPermission
    userStore.hasPermission = (permission: string) => {
      const userState = userStore
      const result = originalHasPermission(permission)
      
      // Логируем полный цикл проверки
      console.log(`🔐 ПРОВЕРКА РАЗРЕШЕНИЯ: ${permission}`)
      console.log('📊 Сырые данные пользователя:', {
        id: userState.id,
        email: userState.email,
        name: userState.name,
        isAuthenticated: userState.isAuthenticated,
        role: userState.role,
        permissions: userState.permissions,
        profile: userState.profile
      })
      console.log(`✅ Результат проверки: ${result ? 'РАЗРЕШЕНО' : 'ЗАПРЕЩЕНО'}`)
      
      // Добавляем в дебаг
      addPermissionCheck({
        permission,
        userId: userState.id,
        userRole: userState.role,
        userPermissions: [...userState.permissions],
        hasPermission: result,
        rawUserData: {
          id: userState.id,
          email: userState.email,
          name: userState.name,
          isAuthenticated: userState.isAuthenticated,
          role: userState.role,
          permissions: [...userState.permissions],
          profile: JSON.parse(JSON.stringify(userState.profile || {}))
        },
        checkSource: 'userStore.hasPermission'
      })
      
      return result
    }

    return () => {
      userStore.hasPermission = originalHasPermission
    }
  }, [isOpen, userStore])

  // Логируем загрузку разрешений из базы данных
  useEffect(() => {
    if (!isOpen) return

    const originalLoadUserPermissions = userStore.loadUserPermissions
    
    userStore.loadUserPermissions = async (userId: string) => {
      console.log(`🔄 ЗАГРУЗКА РАЗРЕШЕНИЙ ИЗ БД для пользователя: ${userId}`)
      
      try {
        const supabase = createClient()
        const currentUserState = userStore
        
        console.log('📊 Текущее состояние пользователя:', {
          id: currentUserState.id,
          profile: currentUserState.profile
        })
        
        // Проверяем, есть ли roleId в профиле
        if (currentUserState.profile?.roleId) {
          console.log(`🎯 ИСПОЛЬЗУЕМ ROLE_ID ИЗ ПРОФИЛЯ: ${currentUserState.profile.roleId}`)
          
          // Шаг 1: Получаем роль напрямую по roleId
          const { data: roleData, error: roleError } = await supabase
            .from("roles")
            .select("name, description")
            .eq("id", currentUserState.profile.roleId)
            .single();
          
          console.log('📊 Сырые данные roles (из профиля):', { roleData, roleError })
          
          if (roleError) {
            console.log('❌ Ошибка при получении роли из профиля')
            addPermissionCheck({
              permission: 'LOAD_PERMISSIONS_PROFILE_ROLE',
              userId,
              userRole: null,
              userPermissions: [],
              hasPermission: false,
              rawUserData: { profileRoleId: currentUserState.profile.roleId },
              rawRoleData: { error: roleError },
              checkSource: 'loadUserPermissions - profile roleId -> roles'
            })
            return originalLoadUserPermissions(userId)
          }
          
          // Шаг 2: Получаем разрешения для роли
          const { data: rolePermissions, error: permissionsError } = await supabase
            .from("role_permissions")
            .select("permission_id")
            .eq("role_id", currentUserState.profile.roleId);
          
          console.log('📊 Сырые данные role_permissions (из профиля):', { rolePermissions, permissionsError })
          
          if (permissionsError || !rolePermissions || rolePermissions.length === 0) {
            console.log('❌ Разрешения не найдены для роли из профиля')
            addPermissionCheck({
              permission: 'LOAD_PERMISSIONS_PROFILE_ROLE',
              userId,
              userRole: roleData.name,
              userPermissions: [],
              hasPermission: false,
              rawUserData: { profileRoleId: currentUserState.profile.roleId },
              rawRoleData: { roleData },
              rawPermissionsData: { error: permissionsError, data: rolePermissions },
              checkSource: 'loadUserPermissions - profile roleId -> role_permissions'
            })
            return originalLoadUserPermissions(userId)
          }
          
          // Шаг 3: Получаем имена разрешений
          const permissionIds = rolePermissions.map((p: { permission_id: string }) => p.permission_id)
          console.log(`📡 Запрос permissions для IDs из профиля: ${permissionIds.join(', ')}`)
          
          const { data: permissions, error: permNameError } = await supabase
            .from("permissions")
            .select("name")
            .in("id", permissionIds);
          
          console.log('📊 Сырые данные permissions (из профиля):', { permissions, permNameError })
          
          const permissionNames = permissions ? permissions.map((p: { name: string }) => p.name) : []
          
          console.log(`✅ ИТОГОВЫЕ РАЗРЕШЕНИЯ ИЗ ПРОФИЛЯ: ${permissionNames.join(', ')}`)
          
          // Логируем успешный результат
          addPermissionCheck({
            permission: 'LOAD_PERMISSIONS_PROFILE_SUCCESS',
            userId,
            userRole: roleData.name,
            userPermissions: [...permissionNames],
            hasPermission: true,
            rawUserData: { profileRoleId: currentUserState.profile.roleId },
            rawRoleData: { roleData },
            rawPermissionsData: { rolePermissions, permissions },
            checkSource: 'loadUserPermissions - profile roleId complete'
          })
          
        } else {
          console.log('🔄 PROFILE.ROLE_ID ОТСУТСТВУЕТ, ИСПОЛЬЗУЕМ USER_ROLES')
          
          // Старая логика через user_roles
          console.log('📡 Шаг 1: Запрос user_roles')
          const { data: userRoles, error: userRolesError } = await supabase
            .from("user_roles")
            .select("role_id")
            .eq("user_id", userId);
          
          console.log('📊 Сырые данные user_roles:', { userRoles, userRolesError })
          
          if (userRolesError || !userRoles || userRoles.length === 0) {
            console.log('❌ Роли не найдены в user_roles')
            addPermissionCheck({
              permission: 'LOAD_PERMISSIONS_USER_ROLES',
              userId,
              userRole: null,
              userPermissions: [],
              hasPermission: false,
              rawUserData: { error: userRolesError, data: userRoles },
              checkSource: 'loadUserPermissions - user_roles fallback'
            })
            return originalLoadUserPermissions(userId)
          }
          
          const roleId = userRoles[0].role_id
          console.log(`📡 Найден roleId в user_roles: ${roleId}`)
          
          // Остальная логика такая же...
          addPermissionCheck({
            permission: 'LOAD_PERMISSIONS_USER_ROLES_SUCCESS',
            userId,
            userRole: 'processing...',
            userPermissions: [],
            hasPermission: true,
            rawUserData: { userRoles },
            checkSource: 'loadUserPermissions - user_roles fallback found roleId'
          })
        }
        
        // Вызываем оригинальный метод для обновления состояния
        return originalLoadUserPermissions(userId)
        
      } catch (error) {
        console.error('💥 КРИТИЧЕСКАЯ ОШИБКА при загрузке разрешений:', error)
        addPermissionCheck({
          permission: 'LOAD_PERMISSIONS_ERROR',
          userId,
          userRole: null,
          userPermissions: [],
          hasPermission: false,
          rawUserData: { error: String(error) },
          checkSource: 'loadUserPermissions - exception'
        })
      }
    }

    return () => {
      userStore.loadUserPermissions = originalLoadUserPermissions
    }
  }, [isOpen, userStore])

  // Перехват console.log для отслеживания дополнительной информации
  useEffect(() => {
    if (!isOpen) return

    const originalConsoleLog = console.log
    
    console.log = (...args) => {
      // Проверяем, есть ли в логах информация о календарных событиях или разрешениях
      const message = args.join(' ')
      if (message.includes('События в календарной сетке') || 
          message.includes('Фильтрация событий') || 
          message.includes('После фильтрации') ||
          message.includes('Загружено событий') ||
          message.includes('Загружаем события для пользователя') ||
          message.includes('🔴 День') ||
          message.includes('📅 День') ||
          message.includes('ПРОВЕРКА РАЗРЕШЕНИЯ') ||
          message.includes('ЗАГРУЗКА РАЗРЕШЕНИЙ') ||
          message.includes('Проверяем права на')) {
        
        addLog({
          type: 'request',
          method: 'LOG',
          url: 'Console Debug',
          data: args
        })
      }
      
      return originalConsoleLog(...args)
    }

    return () => {
      console.log = originalConsoleLog
    }
  }, [isOpen])

  // Перехват fetch запросов для отслеживания API вызовов
  useEffect(() => {
    if (!isOpen) return

    const originalFetch = window.fetch
    
    window.fetch = async (...args) => {
      const [url, options] = args
      const startTime = Date.now()
      const urlString = url instanceof Request ? url.url : url.toString()
      
      // Фильтруем только запросы, связанные с календарем и разрешениями
      const isCalendarRelated = urlString.includes('calendar_events') || 
                               urlString.includes('work_schedules') ||
                               urlString.includes('users') ||
                               urlString.includes('user_roles') ||
                               urlString.includes('roles') ||
                               urlString.includes('permissions') ||
                               urlString.includes('role_permissions') ||
                               urlString.includes('supabase')
      
      if (!isCalendarRelated) {
        return originalFetch(...args)
      }
      
      // Логируем запрос
      addLog({
        type: 'request',
        method: options?.method || 'GET',
        url: urlString,
        data: options?.body ? (() => {
          try {
            return JSON.parse(options.body as string)
          } catch {
            return options.body
          }
        })() : undefined
      })

      try {
        const response = await originalFetch(...args)
        const endTime = Date.now()
        const duration = endTime - startTime

        // Клонируем ответ для чтения
        const responseClone = response.clone()
        let responseData
        try {
          responseData = await responseClone.json()
        } catch {
          responseData = await responseClone.text()
        }

        // Логируем ответ
        addLog({
          type: 'response',
          method: options?.method || 'GET',
          url: urlString,
          data: responseData,
          status: response.status,
          duration
        })

        return response
      } catch (error) {
        const endTime = Date.now()
        const duration = endTime - startTime

        // Логируем ошибку
        addLog({
          type: 'error',
          method: options?.method || 'GET',
          url: urlString,
          data: error,
          duration
        })

        throw error
      }
    }

    return () => {
      window.fetch = originalFetch
    }
  }, [isOpen])

  // Автоскролл к последнему логу
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight
    }
  }, [logs, permissionChecks])

  const clearLogs = () => {
    setLogs([])
  }

  const clearPermissionChecks = () => {
    setPermissionChecks([])
  }

  const getLogColor = (type: DebugLog['type']) => {
    switch (type) {
      case 'request':
        return 'bg-blue-100 text-blue-800'
      case 'response':
        return 'bg-green-100 text-green-800'
      case 'error':
        return 'bg-red-100 text-red-800'
      case 'permission_check':
        return 'bg-purple-100 text-purple-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getPermissionColor = (hasPermission: boolean) => {
    return hasPermission ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('ru-RU', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
      fractionalSecondDigits: 3
    })
  }

  if (!isOpen) return null

  return (
    <div className="w-full">
      {/* Переключатель табов */}
      <div className="flex items-center gap-4 mb-4">
        <Button
          variant={activeTab === 'logs' ? 'default' : 'outline'}
          onClick={() => setActiveTab('logs')}
          className="h-8"
        >
          API Логи ({logs.length})
        </Button>
        <Button
          variant={activeTab === 'permissions' ? 'default' : 'outline'}
          onClick={() => setActiveTab('permissions')}
          className="h-8"
        >
          Проверки разрешений ({permissionChecks.length})
        </Button>
      </div>

      {/* Заголовок и кнопки */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">
            {activeTab === 'logs' ? `API Логи (${logs.length})` : `Проверки разрешений (${permissionChecks.length})`}
          </span>
          <Badge variant="outline" className="text-xs">
            Обновляется в реальном времени
          </Badge>
          {activeTab === 'permissions' && permissionChecks.length > 100 && (
            <Badge variant="destructive" className="text-xs">
              ⚠️ Много проверок! Возможно есть проблема с производительностью
            </Badge>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={activeTab === 'logs' ? clearLogs : clearPermissionChecks}
          className="h-8"
        >
          <Trash2 className="h-4 w-4 mr-1" />
          Очистить
        </Button>
      </div>

      <ScrollArea className="h-96 w-full border rounded-md p-4" ref={scrollAreaRef}>
        {activeTab === 'logs' ? (
          // API Логи
          logs.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              <p>API логи пока пустые</p>
              <p className="text-sm">Взаимодействуйте с календарем для появления логов</p>
            </div>
          ) : (
            <div className="space-y-2">
              {logs.map((log) => (
                <div key={log.id} className="border rounded-lg p-3 bg-white">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge className={getLogColor(log.type)}>
                        {log.type.toUpperCase()}
                      </Badge>
                      <span className="font-mono text-sm font-medium">
                        {log.method}
                      </span>
                      {log.status && (
                        <Badge variant={log.status >= 400 ? 'destructive' : 'secondary'}>
                          {log.status}
                        </Badge>
                      )}
                      {log.duration && (
                        <span className="text-xs text-gray-500">
                          {log.duration}ms
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-500 font-mono">
                      {formatTime(log.timestamp)}
                    </span>
                  </div>
                  
                  {log.url && (
                    <div className="mb-2">
                      <span className="text-xs font-medium text-gray-600">URL:</span>
                      <div className="font-mono text-xs bg-gray-50 p-1 rounded break-all">
                        {log.url}
                      </div>
                    </div>
                  )}
                  
                  {log.data && (
                    <div>
                      <span className="text-xs font-medium text-gray-600">Данные:</span>
                      <pre className="text-xs bg-gray-50 p-2 rounded overflow-auto max-h-32">
                        {typeof log.data === 'string' 
                          ? log.data 
                          : JSON.stringify(log.data, null, 2)
                        }
                      </pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        ) : (
          // Проверки разрешений
          permissionChecks.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              <p>Проверки разрешений пока не выполнялись</p>
              <p className="text-sm">Попробуйте создать событие или выполнить действие, требующее разрешения</p>
            </div>
          ) : (
            <div className="space-y-3">
              {permissionChecks.length > 50 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-3">
                  <div className="flex items-start gap-2">
                    <span className="text-yellow-600 font-bold">⚠️</span>
                    <div className="text-sm">
                      <p className="font-medium text-yellow-800 mb-1">
                        Обнаружено {permissionChecks.length} проверок разрешений
                      </p>
                      <p className="text-yellow-700 mb-2">
                        Большое количество проверок может указывать на проблему производительности.
                        Компоненты выполняют проверки hasPermission() при каждом рендере вместо использования useMemo().
                      </p>
                      <p className="text-yellow-700 text-xs">
                        💡 Решение: Используйте userStore.permissions.includes() вместо hasPermission(), 
                        или оберните hasPermission() в useMemo() с зависимостями [userStore.id, userStore.role, userStore.permissions]
                      </p>
                    </div>
                  </div>
                </div>
              )}
              {permissionChecks.map((check) => (
                <div key={check.id} className="border rounded-lg p-4 bg-white">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Badge className={getPermissionColor(check.hasPermission)}>
                        {check.hasPermission ? '✅ РАЗРЕШЕНО' : '❌ ЗАПРЕЩЕНО'}
                      </Badge>
                      <span className="font-mono text-sm font-medium">
                        {check.permission}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500 font-mono">
                      {formatTime(check.timestamp)}
                    </span>
                  </div>
                  
                  <div className="mb-2">
                    <span className="text-xs font-medium text-gray-600">Источник проверки:</span>
                    <div className="text-xs bg-blue-50 p-1 rounded">
                      {check.checkSource}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-3">
                    <div>
                      <span className="text-xs font-medium text-gray-600">Пользователь:</span>
                      <pre className="text-xs bg-gray-50 p-2 rounded overflow-auto max-h-24">
                        ID: {check.userId || 'не аутентифицирован'}
                        Роль: {check.userRole || 'нет роли'}
                        Разрешения: [{check.userPermissions.join(', ')}]
                      </pre>
                    </div>
                    
                    <div>
                      <span className="text-xs font-medium text-gray-600">Сырые данные пользователя:</span>
                      <pre className="text-xs bg-gray-50 p-2 rounded overflow-auto max-h-32">
                        {JSON.stringify(check.rawUserData, null, 2)}
                      </pre>
                    </div>
                    
                    {check.rawRoleData && (
                      <div>
                        <span className="text-xs font-medium text-gray-600">Сырые данные роли:</span>
                        <pre className="text-xs bg-yellow-50 p-2 rounded overflow-auto max-h-24">
                          {JSON.stringify(check.rawRoleData, null, 2)}
                        </pre>
                      </div>
                    )}
                    
                    {check.rawPermissionsData && (
                      <div>
                        <span className="text-xs font-medium text-gray-600">Сырые данные разрешений:</span>
                        <pre className="text-xs bg-green-50 p-2 rounded overflow-auto max-h-24">
                          {JSON.stringify(check.rawPermissionsData, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </ScrollArea>
    </div>
  )
} 