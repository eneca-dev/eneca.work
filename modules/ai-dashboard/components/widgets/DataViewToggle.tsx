/**
 * Компонент для отображения данных с переключением между таблицей и графиком
 *
 * @module modules/ai-dashboard/components/widgets/DataViewToggle
 */

'use client'

import { useState } from 'react'
import { Table2, BarChart3 } from 'lucide-react'
import { TableWidget } from './TableWidget'
import { ChartWidget } from './ChartWidget'
import type { AIChartResponse } from '../../types'

interface DataViewToggleProps {
  // Данные для таблицы
  tableColumns: string[]
  tableRows: any[][]

  // Данные для графика
  chartType: AIChartResponse['content']['chartType']
  chartData: AIChartResponse['content']['data']
  xKey: AIChartResponse['content']['xKey']
  yKeys: AIChartResponse['content']['yKeys']
  title?: string
}

type ViewMode = 'table' | 'chart'

/**
 * Компонент с переключателем между таблицей и графиком
 */
export function DataViewToggle({
  tableColumns,
  tableRows,
  chartType,
  chartData,
  xKey,
  yKeys,
  title
}: DataViewToggleProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('chart')

  return (
    <div className="space-y-3">
      {/* Переключатель вида */}
      <div className="flex justify-end">
        <div className="flex rounded-lg border bg-muted/50 p-1">
          <button
            onClick={() => setViewMode('chart')}
            className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors ${
              viewMode === 'chart'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            title="Показать график"
          >
            <BarChart3 className="h-4 w-4" />
            График
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors ${
              viewMode === 'table'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            title="Показать таблицу"
          >
            <Table2 className="h-4 w-4" />
            Таблица
          </button>
        </div>
      </div>

      {/* Отображение данных */}
      {viewMode === 'chart' ? (
        <ChartWidget
          chartType={chartType}
          data={chartData}
          xKey={xKey}
          yKeys={yKeys}
          title={title}
        />
      ) : (
        <TableWidget columns={tableColumns} rows={tableRows} />
      )}
    </div>
  )
}
