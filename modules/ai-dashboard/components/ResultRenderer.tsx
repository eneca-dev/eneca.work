/**
 * Универсальный рендерер результатов AI анализа
 *
 * @module modules/ai-dashboard/components/ResultRenderer
 */

'use client'

import type { AnalyticsResult } from '../types'
import { TextWidget } from './widgets/TextWidget'
import { TableWidget } from './widgets/TableWidget'
import { ChartWidget } from './widgets/ChartWidget'
import { DataViewToggle } from './widgets/DataViewToggle'
import { ErrorWidget } from './widgets/ErrorWidget'
import { convertTableToChart } from '../utils/dataConverter'

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

      {response.type === 'table' && (() => {
        const chartData = convertTableToChart(response.content.columns, response.content.rows)

        // Если данные можно визуализировать - показываем переключатель
        if (chartData) {
          return (
            <DataViewToggle
              tableColumns={response.content.columns}
              tableRows={response.content.rows}
              chartType={chartData.chartType}
              chartData={chartData.data}
              xKey={chartData.xKey}
              yKeys={chartData.yKeys}
            />
          )
        }

        // Иначе только таблица
        return <TableWidget columns={response.content.columns} rows={response.content.rows} />
      })()}

      {response.type === 'mixed' && (
        <>
          <TextWidget content={response.summary} />
          {response.data.type === 'table' && (() => {
            const chartData = convertTableToChart(response.data.content.columns, response.data.content.rows)

            // Если данные можно визуализировать - показываем переключатель
            if (chartData) {
              return (
                <DataViewToggle
                  tableColumns={response.data.content.columns}
                  tableRows={response.data.content.rows}
                  chartType={chartData.chartType}
                  chartData={chartData.data}
                  xKey={chartData.xKey}
                  yKeys={chartData.yKeys}
                />
              )
            }

            // Иначе только таблица
            return <TableWidget columns={response.data.content.columns} rows={response.data.content.rows} />
          })()}
          {response.data.type === 'chart' && (() => {
            // Конвертируем данные графика в табличный формат для переключателя
            const { data, xKey, yKeys } = response.data.content
            const tableColumns = [xKey, ...yKeys]
            const tableRows = data.map(item => [
              item[xKey],
              ...yKeys.map(key => item[key])
            ])

            return (
              <DataViewToggle
                tableColumns={tableColumns}
                tableRows={tableRows}
                chartType={response.data.content.chartType}
                chartData={response.data.content.data}
                xKey={response.data.content.xKey}
                yKeys={response.data.content.yKeys}
                title={response.data.content.title}
              />
            )
          })()}
        </>
      )}

      {response.type === 'chart' && (() => {
        // Конвертируем данные графика в табличный формат для переключателя
        const { data, xKey, yKeys } = response.content
        const tableColumns = [xKey, ...yKeys]
        const tableRows = data.map(item => [
          item[xKey],
          ...yKeys.map(key => item[key])
        ])

        return (
          <DataViewToggle
            tableColumns={tableColumns}
            tableRows={tableRows}
            chartType={response.content.chartType}
            chartData={response.content.data}
            xKey={response.content.xKey}
            yKeys={response.content.yKeys}
            title={response.content.title}
          />
        )
      })()}
    </div>
  )
}
