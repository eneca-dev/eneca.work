/**
 * Компонент состояния загрузки
 *
 * @module modules/ai-dashboard/components/LoadingState
 */

'use client'

import { Loader2 } from 'lucide-react'

/**
 * Компонент для отображения состояния загрузки
 */
export function LoadingState() {
  return (
    <div className="bg-white dark:bg-slate-900/95
                    border border-gray-200 dark:border-slate-700/50
                    rounded-lg p-8 shadow-sm
                    flex flex-col items-center justify-center gap-4">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Анализ данных...
      </p>
    </div>
  )
}
