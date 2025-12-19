import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'

// ============================================================================
// Types
// ============================================================================

export interface StageStatus {
  id: string
  name: string
  color: string
  description: string | null
  kanban_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface StageStatusFormData {
  name: string
  color: string
  description?: string | null
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Хук для работы со статусами этапов канбан-доски
 * Аналог useSectionStatuses, но для stage_statuses таблицы
 */
export function useStageStatuses() {
  const [statuses, setStatuses] = useState<StageStatus[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadStatuses = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('stage_statuses')
        .select('*')
        .eq('is_active', true)  // Только активные статусы
        .order('kanban_order')  // Сортируем по порядку колонок

      if (error) {
        console.warn('❌ Ошибка загрузки статусов этапов:', error)
        setError(error.message || 'Ошибка загрузки статусов')
        return
      }

      console.log('✅ Загружено статусов этапов:', data?.length || 0)
      setStatuses(data || [])
    } catch (err) {
      console.warn('❌ Ошибка загрузки статусов этапов:', err)
      const errorMessage = err instanceof Error ? err.message : 'Ошибка загрузки статусов'
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Загружаем статусы при монтировании компонента
  useEffect(() => {
    loadStatuses()
  }, [loadStatuses])

  // Слушаем глобальные события изменения статусов для автоматического обновления
  useEffect(() => {
    const handleStatusCreated = () => {
      console.log('📥 useStageStatuses: получили событие stageStatusCreated, обновляем список')
      loadStatuses()
    }

    const handleStatusUpdated = () => {
      console.log('📥 useStageStatuses: получили событие stageStatusUpdated, обновляем список')
      loadStatuses()
    }

    const handleStatusDeleted = () => {
      console.log('📥 useStageStatuses: получили событие stageStatusDeleted, обновляем список')
      loadStatuses()
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('stageStatusCreated', handleStatusCreated)
      window.addEventListener('stageStatusUpdated', handleStatusUpdated)
      window.addEventListener('stageStatusDeleted', handleStatusDeleted)
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('stageStatusCreated', handleStatusCreated)
        window.removeEventListener('stageStatusUpdated', handleStatusUpdated)
        window.removeEventListener('stageStatusDeleted', handleStatusDeleted)
      }
    }
  }, [loadStatuses])

  return {
    statuses,
    isLoading,
    error,
    loadStatuses,
  }
}
