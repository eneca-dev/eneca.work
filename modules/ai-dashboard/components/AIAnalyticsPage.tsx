/**
 * Главная страница AI Dashboard
 *
 * @module modules/ai-dashboard/components/AIAnalyticsPage
 */

'use client'

import { Sparkles } from 'lucide-react'
import { useAIAnalytics } from '../hooks/useAIAnalytics'
import { InputSection } from './InputSection'
import { ResultRenderer } from './ResultRenderer'
import { LoadingState } from './LoadingState'

/**
 * Главный компонент страницы AI Dashboard
 */
export function AIAnalyticsPage() {
  const { isLoading, error, result, runAnalysis, reset } = useAIAnalytics()

  return (
    <div className="container mx-auto max-w-5xl p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Sparkles className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              AI Dashboard
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Аналитика данных с использованием искусственного интеллекта
            </p>
          </div>
        </div>

        {result && (
          <button
            onClick={reset}
            className="text-sm text-primary hover:text-primary/80
                       transition-colors"
          >
            Новый запрос
          </button>
        )}
      </div>

      {/* Input Section */}
      <InputSection onSubmit={runAnalysis} isLoading={isLoading} />

      {/* Results Section */}
      {isLoading ? (
        <LoadingState />
      ) : (
        <ResultRenderer result={result} error={error} />
      )}
    </div>
  )
}
