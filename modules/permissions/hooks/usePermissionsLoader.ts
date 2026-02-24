'use client'

import { useEffect, useRef, useCallback } from 'react'
import * as Sentry from '@sentry/nextjs'
import { useUserStore } from '@/stores/useUserStore'
import { usePermissionsStore } from '../store/usePermissionsStore'
import { getFilterContext } from '../server/get-filter-context'
import type { OrgContext } from '../types'

// Глобальные маркеры, чтобы избежать повторных загрузок при том же userId в dev (StrictMode/HMR)
let globalLastUserId: string | null = null
let globalLoadInFlight: Promise<void> | null = null

/**
 * Unified Permissions Loader
 *
 * Загружает permissions, filterScope и orgContext одним запросом через getFilterContext.
 * Автоматически загружает при авторизации и очищает при выходе.
 *
 * Оптимизации:
 * - Если permissions уже закешированы (persist в localStorage) для того же userId,
 *   загрузка идёт в фоне (не блокирует UI). Пользователь видит дашборд сразу.
 * - Идемпотентность: если для того же userId загрузка уже выполнялась или идёт — повторная не запускается
 * - reloadPermissions выполняет принудительную перезагрузку
 */
export function usePermissionsLoader() {
  const isAuthenticated = useUserStore((state) => state.isAuthenticated)
  const userId = useUserStore((state) => state.id)

  const setPermissions = usePermissionsStore((s) => s.setPermissions)
  const setFilterScope = usePermissionsStore((s) => s.setFilterScope)
  const setOrgContext = usePermissionsStore((s) => s.setOrgContext)
  const setUserId = usePermissionsStore((s) => s.setUserId)
  const setLoading = usePermissionsStore((s) => s.setLoading)
  const setError = usePermissionsStore((s) => s.setError)
  const clearError = usePermissionsStore((s) => s.clearError)
  const reset = usePermissionsStore((s) => s.reset)
  const isLoading = usePermissionsStore((s) => s.isLoading)
  const error = usePermissionsStore((s) => s.error)
  const permissions = usePermissionsStore((s) => s.permissions)

  const loadingRef = useRef(false)
  const lastUserIdRef = useRef<string | null>(null)
  const forceNextRef = useRef(false)

  // Функция загрузки разрешений
  // isBackground=true означает, что UI уже работает с кешированными данными
  const loadPermissions = useCallback(async (isBackground = false) => {
    const isForce = forceNextRef.current

    // Защита от дублирования запросов (force пробивает защиту)
    if (loadingRef.current && !isForce) {
      return
    }

    // Глобальная защита от повторной загрузки для того же userId
    if (!isForce && globalLoadInFlight && globalLastUserId === userId) {
      return
    }

    loadingRef.current = true
    // Не показываем loading если это фоновое обновление кешированных данных
    if (!isBackground) {
      setLoading(true)
    }
    clearError()

    try {
      globalLastUserId = userId

      const taskPromise = Sentry.startSpan(
        { name: 'loadUnifiedPermissions' },
        async () => {
          const result = await getFilterContext()

          if (!result.success) {
            const errorMsg = result.error || 'Ошибка загрузки контекста'
            console.error('Ошибка загрузки permissions:', errorMsg)
            setError(errorMsg)
            Sentry.captureMessage(`Ошибка загрузки permissions: ${errorMsg}`)
            return
          }

          if (!result.data) {
            const errorMsg = 'Контекст пользователя не найден'
            console.warn(errorMsg)
            setError(errorMsg)
            return
          }

          const { data } = result

          if (!data.permissions || data.permissions.length === 0) {
            const errorMsg = 'У пользователя нет разрешений'
            console.warn(errorMsg)
            setError(errorMsg)
            Sentry.captureMessage(errorMsg)
            return
          }

          // Устанавливаем все данные
          setPermissions(data.permissions)
          setFilterScope(data.scope)
          setUserId(data.userId)

          const orgContext: OrgContext = {
            ownTeamId: data.ownTeamId || null,
            ownDepartmentId: data.ownDepartmentId || null,
            ownSubdivisionId: data.ownSubdivisionId || null,
            leadTeamId: data.leadTeamId || null,
            headDepartmentId: data.headDepartmentId || null,
            headSubdivisionId: data.headSubdivisionId || null,
            managedProjectIds: data.managedProjectIds || [],
          }
          setOrgContext(orgContext)
        }
      )

      globalLoadInFlight = taskPromise ?? null
      await taskPromise
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : 'Неизвестная ошибка'
      console.error('Критическая ошибка загрузки permissions:', errorMsg)
      setError(`Критическая ошибка: ${errorMsg}`)
      Sentry.captureException(error)
    } finally {
      setLoading(false)
      loadingRef.current = false
      forceNextRef.current = false
      globalLoadInFlight = null
    }
  }, [
    userId,
    setPermissions,
    setFilterScope,
    setOrgContext,
    setUserId,
    setLoading,
    setError,
    clearError,
  ])

  // Эффект для автоматической загрузки при авторизации
  // Используем getState() для snapshot вместо реактивных deps — избегаем double-fire при reset()
  useEffect(() => {
    if (isAuthenticated && userId) {
      // При смене пользователя очищаем store
      if (lastUserIdRef.current && lastUserIdRef.current !== userId) {
        reset()
      }

      // Snapshot из store (не реактивный) — избегаем проблемы с устаревшим значением в closure
      const { permissions: cachedPerms, userId: storedUserId } =
        usePermissionsStore.getState()

      const hasCachedPermissions =
        cachedPerms.length > 0 && storedUserId === userId

      const alreadyLoaded =
        cachedPerms.length > 0 && lastUserIdRef.current === userId
      const loadingForSameUser =
        globalLoadInFlight && globalLastUserId === userId

      if (!alreadyLoaded && !loadingForSameUser && !loadingRef.current) {
        lastUserIdRef.current = userId

        if (hasCachedPermissions) {
          // Кеш валиден — обновляем в фоне, UI не блокируется
          loadPermissions(true)
        } else {
          // Нет кеша — блокирующая загрузка
          loadPermissions(false)
        }
      } else if (lastUserIdRef.current !== userId) {
        lastUserIdRef.current = userId
      }
    } else if (!isAuthenticated) {
      // Пользователь вышел
      lastUserIdRef.current = null
      globalLastUserId = null
      reset()
    }
  }, [isAuthenticated, userId, loadPermissions, reset])

  // Функция принудительной перезагрузки
  const reloadPermissions = useCallback(() => {
    if (userId) {
      forceNextRef.current = true
      loadPermissions(false)
    }
  }, [userId, loadPermissions])

  return {
    permissions,
    isLoading,
    error,
    reloadPermissions,
    hasPermissions: permissions.length > 0,
  }
}
