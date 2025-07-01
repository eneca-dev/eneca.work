import React from 'react'
import { RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useWorksectionSync } from '@/hooks/useWorksectionSync'

interface SyncButtonProps {
  className?: string
  size?: 'sm' | 'md' | 'lg'
  variant?: 'default' | 'outline' | 'ghost'
  showText?: boolean
  onSyncComplete?: () => void
  theme?: 'light' | 'dark'
}

export function SyncButton({ 
  className,
  size = 'md',
  variant = 'default',
  showText = true,
  onSyncComplete,
  theme = 'light'
}: SyncButtonProps) {
  const { isSyncing, syncStatus, syncWithWorksection } = useWorksectionSync()

  const handleSync = async () => {
    try {
      const result = await syncWithWorksection()
      
      if (result) {
        // Показываем уведомление об успехе
        if (window.confirm(`✅ Синхронизация завершена успешно!\n\n📊 Статистика:\n• Создано: ${result.summary.created}\n• Обновлено: ${result.summary.updated}\n• Ошибок: ${result.summary.errors}\n• Время: ${result.duration} сек\n\nОбновить страницу для отображения новых данных?`)) {
          window.location.reload()
        }
        
        // Вызываем колбэк если передан
        onSyncComplete?.()
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка'
      alert(`❌ Ошибка синхронизации с Worksection:\n\n${errorMessage}\n\nПроверьте:\n• Доступность сервера интеграции\n• Правильность настроек API Worksection\n• Подключение к интернету`)
    }
  }

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-xs',
    lg: 'px-4 py-2 text-sm'
  }

  const iconSizes = {
    sm: 12,
    md: 14,
    lg: 16
  }

  const getVariantClasses = () => {
    const baseClasses = "flex items-center gap-1 rounded-md font-medium transition-all duration-200 disabled:cursor-not-allowed"
    
    if (syncStatus === 'success' && !isSyncing) {
      return `${baseClasses} bg-green-100 text-green-700 border border-green-200`
    }
    
    if (syncStatus === 'error' && !isSyncing) {
      return `${baseClasses} bg-red-100 text-red-700 border border-red-200`
    }
    
    if (isSyncing) {
      return `${baseClasses} ${
        theme === 'dark'
          ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
          : "bg-blue-25 text-blue-500 border border-blue-100"
      }`
    }
    
    // Обычное состояние
    switch (variant) {
      case 'outline':
        return `${baseClasses} border ${
          theme === 'dark'
            ? "border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
            : "border-blue-200 text-blue-600 hover:bg-blue-50"
        }`
      case 'ghost':
        return `${baseClasses} ${
          theme === 'dark'
            ? "text-blue-400 hover:bg-blue-500/10"
            : "text-blue-600 hover:bg-blue-50"
        }`
      default:
        return `${baseClasses} ${
          theme === 'dark'
            ? "bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border border-blue-500/30"
            : "bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200"
        }`
    }
  }

  return (
    <button
      onClick={handleSync}
      disabled={isSyncing}
      title="Синхронизировать данные с Worksection"
      className={cn(
        getVariantClasses(),
        sizeClasses[size],
        className
      )}
    >
      <RefreshCw 
        size={iconSizes[size]} 
        className={cn(
          isSyncing && "animate-spin"
        )} 
      />
      {showText && (
        isSyncing ? 'Синхронизация...' : 'Синхронизировать с Worksection'
      )}
    </button>
  )
} 