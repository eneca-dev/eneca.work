import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { RefreshCw, CheckCircle, XCircle, AlertTriangle } from 'lucide-react'
import { usePermissionsStore } from '../store/usePermissionsStore'
import { useUserStore } from '@/stores/useUserStore'
import { useUserPermissionsSync } from '../integration/userStoreSync'

/**
 * Отладочная панель для системы разрешений
 * Показывает текущее состояние и позволяет тестировать
 */
export function PermissionsDebugPanel() {
  const { permissions, isLoading, error, lastUpdated } = usePermissionsStore()
  const { id: userId, profile } = useUserStore()
  const { reloadPermissions, hasPermissions } = useUserPermissionsSync()

  const getStatusIcon = () => {
    if (isLoading) return <RefreshCw className="h-5 w-5 text-blue-500 animate-spin" />
    if (error) return <XCircle className="h-5 w-5 text-red-500" />
    if (hasPermissions) return <CheckCircle className="h-5 w-5 text-green-500" />
    return <AlertTriangle className="h-5 w-5 text-yellow-500" />
  }

  const getStatusText = () => {
    if (isLoading) return 'Загрузка...'
    if (error) return 'Ошибка'
    if (hasPermissions) return 'Загружено'
    return 'Нет данных'
  }

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {getStatusIcon()}
          Система разрешений - {getStatusText()}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <strong>Пользователь:</strong> {userId || 'Не авторизован'}
          </div>
          <div>
            <strong>Роль:</strong> {profile?.roleId || profile?.role_id || 'Не назначена'}
          </div>
          <div>
            <strong>Разрешений:</strong> {permissions.length}
          </div>
          <div>
            <strong>Обновлено:</strong> {lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : 'Никогда'}
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
            <strong>Ошибка:</strong> {error}
          </div>
        )}

        {permissions.length > 0 && (
          <div>
            <strong className="text-sm">Разрешения:</strong>
            <div className="mt-2 max-h-32 overflow-y-auto text-xs bg-gray-50 p-2 rounded">
              {permissions.map((permission, index) => (
                <div key={index} className="py-1 border-b border-gray-200 last:border-b-0">
                  {permission}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <Button
            onClick={reloadPermissions}
            disabled={isLoading || !userId}
            size="sm"
            variant="outline"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Перезагрузить
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
