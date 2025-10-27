import * as Sentry from "@sentry/nextjs"

/**
 * Простая утилита для установки пользователя в Sentry
 * Использует стандартный API Sentry для отслеживания пользователей
 */
export function setSentryUser(
  userId: string | null,
  email: string | null,
  firstName?: string | null,
  lastName?: string | null
) {
  if (!userId || !email) {
    Sentry.setUser(null)
    return
  }

  const fullName = [firstName, lastName].filter(Boolean).join(' ')

  Sentry.setUser({
    id: userId,
    email: email,
    username: fullName || email,
  })

  // Дополнительные теги для фильтрации в Sentry
  if (firstName || lastName) {
    Sentry.setTag('user_name', fullName)
  }
}

/**
 * Очистка пользователя из Sentry
 */
export function clearSentryUser() {
  Sentry.setUser(null)
}