import { useState } from 'react'

interface SyncResult {
  success: boolean
  duration: string
  summary: {
    created: number
    updated: number
    errors: number
    total_operations: number
  }
  error?: string
}

interface UseSyncReturn {
  isSyncing: boolean
  syncStatus: 'idle' | 'success' | 'error'
  syncWithWorksection: () => Promise<SyncResult | null>
  resetStatus: () => void
}

export function useWorksectionSync(): UseSyncReturn {
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncStatus, setSyncStatus] = useState<'idle' | 'success' | 'error'>('idle')

  const syncWithWorksection = async (): Promise<SyncResult | null> => {
    if (isSyncing) return null
    
    setIsSyncing(true)
    setSyncStatus('idle')
    
    try {
      console.log('🚀 Запуск синхронизации с Worksection...')
      
      const response = await fetch('http://localhost:3001/api/sync/full', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const result: SyncResult = await response.json()
      
      if (result.success) {
        console.log('✅ Синхронизация завершена успешно:', result)
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
    resetStatus
  }
} 