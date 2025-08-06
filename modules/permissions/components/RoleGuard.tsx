"use client"

import type React from "react"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { useUserStore } from "@/stores/useUserStore"

interface RoleGuardProps {
  /**
   * Разрешенные роли
   */
  allowedRoles: string[]
  
  /**
   * Куда перенаправить при отсутствии доступа
   */
  redirectTo?: string
  
  /**
   * Что показать при отсутствии доступа (если не используется редирект)
   */
  fallback?: React.ReactNode
  
  /**
   * Защищаемый контент
   */
  children: React.ReactNode
  
  /**
   * Показать fallback вместо редиректа
   */
  showFallback?: boolean
}

/**
 * Компонент для защиты на уровне ролей
 */
export function RoleGuard({
  allowedRoles,
  redirectTo = "/dashboard",
  fallback = <div>Доступ запрещен</div>,
  children,
  showFallback = false
}: RoleGuardProps) {
  const router = useRouter()
  const userProfile = useUserStore(state => state.profile)
  const isAuthenticated = useUserStore(state => state.isAuthenticated)
  
  // Получаем роль пользователя из профиля
  const userRole = userProfile?.roleId
  
  useEffect(() => {
    if (isAuthenticated && userRole && !showFallback) {
      // Проверяем есть ли роль в списке разрешенных
      const hasAccess = allowedRoles.includes(userRole)
      
      if (!hasAccess && redirectTo) {
        router.push(redirectTo)
      }
    }
  }, [userRole, allowedRoles, redirectTo, router, isAuthenticated, showFallback])
  
  // Если пользователь не аутентифицирован, не показываем контент
  if (!isAuthenticated) {
    return showFallback ? <>{fallback}</> : null
  }
  
  // Если роль не определена, не показываем контент
  if (!userRole) {
    return showFallback ? <>{fallback}</> : null
  }
  
  // Проверяем доступ
  const hasAccess = allowedRoles.includes(userRole)
  
  if (!hasAccess) {
    return showFallback ? <>{fallback}</> : null
  }
  
  return <>{children}</>
}

/**
 * Компонент для защиты только для администраторов
 */
interface AdminOnlyProps {
  fallback?: React.ReactNode
  redirectTo?: string
  children: React.ReactNode
}

export function AdminOnly({
  fallback = <div>Требуются права администратора</div>,
  redirectTo,
  children
}: AdminOnlyProps) {
  return (
    <RoleGuard
      allowedRoles={['admin']}
      fallback={fallback}
      redirectTo={redirectTo}
      showFallback={!redirectTo}
    >
      {children}
    </RoleGuard>
  )
}

/**
 * Компонент для защиты для руководителей
 */
interface ManagerOnlyProps {
  fallback?: React.ReactNode
  redirectTo?: string
  children: React.ReactNode
}

export function ManagerOnly({
  fallback = <div>Требуются права руководителя</div>,
  redirectTo,
  children
}: ManagerOnlyProps) {
  return (
    <RoleGuard
      allowedRoles={['admin', 'department_head', 'project_manager', 'team_lead']}
      fallback={fallback}
      redirectTo={redirectTo}
      showFallback={!redirectTo}
    >
      {children}
    </RoleGuard>
  )
} 