/**
 * Widget для отображения ошибок
 *
 * @module modules/ai-dashboard/components/widgets/ErrorWidget
 */

'use client'

import { AlertCircle } from 'lucide-react'

interface ErrorWidgetProps {
  message: string
}

/**
 * Компонент для отображения ошибок
 */
export function ErrorWidget({ message }: ErrorWidgetProps) {
  return (
    <div className="bg-red-50 dark:bg-red-950/20
                    border border-red-200 dark:border-red-800/50
                    rounded-lg p-4 shadow-sm
                    flex items-start gap-3">
      <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
      <div>
        <h3 className="font-semibold text-red-900 dark:text-red-200">
          Ошибка
        </h3>
        <p className="text-sm text-red-700 dark:text-red-300 mt-1">
          {message}
        </p>
      </div>
    </div>
  )
}
