/**
 * Auth Module - Public API
 *
 * Централизованный модуль авторизации
 *
 * Функции:
 * - AuthProvider — слушает события Supabase Auth
 * - useAuth — хук для доступа к данным авторизации
 * - Типы для работы с пользователями
 */

// Components
export { AuthProvider, useAuthContext } from './components/AuthProvider'

// Hooks
export {
  useAuth,
  useCurrentUser,
  useIsAuthenticated,
  useUserId,
  useUserProfile,
  useUserAvatar,
  useUserName,
  useUserEmail,
} from './hooks/useAuth'

// Types
export type {
  UserProfile,
  UserData,
  UserState,
  AuthContextValue,
  AuthEvent,
  AuthResult,
  Session,
  User,
} from './types'
