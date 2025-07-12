import { useState } from 'react'

interface SyncResult {
  success: boolean
  duration: string
  summary: {
    total_operations: number
    created: number
    updated: number
    unchanged: number
    errors: number
    warnings: number
    critical_errors: number
    performance: number
  }
  details: {
    projects?: any
    stages?: any
    objects?: any
    sections?: any
  }
  issues: {
    warnings: string[]
    critical_errors: string[]
  }
  logs: string[]
  detailed_logs: Array<{
    timestamp: string
    level: string
    message: string
    details?: any
  }>
  metadata: {
    timestamp: string
    duration_ms: number
    environment: {
      platform: string
      node_version: string
      working_directory: string
    }
    configuration: {
      supabase_configured: boolean
      worksection_configured: boolean
      retry_attempts: number
    }
  }
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
      
      const response = await fetch(`${integrationUrl}/api/sync/full`, {
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
        console.log(`  🆕 Создано: ${result.summary.created}`)
        console.log(`  🔄 Обновлено: ${result.summary.updated}`)
        console.log(`  ✅ Без изменений: ${result.summary.unchanged}`)
        console.log(`  ❌ Ошибки: ${result.summary.errors}`)
        console.log(`  ⚠️ Предупреждения: ${result.summary.warnings}`)
        console.log(`  🎯 Всего операций: ${result.summary.total_operations}`)
        console.log(`  ⚡ Производительность: ${result.summary.performance} оп/сек`)
      }
      
      // Логируем критические ошибки
      if (result.issues && result.issues.critical_errors.length > 0) {
        console.warn('🚨 Критические ошибки:')
        result.issues.critical_errors.forEach((error, index) => {
          console.warn(`  ${index + 1}. ${error}`)
        })
      }
      
      // Логируем предупреждения
      if (result.issues && result.issues.warnings.length > 0) {
        console.warn('⚠️ Предупреждения:')
        result.issues.warnings.forEach((warning, index) => {
          console.warn(`  ${index + 1}. ${warning}`)
        })
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