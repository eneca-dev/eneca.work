"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"
import { useUserStore } from "@/stores/useUserStore"
import { useRouter } from "next/navigation"
import { usePermissionsHook as usePermissions } from "@/modules/permissions"
import * as Sentry from "@sentry/nextjs"

interface AdminAccessCheckProps {
  children: React.ReactNode
  redirectOnFailure?: boolean
}

export function AdminAccessCheck({ 
  children, 
  redirectOnFailure = false 
}: AdminAccessCheckProps) {
  const [hasAccess, setHasAccess] = useState<boolean | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const isAuthenticated = useUserStore((state) => state.isAuthenticated)
  const { hasPermission, isLoading: permissionsLoading, error: permissionsError } = usePermissions()
  const router = useRouter()

  useEffect(() => {
    const checkAccess = () => {
      try {
        if (permissionsLoading) {
          // Ждем загрузки разрешений
          return
        }
        
        // Если есть ошибка загрузки разрешений - блокируем доступ
        if (permissionsError) {
          console.error('❌ Ошибка загрузки разрешений, блокируем доступ:', permissionsError)
          Sentry.captureException(permissionsError, { tags: { module: 'users', component: 'AdminAccessCheck', action: 'permissions_load', error_type: 'unexpected' } })
          setHasAccess(false)
          if (redirectOnFailure) {
            router.push("/users")
          }
          setIsLoading(false)
          return
        }
        
        // Проверяем разрешение на админ панель
        const canViewAdminPanel = hasPermission('users.admin_panel')
        setHasAccess(canViewAdminPanel)
        
        // Редиректим если нет доступа
        if (!canViewAdminPanel && redirectOnFailure) {
          router.push("/users")
        }
        
        setIsLoading(false)
      } catch (error) {
        console.error("Error checking admin panel access:", error)
        Sentry.captureException(error, { tags: { module: 'users', component: 'AdminAccessCheck', action: 'check_access', error_type: 'unexpected' } })
        setHasAccess(false)
        if (redirectOnFailure) {
          router.push("/users")
        }
        setIsLoading(false)
      }
    }

    // Проверяем доступ при изменении разрешений
    checkAccess()
  }, [isAuthenticated, permissionsLoading, permissionsError, hasPermission, redirectOnFailure, router])

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 flex justify-center items-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
          <span className="ml-3">Проверка доступа...</span>
        </CardContent>
      </Card>
    )
  }

  if (!hasAccess) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Доступ запрещен</AlertTitle>
        <AlertDescription>
          У вас нет разрешения на доступ к панели администратора. Пожалуйста, обратитесь к системному администратору для получения доступа.
        </AlertDescription>
      </Alert>
    )
  }

  return <>{children}</>
} 