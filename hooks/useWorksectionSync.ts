import { useState } from 'react'

interface SyncResult {
  success: boolean
  duration: number
  stats: {
    projects: { created: number; updated: number; unchanged: number; errors: number; skipped?: number }
    stages: { created: number; updated: number; unchanged: number; errors: number; skipped?: number }
    objects: { created: number; updated: number; unchanged: number; errors: number; skipped?: number }
    sections: { created: number; updated: number; unchanged: number; errors: number; skipped?: number }
    assignments: { attempted: number; successful: number; failed: number }
    user_search?: {
      total_searches: number
      successful_by_email: number
      successful_by_email_part: number
      successful_by_name: number
      successful_by_name_parts: number
      successful_by_fuzzy: number
      failed: number
      errors: number
      empty_queries: number
      searches: Array<{
        search_term: string
        search_id: string
        timestamp: string
      }>
    }
  }
  summary: {
    total: {
      created: number
      updated: number
      unchanged: number
      errors: number
      skipped: number
    }
    projects: { created: number; updated: number; unchanged: number; errors: number; skipped: number }
    stages: { created: number; updated: number; unchanged: number; errors: number; skipped: number }
    objects: { created: number; updated: number; unchanged: number; errors: number; skipped: number }
    sections: { created: number; updated: number; unchanged: number; errors: number; skipped: number }
    assignments: { attempted: number; successful: number; failed: number }
  }
  detailed_report?: {
    sync_summary: {
      duration_ms: number
      duration_readable: string
      timestamp: string
      total_actions: number
    }
    actions_by_type: {
      projects: Array<any>
      stages: Array<any>
      objects: Array<any>
      sections: Array<any>
    }
    statistics: {
      total_created: number
      total_updated: number
      total_errors: number
      total_skipped: number
    }
    assignment_summary: {
      total_assignments_attempted: number
      successful_assignments: number
      failed_assignments: number
      success_rate: string
      assignments_with_users: number
    }
    user_search_analysis: {
      total_searches?: number
      success_breakdown?: {
        by_email: { count: number; percentage: string }
        by_email_part: { count: number; percentage: string }
        by_name: { count: number; percentage: string }
        by_name_parts: { count: number; percentage: string }
        by_fuzzy: { count: number; percentage: string }
      }
      failed_searches?: number
      error_searches?: number
      empty_queries?: number
      success_rate?: string
      recommendations?: string[]
      message?: string
    }
    all_actions: Array<{
      action: 'created' | 'updated' | 'moved' | 'error'
      type: 'project' | 'stage' | 'object' | 'section'
      id?: string
      name: string
      project?: string
      object?: string
      stage?: string
      timestamp: string
      sync_type?: 'standard' | 'os'
      responsible_assigned?: boolean
      manager_assigned?: boolean
      responsible_info?: string
      manager_info?: string
      error?: string
      dates?: {
        start: string | null
        end: string | null
      }
    }>
  }
  user_search_summary?: {
    total_searches: number
    successful_searches: number
    failed_searches: number
    success_rate: string
    most_effective_strategy: string
    search_quality: string
  } | null
  error?: string
}

interface UseSyncReturn {
  isSyncing: boolean
  syncStatus: 'idle' | 'success' | 'error'
  syncWithWorksection: () => Promise<void>
  resetStatus: () => void
  currentOffset: number
  resetPagination: () => void
}

export function useWorksectionSync(): UseSyncReturn {
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncStatus, setSyncStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [currentOffset, setCurrentOffset] = useState(0)

  const syncWithWorksection = async (): Promise<void> => {
    if (isSyncing) return
    
    setIsSyncing(true)
    setSyncStatus('idle')
    setCurrentOffset(0) // Сбрасываем offset в начале полной синхронизации
    
    const integrationUrl = process.env.NEXT_PUBLIC_WS_INTEGRATION_URL || 'https://ws-to-work-integration-eneca-7cab192e5438.herokuapp.com'
    
    // Функция для одного запроса синхронизации
    const syncBatch = async (offset: number): Promise<{ success: boolean; hasMore: boolean }> => {
      try {
        const response = await fetch(`${integrationUrl}/api/sync?offset=${offset}&limit=3`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          signal: AbortSignal.timeout(30000) // 30 секунд таймаут для каждого запроса
        })
        
        if (response.ok) {
          try {
            const data = await response.json()
            return { 
              success: true, 
              hasMore: data.pagination?.hasMore ?? true // По умолчанию продолжаем если нет информации
            }
          } catch (error) {
            // Если не можем распарсить JSON, продолжаем
            return { success: true, hasMore: true }
          }
        }
        
        return { success: false, hasMore: false }
      } catch (error) {
        console.log(`Sync batch at offset ${offset} completed/failed, continuing...`)
        return { success: true, hasMore: true } // Продолжаем даже при ошибках
      }
    }
    
    // Автоматический цикл синхронизации
    const runFullSync = async () => {
      let offset = 0
      let batchNumber = 1
      
      while (true) {
        console.log(`🔄 Запуск батча ${batchNumber} (проекты ${offset + 1}-${offset + 3})`)
        setCurrentOffset(offset)
        
        // Запускаем батч
        const result = await syncBatch(offset)
        
        // Если серьер сообщил что проектов больше нет, останавливаемся
        if (!result.hasMore) {
          console.log('🏁 Сервер сообщил что проектов больше нет, завершаем синхронизацию')
          break
        }
        
        // Увеличиваем offset для следующего батча
        offset += 3
        batchNumber++
        
        // Защита от бесконечного цикла - максимум 20 батчей (60 проектов)
        if (batchNumber > 20) {
          console.log('🛑 Достигнут максимум батчей (20), завершаем синхронизацию')
          break
        }
        
        // Ждем 35 секунд перед следующим батчем
        console.log(`⏳ Ожидание 35 секунд перед следующим батчем...`)
        await new Promise(resolve => setTimeout(resolve, 35000))
      }
      
      // Завершаем синхронизацию
      setIsSyncing(false)
      setSyncStatus('success')
      
      // Сбрасываем статус через 5 секунд
      setTimeout(() => {
        setSyncStatus('idle')
      }, 5000)
    }
    
    // Запускаем полную синхронизацию
    runFullSync().catch((error) => {
      console.error('Full sync error:', error)
      setIsSyncing(false)
      setSyncStatus('error')
    })
  }

  const resetStatus = () => {
    setSyncStatus('idle')
  }

  const resetPagination = () => {
    setCurrentOffset(0)
  }

  return {
    isSyncing,
    syncStatus,
    syncWithWorksection,
    resetStatus,
    currentOffset,
    resetPagination
  }
} 