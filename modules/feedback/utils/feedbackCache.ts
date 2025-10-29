// Утилита для кеширования данных feedback в sessionStorage

interface FeedbackCache {
  next_survey_at: string | null
  hasDbRecord: boolean
  cachedAt: number
}

const CACHE_PREFIX = 'feedback.cache'
const CACHE_VERSION = 'v1'

function getCacheKey(userId: string | null): string | null {
  if (!userId) return null
  return `${CACHE_PREFIX}.${CACHE_VERSION}.${userId}`
}

export function getFeedbackCache(userId: string | null): FeedbackCache | null {
  const key = getCacheKey(userId)
  if (!key) return null

  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) return null

    const cached = JSON.parse(raw) as FeedbackCache

    // Проверяем валидность кеша (не старше 24 часов)
    const maxAge = 24 * 60 * 60 * 1000 // 24 часа
    if (Date.now() - cached.cachedAt > maxAge) {
      sessionStorage.removeItem(key)
      return null
    }

    return cached
  } catch {
    return null
  }
}

export function setFeedbackCache(
  userId: string | null,
  data: { next_survey_at: string | null; hasDbRecord: boolean }
): void {
  const key = getCacheKey(userId)
  if (!key) return

  try {
    const cache: FeedbackCache = {
      next_survey_at: data.next_survey_at,
      hasDbRecord: data.hasDbRecord,
      cachedAt: Date.now()
    }
    sessionStorage.setItem(key, JSON.stringify(cache))
  } catch {
    // Ignore storage errors
  }
}

export function clearFeedbackCache(userId: string | null): void {
  const key = getCacheKey(userId)
  if (!key) return

  try {
    sessionStorage.removeItem(key)
  } catch {
    // Ignore storage errors
  }
}