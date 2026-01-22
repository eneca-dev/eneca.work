/**
 * Widget для отображения табличных данных
 *
 * @module modules/ai-dashboard/components/widgets/TableWidget
 */

'use client'

interface TableWidgetProps {
  columns: string[]
  rows: any[][]  // Массив массивов: [[val1, val2], [val3, val4], ...]
}

/**
 * Компонент для рендеринга таблицы
 */
export function TableWidget({ columns, rows }: TableWidgetProps) {
  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              {columns.map((col) => (
                <th
                  key={col}
                  className="px-4 py-3 text-left font-semibold"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr
                key={idx}
                className="border-b last:border-0 hover:bg-muted/50 transition-colors"
              >
                {row.map((cell, cellIdx) => (
                  <td
                    key={cellIdx}
                    className="px-4 py-3"
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rows.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          Нет данных для отображения
        </div>
      )}
    </div>
  )
}
