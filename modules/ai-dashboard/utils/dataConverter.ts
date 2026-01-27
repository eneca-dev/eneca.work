/**
 * Утилиты для конвертации данных между форматами
 *
 * @module modules/ai-dashboard/utils/dataConverter
 */

import type { AIChartResponse } from '../types'

/**
 * Конвертирует табличные данные в формат для графика
 *
 * @param columns - Заголовки столбцов
 * @param rows - Строки данных (массив массивов)
 * @returns Объект с данными для ChartWidget или null если конвертация невозможна
 */
export function convertTableToChart(
  columns: string[],
  rows: any[][]
): {
  chartType: AIChartResponse['content']['chartType']
  data: AIChartResponse['content']['data']
  xKey: string
  yKeys: string[]
} | null {
  if (columns.length < 2 || rows.length === 0) {
    return null
  }

  // Определяем, есть ли даты для визуализации (группировка по датам)
  const hasDateData = rows.some((row) =>
    row.slice(1).some((cell) => {
      if (cell == null) return false
      const strVal = String(cell)
      // Даты в ISO формате (2025-05-10T12:35:53...)
      return /\d{4}-\d{2}-\d{2}(T|$)/.test(strVal)
    })
  )

  // Если нет дат - не показываем график (нечего группировать)
  if (!hasDateData) {
    return null
  }

  // Первый столбец - ось X (названия проектов)
  const xKey = 'label'

  // Определяем, какие колонки использовать для Y (числа и даты)
  const yKeys: string[] = []
  const columnTypes: ('number' | 'date')[] = []
  const columnIndices: number[] = []

  columns.slice(1).forEach((col, index) => {
    const colIndex = index + 1

    // Проверяем первую непустую ячейку колонки для определения типа
    const sampleValue = rows.find(row => row[colIndex] != null)?.[colIndex]
    if (!sampleValue) return

    const strVal = String(sampleValue)

    // Проверяем, это дата? (ISO формат, обычный формат, и т.д.)
    const isDate = /\d{4}-\d{2}-\d{2}(T|\s|\d{2}\.\d{2}\.\d{4})/.test(strVal)

    if (isDate) {
      // Это колонка с датами
      yKeys.push(col)
      columnTypes.push('date')
      columnIndices.push(colIndex)
    } else if (typeof sampleValue === 'number' || !isNaN(Number(sampleValue))) {
      // Это числовая колонка
      yKeys.push(col)
      columnTypes.push('number')
      columnIndices.push(colIndex)
    }
  })

  // Конвертируем строки в объекты для Recharts
  const data = rows.map((row) => {
    const obj: Record<string, any> = {
      [xKey]: String(row[0]) // Первая колонка - названия проектов
    }

    // Добавляем все колонки (числа и даты)
    columnIndices.forEach((colIndex, idx) => {
      const value = row[colIndex]
      const type = columnTypes[idx]

      if (type === 'date') {
        // Конвертируем дату в timestamp (миллисекунды)
        const dateValue = new Date(String(value))
        obj[yKeys[idx]] = dateValue.getTime()
      } else {
        // Числовое значение
        obj[yKeys[idx]] = typeof value === 'number' ? value : parseFloat(value) || 0
      }
    })

    return obj
  })

  // Если есть колонка с датами, группируем данные по датам
  const dateColumnIndex = columnTypes.indexOf('date')

  if (dateColumnIndex !== -1 && data.length > 0) {
    // Преобразуем: даты становятся осью X, считаем количество по датам
    const dateKey = yKeys[dateColumnIndex]

    // Группируем по датам (по дням)
    const dateGroups = new Map<string, number>()

    data.forEach(item => {
      const timestamp = item[dateKey]
      const date = new Date(timestamp)
      const dateStr = date.toISOString().split('T')[0] // YYYY-MM-DD
      dateGroups.set(dateStr, (dateGroups.get(dateStr) || 0) + 1)
    })

    // Создаём новый массив данных
    const groupedData = Array.from(dateGroups.entries())
      .sort((a, b) => a[0].localeCompare(b[0])) // Сортируем по дате
      .map(([dateStr, count]) => ({
        [xKey]: dateStr,
        'Количество': count
      }))

    return {
      chartType: 'bar',
      data: groupedData,
      xKey: xKey,
      yKeys: ['Количество']
    }
  }

  // Выбираем тип графика на основе данных
  let chartType: AIChartResponse['content']['chartType'] = 'bar'

  // Если данных много (>15) - используем line chart
  if (rows.length > 15) {
    chartType = 'line'
  }
  // Если первая колонка содержит даты - используем line chart
  else if (rows.some(row => {
    const firstCol = String(row[0])
    return /\d{4}-\d{2}-\d{2}(T|\s|\d{2}\.\d{2}\.\d{4})|янв|фев|мар|апр|май|июн|июл|авг|сен|окт|ноя|дек/i.test(firstCol)
  })) {
    chartType = 'line'
  }

  return {
    chartType,
    data,
    xKey,
    yKeys
  }
}
