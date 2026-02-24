"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import type { UserReport } from "../services/feedbackAnalyticsService"

export function useUserReports() {
  const abortControllerRef = useRef<AbortController | null>(null)
  const requestIdRef = useRef(0)
  const [reports, setReports] = useState<UserReport[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [hasAccess, setHasAccess] = useState<boolean | null>(null)
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  const loadData = useCallback(async (signal?: AbortSignal) => {
    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch(`/api/feedback-analytics/user-reports?sortOrder=${sortOrder}`, {
        signal,
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
        }
      })

      if (signal?.aborted) return

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

      const { data: reportsData } = await response.json()

      if (signal?.aborted) return

      if (!reportsData || !Array.isArray(reportsData)) {
        throw new Error('Неверный формат ответа')
      }

      setHasAccess(true)
      setReports(reportsData)
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return
      }
      console.error("Error loading user reports:", err)
      setError(err as Error)
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false)
      }
    }
  }, [sortOrder])

  // Загрузка при монтировании
  useEffect(() => {
    const currentId = ++requestIdRef.current

    const load = async () => {
      try {
        setIsLoading(true)
        setError(null)

        const response = await fetch(`/api/feedback-analytics/user-reports?sortOrder=${sortOrder}`, {
          cache: 'no-store',
          headers: {
            'Content-Type': 'application/json',
          }
        })

        if (requestIdRef.current !== currentId) return

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

        const { data: reportsData } = await response.json()

        if (requestIdRef.current !== currentId) return

        if (!reportsData || !Array.isArray(reportsData)) {
          throw new Error('Неверный формат ответа')
        }

        setHasAccess(true)
        setReports(reportsData)
      } catch (err) {
        if (requestIdRef.current !== currentId) return
        console.error("Error loading user reports:", err)
        setError(err as Error)
      } finally {
        setIsLoading(false)
      }
    }

    load()

    return () => {}
  }, [sortOrder])

  const refresh = useCallback(() => {
    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    // Create new controller and load data
    const abortController = new AbortController()
    abortControllerRef.current = abortController

    loadData(abortController.signal)
  }, [loadData])

  const toggleSortOrder = useCallback(() => {
    setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')
  }, [])

  return {
    reports,
    isLoading,
    error,
    refresh,
    hasAccess,
    sortOrder,
    toggleSortOrder,
  }
}
