"use client"

import type React from "react"
import { usePermissions } from '../hooks/usePermissions'

interface PermissionGuardProps {
  /**
   * Требуемое разрешение для отображения контента
   */
  permission: string
  
  /**
   * Альтернативные разрешения (если есть любое из них - доступ разрешен)
   */
  alternativePermissions?: string[]
  
  /**
   * Что показать при отсутствии разрешения
   */
  fallback?: React.ReactNode
  
  /**
   * Защищаемый контент
   */
  children: React.ReactNode
  
  /**
   * Инвертировать логику (показать только если НЕТ разрешения)
   */
  inverse?: boolean
}

/**
 * Компонент для условного рендера на основе разрешений
 */
export function PermissionGuard({
  permission,
  alternativePermissions = [],
  fallback = null,
  children,
  inverse = false
}: PermissionGuardProps) {
  const { hasPermission, hasAnyPermission, permissions } = usePermissions()
  
  // Проверяем основное разрешение
  let hasAccess = hasPermission(permission)
  
  // Проверяем альтернативные разрешения
  if (!hasAccess && alternativePermissions.length > 0) {
    hasAccess = hasAnyPermission(alternativePermissions)
  }
  
  // Инвертируем логику если нужно
  if (inverse) {
    hasAccess = !hasAccess
  }
  
  // Возвращаем контент или fallback
  return hasAccess ? <>{children}</> : <>{fallback}</>
}

/**
 * Компонент для проверки нескольких разрешений (И)
 */
interface RequireAllPermissionsProps {
  permissions: string[]
  fallback?: React.ReactNode
  children: React.ReactNode
}

export function RequireAllPermissions({
  permissions,
  fallback = null,
  children
}: RequireAllPermissionsProps) {
  const { hasAllPermissions } = usePermissions()
  
  const hasAccess = hasAllPermissions(permissions)
  
  return hasAccess ? <>{children}</> : <>{fallback}</>
}

/**
 * Компонент для проверки любого из разрешений (ИЛИ)
 */
interface RequireAnyPermissionProps {
  permissions: string[]
  fallback?: React.ReactNode
  children: React.ReactNode
}

export function RequireAnyPermission({
  permissions,
  fallback = null,
  children
}: RequireAnyPermissionProps) {
  const { hasAnyPermission } = usePermissions()
  
  const hasAccess = hasAnyPermission(permissions)
  
  return hasAccess ? <>{children}</> : <>{fallback}</>
}

/**
 * Компонент для проверки уровня доступа к модулю
 */
interface RequirePermissionLevelProps {
  module: string
  minimumLevel: 'view' | 'edit' | 'admin'
  fallback?: React.ReactNode
  children: React.ReactNode
}

export function RequirePermissionLevel({
  module,
  minimumLevel,
  fallback = null,
  children
}: RequirePermissionLevelProps) {
  const { getPermissionLevel } = usePermissions()
  
  const userLevel = getPermissionLevel(module)
  
  // Определяем иерархию уровней
  const levelHierarchy = ['none', 'view', 'edit', 'admin']
  const userLevelIndex = levelHierarchy.indexOf(userLevel)
  const requiredLevelIndex = levelHierarchy.indexOf(minimumLevel)
  
  const hasAccess = userLevelIndex >= requiredLevelIndex
  
  return hasAccess ? <>{children}</> : <>{fallback}</>
} 