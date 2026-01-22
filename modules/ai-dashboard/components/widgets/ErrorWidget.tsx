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
    <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 flex items-start gap-3">
      <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
      <div>
        <h3 className="font-semibold text-destructive">
          Ошибка
        </h3>
        <p className="text-sm text-destructive/80 mt-1">
          {message}
        </p>
      </div>
    </div>
  )
}
