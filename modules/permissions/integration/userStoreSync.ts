import { useEffect } from 'react'
import { useUserStore } from '@/stores/useUserStore'
import { usePermissionsStore } from '../store/usePermissionsStore'
import { ROLE_TEMPLATES } from '../constants/roles'

/**
 * Хук для синхронизации permissions модуля с useUserStore
 * Автоматически загружает разрешения при смене пользователя
 */
export function useUserPermissionsSync() {
  const isAuthenticated = useUserStore(state => state.isAuthenticated)
  const roleId = useUserStore(state => state.profile?.roleId)
  const { setFromRole, reset } = usePermissionsStore()

  useEffect(() => {
    if (isAuthenticated) {
      setFromRole(roleId)
    } else {
      reset()
    }
  }, [isAuthenticated, roleId, setFromRole, reset])

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