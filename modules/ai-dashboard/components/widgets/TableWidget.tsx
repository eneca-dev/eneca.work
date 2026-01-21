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
    <div className="bg-white dark:bg-slate-900/95
                    border border-gray-200 dark:border-slate-700/50
                    rounded-lg p-4 shadow-sm overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b-2 border-slate-200 dark:border-slate-700">
            {columns.map((col) => (
              <th
                key={col}
                className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50"
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
              className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
            >
              {row.map((cell, cellIdx) => (
                <td
                  key={cellIdx}
                  className="px-4 py-3 text-slate-900 dark:text-slate-100"
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {rows.length === 0 && (
        <div className="text-center py-8 text-slate-500 dark:text-slate-400">
          Нет данных для отображения
        </div>
      )}
    </div>
  )
}
