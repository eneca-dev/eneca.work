import { useEffect, useRef, useCallback } from 'react'
import * as Sentry from "@sentry/nextjs"
import { useUserStore } from '@/stores/useUserStore'
import { usePermissionsStore } from '../store/usePermissionsStore'
import { getUserPermissions } from '../supabase/supabasePermissions'

/**
 * Простой и надёжный хук для загрузки разрешений
 * Автоматически загружает разрешения при авторизации
 * Показывает ошибку если разрешений нет
 */
export function usePermissionsLoader() {
  const isAuthenticated = useUserStore(state => state.isAuthenticated)
  const userId = useUserStore(state => state.id)
  const { 
    setPermissions, 
    setLoading, 
    setError, 
    clearError,
    permissions,
    isLoading,
    error 
  } = usePermissionsStore()
  
  const loadingRef = useRef(false)
  const lastUserIdRef = useRef<string | null>(null)

  // Функция загрузки разрешений
  const loadPermissions = useCallback(async (userIdToLoad: string) => {
    // Защита от дублирования запросов
    if (loadingRef.current) {
      console.log('🔄 Загрузка разрешений уже в процессе')
      return
    }

    loadingRef.current = true
    setLoading(true)
    clearError()

    try {
      console.log('🚀 Начинаем загрузку разрешений для:', userIdToLoad)
      
      Sentry.startSpan({ name: 'loadUserPermissions' }, async () => {
        const result = await getUserPermissions(userIdToLoad)
        
        if (result.error) {
          console.error('❌ Ошибка загрузки разрешений:', result.error)
          setError(result.error)
          Sentry.captureMessage(`Ошибка загрузки разрешений: ${result.error}`)
          return
        }

        if (!result.permissions || result.permissions.length === 0) {
          const errorMsg = 'У пользователя нет разрешений'
          console.warn('⚠️', errorMsg)
          setError(errorMsg)
          Sentry.captureMessage(errorMsg)
          return
        }

        console.log('✅ Разрешения успешно загружены:', result.permissions.length)
        console.log('👥 Роли пользователя:', result.roles)
        console.log('⭐ Основная роль:', result.primaryRole)
        setPermissions(result.permissions)
      })

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Неизвестная ошибка'
      console.error('💥 Критическая ошибка загрузки разрешений:', errorMsg)
      setError(`Критическая ошибка: ${errorMsg}`)
      Sentry.captureException(error)
    } finally {
      setLoading(false)
      loadingRef.current = false
    }
  }, [setPermissions, setLoading, setError, clearError])

  // Эффект для автоматической загрузки при авторизации
  useEffect(() => {
    // Если пользователь авторизован и есть userId
    if (isAuthenticated && userId) {
      // Проверяем, нужно ли загружать (пользователь сменился)
      if (lastUserIdRef.current !== userId && !loadingRef.current) {
        console.log('👤 Пользователь сменился, загружаем разрешения')
        lastUserIdRef.current = userId
        loadPermissions(userId)
      }
    } 
    // Если пользователь вышел
    else if (!isAuthenticated) {
      console.log('🚪 Пользователь вышел, очищаем разрешения')
      lastUserIdRef.current = null
      setPermissions([])
      clearError()
    }
  }, [isAuthenticated, userId, loadPermissions, setPermissions, clearError])

  // Функция принудительной перезагрузки
  const reloadPermissions = useCallback(() => {
    if (userId) {
      console.log('🔄 Принудительная перезагрузка разрешений')
      loadPermissions(userId)
    }
  }, [userId, loadPermissions])

  return {
    permissions,
    isLoading,
    error,
    reloadPermissions,
    hasPermissions: permissions.length > 0
  }
}
