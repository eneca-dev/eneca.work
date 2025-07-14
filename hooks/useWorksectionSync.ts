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
      action: 'created' | 'updated' | 'error'
      type: 'project' | 'stage' | 'object' | 'section'
      id?: string
      name: string
      project?: string
      object?: string
      timestamp: string
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
  syncWithWorksection: () => Promise<SyncResult | null>
  resetStatus: () => void
  lastSyncResult: SyncResult | null
}

export function useWorksectionSync(): UseSyncReturn {
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncStatus, setSyncStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null)

  const syncWithWorksection = async (): Promise<SyncResult | null> => {
    if (isSyncing) return null
    
    setIsSyncing(true)
    setSyncStatus('idle')
    
    try {
      console.log('🚀 Запуск синхронизации с Worksection...')
      
      const integrationUrl = process.env.NEXT_PUBLIC_WS_INTEGRATION_URL || 'https://ws-to-work-integration-eneca-7cab192e5438.herokuapp.com'
      
      const response = await fetch(`${integrationUrl}/api/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const result: SyncResult = await response.json()
      
      console.log('📊 Детальный результат синхронизации:', result)
      
      // Логируем подробную статистику
      if (result.summary) {
        console.log('📈 Статистика синхронизации:')
        console.log(`  🆕 Создано: ${result.summary.total.created}`)
        console.log(`  🔄 Обновлено: ${result.summary.total.updated}`)
        console.log(`  ✅ Без изменений: ${result.summary.total.unchanged}`)
        console.log(`  ❌ Ошибки: ${result.summary.total.errors}`)
        console.log(`  🚫 Пропущено: ${result.summary.total.skipped}`)
      }
      
      // Логируем статистику поиска пользователей
      if (result.user_search_summary) {
        console.log('👤 Статистика поиска пользователей:')
        console.log(`  Всего поисков: ${result.user_search_summary.total_searches}`)
        console.log(`  Успешных: ${result.user_search_summary.successful_searches}`)
        console.log(`  Неудачных: ${result.user_search_summary.failed_searches}`)
        console.log(`  Процент успеха: ${result.user_search_summary.success_rate}%`)
        console.log(`  Самая эффективная стратегия: ${result.user_search_summary.most_effective_strategy}`)
        console.log(`  Качество поиска: ${result.user_search_summary.search_quality}`)
      }
      
      // Логируем подробный отчет
      if (result.detailed_report) {
        console.log('📋 Подробный отчет о синхронизации:')
        console.log(`  Время выполнения: ${result.detailed_report.sync_summary.duration_readable}`)
        console.log(`  Всего действий: ${result.detailed_report.sync_summary.total_actions}`)
        console.log(`  Успешных назначений: ${result.detailed_report.assignment_summary.successful_assignments}`)
        console.log(`  Процент успешных назначений: ${result.detailed_report.assignment_summary.success_rate}%`)
        
        if (result.detailed_report.user_search_analysis.recommendations) {
          console.log('💡 Рекомендации по улучшению:')
          result.detailed_report.user_search_analysis.recommendations.forEach((rec, index) => {
            console.log(`  ${index + 1}. ${rec}`)
          })
        }
      }
      
      setLastSyncResult(result)
      
      if (result.success) {
        console.log('✅ Синхронизация завершена успешно')
        setSyncStatus('success')
        return result
      } else {
        throw new Error(result.error || 'Неизвестная ошибка синхронизации')
      }
      
    } catch (error) {
      console.error('❌ Ошибка синхронизации:', error)
      setSyncStatus('error')
      
      const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка'
      throw new Error(errorMessage)
      
    } finally {
      setIsSyncing(false)
      
      // Сбрасываем статус через 3 секунды
      setTimeout(() => {
        setSyncStatus('idle')
      }, 3000)
    }
  }

  const resetStatus = () => {
    setSyncStatus('idle')
  }

  return {
    isSyncing,
    syncStatus,
    syncWithWorksection,
    resetStatus,
    lastSyncResult
  }
} 