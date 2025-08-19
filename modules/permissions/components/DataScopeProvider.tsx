"use client"

import React, { createContext, useContext, useEffect, type ReactNode } from 'react'
import type { DataScope } from '../types'
import { useDataConstraints } from '../hooks/useDataConstraints'
import { useDataScopeStore } from '../store/useDataScopeStore'

interface DataScopeContextValue {
  dataScope: DataScope
  isLoading: boolean
  error: string | null
  refreshData: () => Promise<void>
}

const DataScopeContext = createContext<DataScopeContextValue | null>(null)

interface DataScopeProviderProps {
  /**
   * Дочерние компоненты
   */
  children: ReactNode
  
  /**
   * Автоматически загружать данные при монтировании
   */
  autoLoad?: boolean
  
  /**
   * Показать загрузку во время инициализации
   */
  showInitialLoading?: boolean
}

/**
 * Провайдер контекста для ограничений данных
 */
export function DataScopeProvider({
  children,
  autoLoad = true,
  showInitialLoading = false
}: DataScopeProviderProps) {
  const { dataScope } = useDataConstraints()
  const {
    isLoading,
    error,
    loadAvailableProjects,
    loadAvailableDepartments,
    loadAvailableTeams,
    loadAvailableUsers
  } = useDataScopeStore()

  // Функция для обновления всех данных
  const refreshData = async () => {
    try {
      await Promise.all([
        loadAvailableProjects(),
        loadAvailableDepartments(),
        loadAvailableTeams(),
        loadAvailableUsers()
      ])
    } catch (error) {
      console.error('Ошибка обновления данных:', error)
    }
  }

  // Автоматическая загрузка при монтировании
  useEffect(() => {
    if (autoLoad) {
      refreshData()
    }
  }, [autoLoad])

  const contextValue: DataScopeContextValue = {
    dataScope,
    isLoading,
    error,
    refreshData
  }

  // Показываем загрузку если включена
  if (showInitialLoading && isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-3 text-muted-foreground">Загрузка данных...</span>
      </div>
    )
  }

  return (
    <DataScopeContext.Provider value={contextValue}>
      {children}
    </DataScopeContext.Provider>
  )
}

/**
 * Хук для использования контекста ограничений данных
 */
export function useDataScopeContext(): DataScopeContextValue {
  const context = useContext(DataScopeContext)
  
  if (!context) {
    throw new Error('useDataScopeContext должен использоваться внутри DataScopeProvider')
  }
  
  return context
}

/**
 * HOC для оборачивания компонентов в DataScopeProvider
 */
export function withDataScope<P extends object>(
  Component: React.ComponentType<P>,
  providerProps?: Omit<DataScopeProviderProps, 'children'>
) {
  const WrappedComponent = (props: P) => {
    return (
      <DataScopeProvider {...providerProps}>
        <Component {...props} />
      </DataScopeProvider>
    )
  }
  
  WrappedComponent.displayName = `withDataScope(${Component.displayName || Component.name})`
  
  return WrappedComponent
} 