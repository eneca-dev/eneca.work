import React from 'react'
import { AlertTriangle, RefreshCw, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useUserStore } from '@/stores/useUserStore'
import { useRouter } from 'next/navigation'

interface PermissionsErrorBoundaryProps {
  error: string
  onRetry?: () => void
  showLogout?: boolean
}

/**
 * Компонент для отображения ошибок загрузки разрешений
 * Показывает понятное сообщение и варианты действий
 */
export function PermissionsErrorBoundary({ 
  error, 
  onRetry, 
  showLogout = true 
}: PermissionsErrorBoundaryProps) {
  const clearUser = useUserStore(state => state.clearUser)
  const router = useRouter()

  const handleLogout = () => {
    console.log('🚪 Выход из системы из-за ошибки разрешений')
    clearUser()
    router.push('/auth/login')
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 p-3 bg-red-100 rounded-full w-fit">
            <AlertTriangle className="h-6 w-6 text-red-600" />
          </div>
          <CardTitle className="text-red-600">Ошибка доступа</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Проблема с правами доступа</AlertTitle>
            <AlertDescription className="mt-2">
              {error}
            </AlertDescription>
          </Alert>

          <div className="text-sm text-muted-foreground">
            <p>Возможные причины:</p>
            <ul className="list-disc list-inside mt-1 space-y-1">
              <li>У вашего пользователя не назначена роль</li>
              <li>Роль содержит некорректные данные</li>
              <li>Проблема с подключением к серверу</li>
            </ul>
          </div>

          <div className="flex flex-col space-y-2">
            {onRetry && (
              <Button 
                onClick={onRetry}
                variant="default"
                className="w-full"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Попробовать снова
              </Button>
            )}
            
            {showLogout && (
              <Button 
                onClick={handleLogout}
                variant="outline"
                className="w-full"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Войти заново
              </Button>
            )}
          </div>

          <div className="text-xs text-muted-foreground text-center">
            Если проблема повторяется, обратитесь к администратору системы
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
