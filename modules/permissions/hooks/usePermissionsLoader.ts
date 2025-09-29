import { useEffect, useRef, useCallback } from 'react'
import * as Sentry from "@sentry/nextjs"
import { useUserStore } from '@/stores/useUserStore'
import { usePermissionsStore } from '../store/usePermissionsStore'
import { getUserPermissions } from '../supabase/supabasePermissions'

// Глобальные маркеры, чтобы избежать повторных загрузок при том же userId в dev (StrictMode/HMR)
let globalLastUserId: string | null = null
let globalLoadInFlight: Promise<void> | null = null

/**
 * Простой и надёжный хук для загрузки разрешений
 * Автоматически загружает разрешения при авторизации
 * Показывает ошибку если разрешений нет
 *
 * Идемпотентность:
 * - Если для того же userId загрузка уже выполнялась или идёт — повторная не запускается
 * - reloadPermissions выполняет принудительную перезагрузку, обходя глобальные стражи
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
  const forceNextRef = useRef(false)

  // Функция загрузки разрешений (с поддержкой принудительной перезагрузки)
  const loadPermissions = useCallback(async (userIdToLoad: string) => {
    const isForce = forceNextRef.current === true

    // Защита от дублирования запросов на уровне инстанса хука
    if (loadingRef.current) {
      console.log('🔄 Загрузка разрешений уже в процессе')
      return
    }

    // Глобальная защита от повторной загрузки для того же userId (если не принудительно)
    if (!isForce && globalLoadInFlight && globalLastUserId === userIdToLoad) {
      console.log('⏭️ Пропускаем: глобально уже идёт загрузка для этого пользователя')
      return
    }

    loadingRef.current = true
    setLoading(true)
    clearError()

    try {
      console.log('🚀 Начинаем загрузку разрешений для:', userIdToLoad)
      globalLastUserId = userIdToLoad

      const taskResult = Sentry.startSpan({ name: 'loadUserPermissions' }, async () => {
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

      // Фиксируем глобально «в полёте», чтобы другие экземпляры хука не дублировали
      const taskPromise: Promise<void> = Promise.resolve(taskResult)
      if (!isForce) {
        globalLoadInFlight = taskPromise
      }

      await taskPromise

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Неизвестная ошибка'
      console.error('💥 Критическая ошибка загрузки разрешений:', errorMsg)
      setError(`Критическая ошибка: ${errorMsg}`)
      Sentry.captureException(error)
    } finally {
      setLoading(false)
      loadingRef.current = false
      // Сбрасываем принудительный флаг только после попытки
      forceNextRef.current = false
      // Если это была не принудительная загрузка — очищаем глобальный in-flight по её завершению
      // Очистим глобальный маркер, если отслеживали нефорсированную загрузку
      if (!forceNextRef.current) globalLoadInFlight = null
    }
  }, [setPermissions, setLoading, setError, clearError])

  // Эффект для автоматической загрузки при авторизации
  useEffect(() => {
    // Если пользователь авторизован и есть userId
    if (isAuthenticated && userId) {
      // При смене пользователя перед загрузкой очищаем предыдущие разрешения
      if (lastUserIdRef.current && lastUserIdRef.current !== userId) {
        setPermissions([])
        clearError()
      }
      // Если в сторе уже есть разрешения для этого же userId, избегаем повторной загрузки
      if ((globalLastUserId === userId || permissions.length > 0) && lastUserIdRef.current !== userId) {
        lastUserIdRef.current = userId
        return
      }

      // Проверяем, нужно ли загружать (пользователь сменился в рамках текущего инстанса)
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
      globalLastUserId = null
      setPermissions([])
      clearError()
    }
  }, [isAuthenticated, userId, loadPermissions, setPermissions, clearError, permissions.length])

  // Функция принудительной перезагрузки
  const reloadPermissions = useCallback(() => {
    if (userId) {
      console.log('🔄 Принудительная перезагрузка разрешений')
      // Следующая загрузка будет форсирована (обойдёт глобальные стражи)
      forceNextRef.current = true
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

