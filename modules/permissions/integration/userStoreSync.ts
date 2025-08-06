import { useEffect } from 'react'
import { useUserStore } from '@/stores/useUserStore'
import { usePermissionsStore } from '../store/usePermissionsStore'

/**
 * Хук для синхронизации permissions модуля с useUserStore
 * Автоматически загружает разрешения при смене пользователя
 */
export function useUserPermissionsSync() {
  const userId = useUserStore(state => state.id)
  const isAuthenticated = useUserStore(state => state.isAuthenticated)
  const { loadPermissions, reset } = usePermissionsStore()

  useEffect(() => {
    if (userId && isAuthenticated) {
      console.log('🔄 Пользователь изменился, загружаем разрешения:', userId)
      loadPermissions(userId)
    } else {
      console.log('🗑️ Пользователь не авторизован, очищаем разрешения')
      reset()
    }
  }, [userId, isAuthenticated, loadPermissions, reset])

  useEffect(() => {
    // Очищаем разрешения при размонтировании компонента
    return () => {
      console.log('🧹 Очистка permissions при размонтировании')
      reset()
    }
  }, [reset])
}

/**
 * Компонент-провайдер для автоматической синхронизации
 * Используйте в корне приложения для автоматической работы системы разрешений
 */
export function UserPermissionsSyncProvider({ children }: { children: React.ReactNode }) {
  useUserPermissionsSync()
  return children
}