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
    <div className="rounded-lg border bg-card p-8 flex flex-col items-center justify-center gap-4">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">
        Анализ данных...
      </p>
    </div>
  )
}
