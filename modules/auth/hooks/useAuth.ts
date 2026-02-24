"use client"

import { useCallback } from "react"
import { useUserStore } from "@/stores/useUserStore"
import { useAuthContext } from "../components/AuthProvider"
import type { UserProfile } from "../types"

/**
 * Хук для работы с авторизацией
 *
 * Объединяет данные из useUserStore и AuthContext
 * Предоставляет удобный API для компонентов
 */
export function useAuth() {
  const { isInitialized, isLoading: authLoading, signOut } = useAuthContext()

  // Данные пользователя из store
  const id = useUserStore((state) => state.id)
  const email = useUserStore((state) => state.email)
  const name = useUserStore((state) => state.name)
  const profile = useUserStore((state) => state.profile)
  const isAuthenticated = useUserStore((state) => state.isAuthenticated)

  return {
    // Состояние
    isInitialized,
    isLoading: authLoading,
    isAuthenticated,

    // Данные пользователя
    user: isAuthenticated ? {
      id: id!,
      email: email!,
      name: name!,
      profile
    } : null,

    // Отдельные поля для удобства
    userId: id,
    userEmail: email,
    userName: name,
    userProfile: profile,

    // Действия
    signOut
  }
}

/**
 * Хук для получения данных текущего пользователя
 * Выбрасывает ошибку если пользователь не авторизован
 */
export function useCurrentUser() {
  const { user, isAuthenticated } = useAuth()

  if (!isAuthenticated || !user) {
    throw new Error("User is not authenticated")
  }

  return user
}

/**
 * Хук для проверки авторизации
 */
export function useIsAuthenticated(): boolean {
  return useUserStore((state) => state.isAuthenticated)
}

/**
 * Хук для получения ID текущего пользователя
 */
export function useUserId(): string | null {
  return useUserStore((state) => state.id)
}

/**
 * Хук для получения профиля пользователя
 */
export function useUserProfile(): UserProfile | null {
  return useUserStore((state) => state.profile)
}

/**
 * Хук для получения аватара пользователя
 */
export function useUserAvatar(): string | null {
  const profile = useUserStore((state) => state.profile)
  return profile?.avatar_url ?? null
}

/**
 * Хук для получения полного имени пользователя
 */
export function useUserName(): string {
  const name = useUserStore((state) => state.name)
  return name ?? "Пользователь"
}

/**
 * Хук для получения email пользователя
 */
export function useUserEmail(): string | null {
  return useUserStore((state) => state.email)
}
