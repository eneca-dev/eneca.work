/**
 * Operation Guard Hook
 *
 * Защита от race conditions при асинхронных операциях.
 * Позволяет определить, является ли текущая операция актуальной.
 */

import { useRef, useCallback } from 'react'

// Глобальный счётчик операций (singleton)
let globalOperationCounter = 0

/**
 * Хук для защиты от race conditions
 *
 * @example
 * const { startOperation, isOperationStale } = useOperationGuard()
 *
 * const handleSubmit = async () => {
 *   const operationId = startOperation()
 *
 *   // ... async work ...
 *
 *   if (isOperationStale(operationId)) {
 *     console.log('Operation stale, skipping')
 *     return
 *   }
 *
 *   // ... continue with result ...
 * }
 */
export function useOperationGuard() {
  const currentOperationRef = useRef<number>(0)

  /**
   * Начинает новую операцию и возвращает её ID
   */
  const startOperation = useCallback(() => {
    const operationId = ++globalOperationCounter
    currentOperationRef.current = operationId
    return operationId
  }, [])

  /**
   * Проверяет, является ли операция устаревшей
   */
  const isOperationStale = useCallback((operationId: number) => {
    return currentOperationRef.current !== operationId
  }, [])

  /**
   * Проверяет, является ли операция текущей (актуальной)
   */
  const isOperationCurrent = useCallback((operationId: number) => {
    return currentOperationRef.current === operationId
  }, [])

  return {
    startOperation,
    isOperationStale,
    isOperationCurrent,
  }
}
