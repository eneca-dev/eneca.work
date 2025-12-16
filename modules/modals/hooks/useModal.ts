'use client'

import { useState, useCallback } from 'react'
import type { ModalState } from '../types'

/**
 * Универсальный хук для управления состоянием модалки
 *
 * @example
 * ```tsx
 * const { isOpen, open, close, data } = useModal<{ sectionId: string }>()
 *
 * <Button onClick={() => open({ sectionId: '123' })}>
 *   Открыть
 * </Button>
 *
 * <SomeModal
 *   isOpen={isOpen}
 *   onClose={close}
 *   sectionId={data?.sectionId}
 * />
 * ```
 */
export function useModal<TData = unknown>(
  initialOpen = false
): ModalState<TData> {
  const [isOpen, setIsOpen] = useState(initialOpen)
  const [data, setData] = useState<TData | null>(null)

  const open = useCallback((newData?: TData) => {
    setData(newData ?? null)
    setIsOpen(true)
  }, [])

  const close = useCallback(() => {
    setIsOpen(false)
    // Очищаем данные с небольшой задержкой для анимации закрытия
    setTimeout(() => setData(null), 200)
  }, [])

  const toggle = useCallback(() => {
    setIsOpen((prev) => !prev)
  }, [])

  return {
    isOpen,
    data,
    open,
    close,
    toggle,
  }
}
