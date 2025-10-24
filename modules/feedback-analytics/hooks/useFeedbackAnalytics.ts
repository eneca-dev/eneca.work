"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import {
  getFeedbackStats,
  getAllFeedbackUsers,
  type FeedbackStats,
  type FeedbackComment,
} from "../services/feedbackAnalyticsService"

export function useFeedbackAnalytics() {
  const abortControllerRef = useRef<AbortController | null>(null)
  const requestIdRef = useRef(0)
  const [stats, setStats] = useState<FeedbackStats | null>(null)
  const [comments, setComments] = useState<FeedbackComment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [hasAccess, setHasAccess] = useState<boolean | null>(null)

  // useEffect без зависимости от loadData - запускается только при монтировании
  useEffect(() => {
    const currentId = ++requestIdRef.current

    const loadData = async () => {
      try {
        setIsLoading(true)
        setError(null)

        const response = await fetch('/api/feedback-analytics/data', {
          cache: 'no-store',
          headers: {
            'Content-Type': 'application/json',
          }
        })

        if (requestIdRef.current !== currentId) return

        if (!response.ok) {
          if (requestIdRef.current !== currentId) return

          if (response.status === 401) {
            setHasAccess(false)
            throw new Error('Необходима авторизация')
          } else if (response.status === 403) {
            setHasAccess(false)
            throw new Error('Доступ запрещен')
          }
          throw new Error('Ошибка загрузки данных')
        }

        const { data: feedbackData } = await response.json()

        if (requestIdRef.current !== currentId) return

        if (!feedbackData || !Array.isArray(feedbackData)) {
          throw new Error('Неверный формат ответа')
        }

        if (requestIdRef.current !== currentId) return

        setHasAccess(true)

        const feedbackStats = getFeedbackStats(feedbackData)
        setStats(feedbackStats)

        const allComments = getAllFeedbackUsers(feedbackData)
        setComments(allComments)
      } catch (err) {
        if (requestIdRef.current !== currentId) return

        console.error("Error loading feedback analytics:", err)
        setError(err as Error)
      } finally {
        // Даже если это не самый актуальный запрос,
        // в dev StrictMode важно не зависать со спиннером
        setIsLoading(false)
      }
    }

    loadData()
    // Не абортируем запрос и не блокируем state в StrictMode,
    // просто игнорируем устаревшие завершения по requestId
    return () => {}
  }, []) // Пустой массив - эффект запускается только при монтировании

  const refresh = useCallback(() => {
    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    // Create new controller and load data
    const abortController = new AbortController()
    abortControllerRef.current = abortController

    const loadData = async (signal: AbortSignal) => {
      try {
        setIsLoading(true)
        setError(null)

        const response = await fetch('/api/feedback-analytics/data', {
          signal,
          cache: 'no-store',
          headers: {
            'Content-Type': 'application/json',
          }
        })

        if (signal.aborted) {
          return
        }

        if (!response.ok) {
          if (response.status === 401) {
            setHasAccess(false)
            throw new Error('Необходима авторизация')
          } else if (response.status === 403) {
            setHasAccess(false)
            throw new Error('Доступ запрещен')
          }
          throw new Error('Ошибка загрузки данных')
        }

        const { data: feedbackData } = await response.json()

        if (signal.aborted) {
          return
        }

        if (!feedbackData || !Array.isArray(feedbackData)) {
          throw new Error('Неверный формат ответа')
        }

        setHasAccess(true)

        const feedbackStats = getFeedbackStats(feedbackData)
        setStats(feedbackStats)

        const allComments = getAllFeedbackUsers(feedbackData)
        setComments(allComments)
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return
        }
        console.error("Error loading feedback analytics:", err)
        setError(err as Error)
      } finally {
        if (!signal.aborted) {
          setIsLoading(false)
        }
      }
    }

    loadData(abortController.signal)
  }, [])

  return {
    stats,
    comments,
    isLoading,
    error,
    refresh,
    hasAccess,
  }
}
