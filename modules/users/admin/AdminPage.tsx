"use client"

import { useEffect } from "react"
import AdminPanel from "@/modules/users/admin/AdminPanel"
import { useRouter } from "next/navigation"
import { usePermissionsHook as usePermissions } from "@/modules/permissions"
import { Loader2, ShieldX } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import * as Sentry from "@sentry/nextjs"

export default function AdminPage() {
  const { hasPermission, isLoading: permissionsLoading, error: permissionsError } = usePermissions()
  const router = useRouter()

  // Derived state — no effect chain needed
  const isChecking = permissionsLoading
  const isAuthorized = !permissionsLoading && !permissionsError && hasPermission('users.admin_panel')

  // Log permission errors to Sentry
  useEffect(() => {
    if (permissionsError) {
      Sentry.captureException(permissionsError, { tags: { module: 'users', component: 'AdminPage', action: 'permissions_load', error_type: 'unexpected' } })
    }
  }, [permissionsError])

  // Redirect if not authorized
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
