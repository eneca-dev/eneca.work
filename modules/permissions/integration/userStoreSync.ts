import { useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useUserStore } from '@/stores/useUserStore'
import { usePermissionsStore } from '../store/usePermissionsStore'
import { usePermissionsLoader } from '../hooks/usePermissionsLoader'
import { getUserPermissions } from '../supabase/supabasePermissions'

// Глобальная подписка на изменения таблицы user_permissions_cache для избежания дубликатов
let activeUserId: string | null = null
let activeChannel: ReturnType<ReturnType<typeof createClient>["channel"]> | null = null
// Маркер, что для данного пользователя уже проверили/обеспечили дефолтную роль
let ensuredRoleForUserId: string | null = null

/**
 * Хук для синхронизации permissions модуля с useUserStore
 * Автоматически загружает разрешения при смене пользователя из Supabase
 */
export function useUserPermissionsSync() {
  // Используем новый надёжный загрузчик разрешений
  const { isLoading, error, hasPermissions, reloadPermissions } = usePermissionsLoader()
  const userId = useUserStore(state => state.id)
  const isAuthenticated = useUserStore(state => state.isAuthenticated)
  const setPermissions = usePermissionsStore(state => state.setPermissions)

  useEffect(() => {
    const cleanup = () => {
      if (activeChannel) {
        activeChannel.unsubscribe()
        activeChannel = null
      }
      activeUserId = null
      ensuredRoleForUserId = null
    }

    // На логауте или отсутствии userId — отписываемся и очищаем глобальные ссылки
    if (!isAuthenticated || !userId) {
      cleanup()
      return cleanup
    }

    // Если подписка уже активна для этого пользователя — ничего не делаем
    if (activeUserId === userId && activeChannel) {
      return cleanup
    }

    // Переподписка при смене пользователя
    if (activeChannel) {
      activeChannel.unsubscribe()
      activeChannel = null
    }

    const supabase = createClient()
    activeUserId = userId
    activeChannel = supabase
      .channel(`user_permissions_cache:${userId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'user_permissions_cache',
        filter: `user_id=eq.${userId}`
      }, (payload: any) => {
        try {
          const nextPermissions: string[] = payload?.new?.permissions ?? []
          setPermissions(Array.isArray(nextPermissions) ? nextPermissions : [])
        } catch (e) {
          console.warn('PERMISSIONS Не удалось применить пермишенны из Realtime события', e)
        }
      })
      .subscribe()

    // При первой авторизации/смене пользователя — если ролей нет, назначаем дефолтную роль "user"
    ;(async () => {
      try {
        if (ensuredRoleForUserId === userId) return
        // Проверяем текущие роли пользователя
        const { data: existingRoles, error: rolesErr } = await supabase
          .from('view_user_roles')
          .select('role_name')
          .eq('user_id', userId)

        if (rolesErr) {
          console.warn('PERMISSIONS Ошибка проверки ролей пользователя:', rolesErr)
          return
        }

        const hasAnyRole = Array.isArray(existingRoles) && existingRoles.length > 0
        if (!hasAnyRole) {
          // Ищем id роли "user"
          const { data: userRole, error: findErr } = await supabase
            .from('roles')
            .select('id')
            .eq('name', 'user')
            .single()

          if (findErr || !userRole?.id) {
            console.warn('PERMISSIONS Не удалось найти дефолтную роль "user"', findErr)
            return
          }

          // Назначаем роль
          const { error: assignErr } = await supabase
            .from('user_roles')
            .insert({ user_id: userId, role_id: userRole.id })

          if (assignErr) {
            console.warn('PERMISSIONS Не удалось назначить дефолтную роль пользователю:', assignErr)
            return
          }

          // После назначения перезагружаем разрешения вручную
          reloadPermissions()
        }

        ensuredRoleForUserId = userId
      } catch (e) {
        console.warn('PERMISSIONS Ошибка при обеспечении дефолтной роли:', e)
      }
    })()
    return cleanup
  }, [isAuthenticated, userId, setPermissions, reloadPermissions])
  
  // Возвращаем состояние для компонентов
  return {
    isLoading,
    error,
    hasPermissions,
    reloadPermissions
  }
}

// Утилита для ручной перезагрузки без монтирования хуков загрузчика в компонентах
export async function reloadUserPermissions(): Promise<void> {
  const { id: userId } = useUserStore.getState()
  const { setPermissions, setLoading, setError, clearError } = usePermissionsStore.getState()
  if (!userId) return
  try {
    setLoading(true)
    clearError()
    const result = await getUserPermissions(userId)
    if (result.error) {
      setError(result.error)
      return
    }
    setPermissions(result.permissions || [])
  } catch (e: any) {
    setError(e?.message || 'Не удалось перезагрузить разрешения')
  } finally {
    setLoading(false)
  }
}

/**
 * Компонент-провайдер для автоматической синхронизации
 * Используйте в корне приложения для автоматической работы системы разрешений
 */
export function UserPermissionsSyncProvider({ children }: { children: React.ReactNode }) {
  useUserPermissionsSync()
  return children
}