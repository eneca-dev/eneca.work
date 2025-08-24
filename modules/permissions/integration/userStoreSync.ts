import { usePermissionsLoader } from '../hooks/usePermissionsLoader'

/**
 * Хук для синхронизации permissions модуля с useUserStore
 * Автоматически загружает разрешения при смене пользователя из Supabase
 */
export function useUserPermissionsSync() {
  // Используем новый надёжный загрузчик разрешений
  const { isLoading, error, hasPermissions, reloadPermissions } = usePermissionsLoader()
  
  // Возвращаем состояние для компонентов
  return {
    isLoading,
    error,
    hasPermissions,
    reloadPermissions
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