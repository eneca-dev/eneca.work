/**
 * Hook для работы с AI аналитикой
 *
 * @module modules/ai-dashboard/hooks/useAIAnalytics
 */

'use client'

import { useState, useCallback } from 'react'
import type { AIAnalyticsState, AnalyticsResult } from '../types'
import { fetchAIAnalysis } from '../services/aiAgentService'

/**
 * Хук для работы с AI аналитикой
 *
 * @returns {Object} Состояние и методы для работы с AI
 * @property {boolean} isLoading - Идет ли загрузка
 * @property {string | null} error - Текст ошибки (если есть)
 * @property {AnalyticsResult | null} result - Результат анализа
 * @property {(query: string) => Promise<void>} runAnalysis - Запустить анализ
 * @property {() => void} reset - Сбросить состояние
 *
 * @example
 * ```typescript
 * const { isLoading, error, result, runAnalysis, reset } = useAIAnalytics()
 *
 * // Запустить анализ
 * await runAnalysis('Покажи топ 5 проектов по бюджету')
 *
 * // Сбросить состояние
 * reset()
 * ```
 */
export function useAIAnalytics() {
  const [state, setState] = useState<AIAnalyticsState>({
    isLoading: false,
    error: null,
    result: null
  })

  /**
   * Запустить анализ
   */
  const runAnalysis = useCallback(async (query: string) => {
    if (!query.trim()) {
      setState(prev => ({
        ...prev,
        error: 'Введите запрос для анализа'
      }))
      return
    }

    setState({
      isLoading: true,
      error: null,
      result: null
    })

    const startTime = Date.now()

    try {
      const response = await fetchAIAnalysis(query)
      const executionTime = Date.now() - startTime

      const result: AnalyticsResult = {
        query,
        response,
        timestamp: new Date(),
        executionTime
      }

      setState({
        isLoading: false,
        error: null,
        result
      })
    } catch (error) {
      console.error('[useAIAnalytics] Error:', error)

      let errorMessage = 'Произошла ошибка при анализе'

      if (error instanceof Error) {
        // Специфичные сообщения для разных типов ошибок
        if (error.message.includes('Too many requests')) {
          errorMessage = 'Слишком много запросов. Пожалуйста, подождите минуту.'
        } else if (error.message.includes('timeout')) {
          errorMessage = 'Анализ занял слишком много времени. Попробуйте упростить запрос.'
        } else if (error.message.includes('Unauthorized')) {
          errorMessage = 'Сессия истекла. Пожалуйста, обновите страницу.'
        } else {
          errorMessage = error.message
        }
      }

      setState({
        isLoading: false,
        error: errorMessage,
        result: null
      })
    }
  }, [])

  /**
   * Сбросить состояние
   */
  const reset = useCallback(() => {
    setState({
      isLoading: false,
      error: null,
      result: null
    })
  }, [])

  return {
    ...state,
    runAnalysis,
    reset
  }
}
