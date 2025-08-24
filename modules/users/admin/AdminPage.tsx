"use client"

import { useEffect, useState } from "react"
import AdminPanel from "@/modules/users/admin/AdminPanel"
import { useUserStore } from "@/stores/useUserStore"
import { useRouter } from "next/navigation"
import { usePermissionsHook as usePermissions } from "@/modules/permissions"
import { useAdminPermissions } from "./hooks/useAdminPermissions"
import { Loader2, ShieldX } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default function AdminPage() {
  const [isChecking, setIsChecking] = useState(true)
  const [isAuthorized, setIsAuthorized] = useState(false)
  const { hasPermission, isLoading: permissionsLoading, error: permissionsError } = usePermissions()
  const router = useRouter()

  useEffect(() => {
    if (permissionsLoading) {
      // Ждем загрузки разрешений
      return
    }
    
    // Если есть ошибка загрузки разрешений - блокируем доступ
    if (permissionsError) {
      console.error('❌ Ошибка загрузки разрешений в AdminPage:', permissionsError)
      setIsAuthorized(false)
      setIsChecking(false)
      return
    }
    
    const canViewAdminPanel = hasPermission('users.admin_panel')
    setIsAuthorized(canViewAdminPanel)
    setIsChecking(false)
  }, [permissionsLoading, permissionsError, hasPermission])

  useEffect(() => {
    if (!isChecking && !isAuthorized) {
      router.push("/dashboard")
    }
  }, [isChecking, isAuthorized, router])

  if (isChecking) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center p-8 space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
            <div className="text-center">
              <h3 className="font-semibold text-lg">Проверка разрешений</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Пожалуйста, подождите...
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!isAuthorized) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center p-8 space-y-4">
            <ShieldX className="h-12 w-12 text-red-500" />
            <div className="text-center">
              <h3 className="font-semibold text-lg">Доступ запрещен</h3>
              <p className="text-sm text-muted-foreground mt-1">
                У вас нет прав для доступа к панели администратора
              </p>
            </div>
            <Button 
              variant="outline" 
              onClick={() => router.push("/dashboard")}
              className="mt-4"
            >
              Вернуться к панели управления
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return <AdminPanel />
} 
