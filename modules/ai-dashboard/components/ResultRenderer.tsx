/**
 * Универсальный рендерер результатов AI анализа
 *
 * @module modules/ai-dashboard/components/ResultRenderer
 */

'use client'

import type { AnalyticsResult } from '../types'
import { TextWidget } from './widgets/TextWidget'
import { TableWidget } from './widgets/TableWidget'
import { ErrorWidget } from './widgets/ErrorWidget'

interface ResultRendererProps {
  result: AnalyticsResult | null
  error: string | null
}

/**
 * Компонент для рендеринга результатов AI анализа
 */
export function ResultRenderer({ result, error }: ResultRendererProps) {
  // Отображение ошибки
  if (error) {
    return <ErrorWidget message={error} />
  }

  // Пустое состояние
  if (!result) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center">
        <p className="text-sm text-muted-foreground">
          Введите запрос и нажмите "Запустить анализ"
        </p>
      </div>
    )
  }

  const { response, query, executionTime } = result

  return (
    <div className="space-y-4">
      {/* Мета-информация */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="font-medium">Запрос: {query}</span>
        {executionTime && (
          <span>Выполнено за {(executionTime / 1000).toFixed(2)}с</span>
        )}
      </div>

      {/* Рендер по типу ответа */}
      {response.type === 'text' && <TextWidget content={response.content} />}

      {response.type === 'table' && (
        <TableWidget columns={response.content.columns} rows={response.content.rows} />
      )}

      {response.type === 'mixed' && (
        <>
          <TextWidget content={response.summary} />
          {response.data.type === 'table' && (
            <TableWidget columns={response.data.content.columns} rows={response.data.content.rows} />
          )}
          {response.data.type === 'chart' && (
            <div className="rounded-lg border bg-card p-4">
              <p className="text-sm text-muted-foreground">
                📊 Графики будут реализованы в следующей версии
              </p>
            </div>
          )}
        </>
      )}

      {response.type === 'chart' && (
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">
            📊 Графики будут реализованы в следующей версии
          </p>
        </div>
      )}
    </div>
  )
}
