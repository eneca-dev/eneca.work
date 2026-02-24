"use client"

import { useEffect, useRef, useCallback, createContext, useContext, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/utils/supabase/client"
import { useUserStore } from "@/stores/useUserStore"
import { usePermissionsStore } from "@/modules/permissions/store/usePermissionsStore"
import { resetQueryClient } from "@/modules/cache/client/query-client"
import * as Sentry from "@sentry/nextjs"
import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js"

interface AuthContextValue {
  isInitialized: boolean
  isLoading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

interface AuthProviderProps {
  children: React.ReactNode
}

/**
 * Централизованный провайдер авторизации
 *
 * Функции:
 * - Слушает ВСЕ события Supabase Auth через onAuthStateChange
 * - Синхронизирует useUserStore при входе/выходе
 * - Очищает кэш TanStack Query при logout
 * - Очищает permissions при logout
 * - Устанавливает/очищает контекст Sentry
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const router = useRouter()
  const supabase = createClient()

  const [isInitialized, setIsInitialized] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const currentUserId = useRef<string | null>(null)
  const isLoadingProfile = useRef(false)

  /**
   * Загрузка профиля пользователя из БД
   */
  const loadUserProfile = useCallback(async (user: User) => {
    // Защита от параллельных загрузок
    if (isLoadingProfile.current) {
      // console.log("⏭️ Пропускаем: загрузка профиля уже в процессе")
      return
    }

    isLoadingProfile.current = true

    try {
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .single()

      if (error) {
        console.error("Ошибка загрузки профиля:", error)
        Sentry.captureException(error, {
          tags: { module: "auth", action: "load_profile" }
        })
      }

      const firstName = profile?.first_name ?? ""
      const lastName = profile?.last_name ?? ""
      const fullName = [firstName, lastName].filter(Boolean).join(" ") ||
                       user.email?.split("@")[0] ||
                       "Пользователь"

      useUserStore.getState().setUser({
        id: user.id,
        email: user.email ?? "",
        name: fullName,
        profile: profile ?? null
      })

      // Устанавливаем пользователя в Sentry
      Sentry.setUser({
        id: user.id,
        email: user.email,
        username: fullName
      })

      // console.log("✅ Профиль загружен:", { userId: user.id, name: fullName })
    } catch (error) {
      console.error("Критическая ошибка загрузки профиля:", error)
      Sentry.captureException(error)
    } finally {
      isLoadingProfile.current = false
    }
  }, [supabase])

  /**
   * Полная очистка состояния приложения при logout
   */
  const clearAllState = useCallback(() => {
    // console.log("🧹 Очистка всего состояния приложения")

    // Очищаем Zustand stores
    useUserStore.getState().clearUser()

    // Очищаем permissions store (включая localStorage persist)
    usePermissionsStore.getState().clearPermissions()

    // Очищаем TanStack Query cache
    resetQueryClient()

    // Очищаем Sentry user context
    Sentry.setUser(null)

    // Очищаем legacy ключи localStorage
    if (typeof window !== "undefined") {
      localStorage.removeItem("avatarUrl")
      localStorage.removeItem("displayName")
      localStorage.removeItem("displayEmail")
    }

    currentUserId.current = null
  }, [])

  /**
   * Выход из системы
   */
  const signOut = useCallback(async () => {
    try {
      setIsLoading(true)

      // Сначала очищаем состояние — пользователь сразу видит эффект
      clearAllState()

      // Редирект сразу — не ждём ответа от Supabase
      router.push("/auth/login")

      // Потом вызываем signOut (в фоне)
      await supabase.auth.signOut()
    } catch (error) {
      console.error("Ошибка при выходе:", error)
      Sentry.captureException(error)
    } finally {
      setIsLoading(false)
    }
  }, [supabase, clearAllState, router])

  /**
   * Синхронизация профиля пользователя при входе/инициализации.
   * Если данные уже в store (из localStorage) — обновляет в фоне, иначе блокирует.
   */
  const syncUserSession = useCallback(async (user: User) => {
    if (currentUserId.current === user.id) return

    currentUserId.current = user.id

    const cachedUser = useUserStore.getState()
    if (cachedUser.id === user.id && cachedUser.isAuthenticated) {
      loadUserProfile(user) // фоновое обновление
    } else {
      await loadUserProfile(user)
    }
  }, [loadUserProfile])

  /**
   * Обработчик изменений состояния авторизации
   */
  const handleAuthStateChange = useCallback(async (
    event: AuthChangeEvent,
    session: Session | null
  ) => {
    switch (event) {
      case "INITIAL_SESSION":
        if (session?.user) {
          await syncUserSession(session.user)
        }
        setIsInitialized(true)
        setIsLoading(false)
        break

      case "SIGNED_IN":
        if (session?.user) {
          await syncUserSession(session.user)
        }
        setIsLoading(false)
        break

      case "SIGNED_OUT":
        clearAllState()
        setIsLoading(false)
        if (!window.location.pathname.startsWith("/auth")) {
          router.push("/auth/login")
        }
        break

      case "TOKEN_REFRESHED":
        break

      case "USER_UPDATED":
        if (session?.user) {
          await loadUserProfile(session.user)
        }
        break

      case "PASSWORD_RECOVERY":
        router.push("/auth/reset-password")
        break
    }
  }, [syncUserSession, loadUserProfile, clearAllState, router])

  // Инициализация при монтировании
  // onAuthStateChange автоматически стреляет INITIAL_SESSION при подписке,
  // что заменяет отдельный getSession() — убираем лишний сетевой запрос.
  useEffect(() => {
    let mounted = true

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (mounted) {
          handleAuthStateChange(event, session)
        }
      }
    )

    // Cleanup
    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [supabase, handleAuthStateChange])

  const contextValue: AuthContextValue = {
    isInitialized,
    isLoading,
    signOut
  }

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  )
}

/**
 * Хук для доступа к контексту авторизации
 */
export function useAuthContext(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuthContext must be used within AuthProvider")
  }
  return context
}
