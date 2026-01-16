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
 * Идемпотентность:
 * - Если для того же userId загрузка уже выполнялась или идёт — повторная не запускается
 * - reloadPermissions выполняет принудительную перезагрузку
 */
export function usePermissionsLoader() {
  const isAuthenticated = useUserStore((state) => state.isAuthenticated)
  const userId = useUserStore((state) => state.id)

  const setPermissions = usePermissionsStore((s) => s.setPermissions)
  const setFilterScope = usePermissionsStore((s) => s.setFilterScope)
  const setOrgContext = usePermissionsStore((s) => s.setOrgContext)
  const setLoading = usePermissionsStore((s) => s.setLoading)
  const setError = usePermissionsStore((s) => s.setError)
  const clearError = usePermissionsStore((s) => s.clearError)
  const reset = usePermissionsStore((s) => s.reset)
  const permissions = usePermissionsStore((s) => s.permissions)
  const isLoading = usePermissionsStore((s) => s.isLoading)
  const error = usePermissionsStore((s) => s.error)

  const loadingRef = useRef(false)
  const lastUserIdRef = useRef<string | null>(null)
  const forceNextRef = useRef(false)

  // Функция загрузки разрешений
  const loadPermissions = useCallback(async () => {
    const isForce = forceNextRef.current === true

    // Защита от дублирования запросов
    if (loadingRef.current) {
      return
    }

    // Глобальная защита от повторной загрузки для того же userId
    if (!isForce && globalLoadInFlight && globalLastUserId === userId) {
      return
    }

    loadingRef.current = true
    setLoading(true)
    clearError()

    try {
      globalLastUserId = userId

      const taskPromise = Sentry.startSpan(
        { name: 'loadUnifiedPermissions' },
        async () => {
          // Единый вызов getFilterContext
          const result = await getFilterContext()

          if (!result.success) {
            const errorMsg = result.error || 'Ошибка загрузки контекста'
            console.error('❌ Ошибка загрузки permissions:', errorMsg)
            setError(errorMsg)
            Sentry.captureMessage(`Ошибка загрузки permissions: ${errorMsg}`)
            return
          }

          if (!result.data) {
            const errorMsg = 'Контекст пользователя не найден'
            console.warn('⚠️', errorMsg)
            setError(errorMsg)
            return
          }

          const { data } = result

          // Проверяем что есть permissions
          if (!data.permissions || data.permissions.length === 0) {
            const errorMsg = 'У пользователя нет разрешений'
            console.warn('⚠️', errorMsg)
            setError(errorMsg)
            Sentry.captureMessage(errorMsg)
            return
          }

          // Устанавливаем permissions
          setPermissions(data.permissions)

          // Устанавливаем filter scope
          setFilterScope(data.scope)

          // Формируем и устанавливаем org context
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

      if (!isForce) {
        globalLoadInFlight = taskPromise
      }

      await taskPromise
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : 'Неизвестная ошибка'
      console.error('💥 Критическая ошибка загрузки permissions:', errorMsg)
      setError(`Критическая ошибка: ${errorMsg}`)
      Sentry.captureException(error)
    } finally {
      setLoading(false)
      loadingRef.current = false
      forceNextRef.current = false
      if (!forceNextRef.current) globalLoadInFlight = null
    }
  }, [
    userId,
    setPermissions,
    setFilterScope,
    setOrgContext,
    setLoading,
    setError,
    clearError,
  ])

  // Эффект для автоматической загрузки при авторизации
  useEffect(() => {
    if (isAuthenticated && userId) {
      // При смене пользователя очищаем store
      if (lastUserIdRef.current && lastUserIdRef.current !== userId) {
        reset()
      }

      // Проверяем нужно ли загружать
      const alreadyLoaded =
        permissions.length > 0 && lastUserIdRef.current === userId
      const loadingForSameUser =
        globalLoadInFlight && globalLastUserId === userId

      if (!alreadyLoaded && !loadingForSameUser && !loadingRef.current) {
        lastUserIdRef.current = userId
        loadPermissions()
      } else if (lastUserIdRef.current !== userId) {
        lastUserIdRef.current = userId
      }
    } else if (!isAuthenticated) {
      // Пользователь вышел
      lastUserIdRef.current = null
      globalLastUserId = null
      reset()
    }
  }, [isAuthenticated, userId, loadPermissions, reset, permissions.length])

  // Функция принудительной перезагрузки
  const reloadPermissions = useCallback(() => {
    if (userId) {
      forceNextRef.current = true
      loadPermissions()
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

