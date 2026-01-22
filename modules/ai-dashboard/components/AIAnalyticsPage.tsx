/**
 * Главная страница AI Dashboard
 *
 * @module modules/ai-dashboard/components/AIAnalyticsPage
 */

'use client'

import { Sparkles, RefreshCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
    <div className="min-h-screen bg-background space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">AI Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Аналитика данных с использованием искусственного интеллекта
            </p>
          </div>
        </div>

        {result && (
          <Button onClick={reset} variant="outline" size="sm" className="gap-2">
            <RefreshCcw className="h-4 w-4" />
            Новый запрос
          </Button>
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
