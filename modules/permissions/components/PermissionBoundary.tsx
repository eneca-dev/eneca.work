"use client"

import type React from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { usePermissions } from '../hooks/usePermissions'

interface PermissionBoundaryProps {
  /**
   * Защищаемый контент
   */
  children: React.ReactNode
  
  /**
   * Компонент загрузки (по умолчанию - скелетоны)
   */
  loading?: React.ReactNode
  
  /**
   * Компонент ошибки
   */
  error?: React.ReactNode
  
  /**
   * Отключить автоматические скелетоны
   */
  disableSkeletons?: boolean
}

/**
 * Компонент-обертка с неблокирующей загрузкой разрешений
 */
export function PermissionBoundary({
  children,
  loading,
  error,
  disableSkeletons = false
}: PermissionBoundaryProps) {
  const { isLoading, error: permissionsError } = usePermissions()
  
  // Показываем ошибку если есть
  if (permissionsError) {
    if (error) {
      return <>{error}</>
    }
    
    return (
      <div className="p-4 border border-red-200 rounded-lg bg-red-50">
        <h3 className="text-red-800 font-medium">Ошибка загрузки разрешений</h3>
        <p className="text-red-600 text-sm mt-1">{permissionsError}</p>
      </div>
    )
  }
  
  // Показываем загрузку
  if (isLoading) {
    if (loading) {
      return <>{loading}</>
    }
    
    if (disableSkeletons) {
      return (
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <span className="ml-3 text-muted-foreground">Загрузка разрешений...</span>
        </div>
      )
    }
    
    // Автоматические скелетоны
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-full" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
        <Skeleton className="h-32 w-full" />
        <div className="flex space-x-2">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-20" />
        </div>
      </div>
    )
  }
  
  // Показываем контент
  return <>{children}</>
}

/**
 * Компонент для блокирующей загрузки (как было раньше)
 */
interface BlockingPermissionBoundaryProps {
  children: React.ReactNode
  loading?: React.ReactNode
}

export function BlockingPermissionBoundary({
  children,
  loading
}: BlockingPermissionBoundaryProps) {
  const { isLoading, error } = usePermissions()
  
  if (isLoading) {
    if (loading) {
      return <>{loading}</>
    }
    
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Загрузка прав доступа...</p>
        </div>
      </div>
    )
  }
  
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Ошибка загрузки разрешений
          </h2>
          <p className="text-gray-600 dark:text-gray-400">{error}</p>
        </div>
      </div>
    )
  }
  
  return <>{children}</>
} 