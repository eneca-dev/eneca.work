import React from 'react'
import { Loader2, Check, X, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SaveIndicatorProps {
  status: 'idle' | 'saving' | 'saved' | 'error'
  className?: string
}

export function SaveIndicator({ status, className }: SaveIndicatorProps) {
  const getStatusConfig = () => {
    switch (status) {
      case 'saving':
        return {
          icon: <Loader2 className="h-3 w-3 animate-spin" />,
          text: 'Сохранение...',
          className: 'text-blue-600 bg-blue-50'
        }
      case 'saved':
        return {
          icon: <Check className="h-3 w-3" />,
          text: 'Сохранено',
          className: 'text-green-600 bg-green-50'
        }
      case 'error':
        return {
          icon: <X className="h-3 w-3" />,
          text: 'Ошибка сохранения',
          className: 'text-red-600 bg-red-50'
        }
      case 'idle':
      default:
        return {
          icon: <Clock className="h-3 w-3" />,
          text: 'Изменения сохранятся автоматически',
          className: 'text-gray-500 bg-gray-50'
        }
    }
  }

  const config = getStatusConfig()

  // Не показываем в idle состоянии, если нет активности
  if (status === 'idle') {
    return null
  }

  return (
    <div 
      className={cn(
        'flex items-center gap-2 px-2 py-1 rounded-full text-xs font-medium transition-all duration-200',
        config.className,
        className
      )}
    >
      {config.icon}
      <span>{config.text}</span>
    </div>
  )
} 