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
}

export function useWorksectionSync(): UseSyncReturn {
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncStatus, setSyncStatus] = useState<'idle' | 'success' | 'error'>('idle')

  const syncWithWorksection = async (): Promise<void> => {
    if (isSyncing) return
    
    setIsSyncing(true)
    setSyncStatus('idle')
    
    const integrationUrl = process.env.NEXT_PUBLIC_WS_INTEGRATION_URL || 'https://ws-to-work-integration-eneca-7cab192e5438.herokuapp.com'
    
    // Fire-and-forget: просто запускаем синхронизацию, не ждем ответа
    fetch(`${integrationUrl}/api/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    }).catch(() => {
      // Подавляем все ошибки
    })
    
    // Блокируем кнопку на 90 секунд
    setTimeout(() => {
      setIsSyncing(false)
      setSyncStatus('success') // Всегда показываем как успешную
      
      // Сбрасываем статус через 3 секунды
      setTimeout(() => {
        setSyncStatus('idle')
      }, 3000)
    }, 90000) // 90 секунд
  }

  const resetStatus = () => {
    setSyncStatus('idle')
  }

  return {
    isSyncing,
    syncStatus,
    syncWithWorksection,
    resetStatus
  }
} 