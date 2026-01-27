/**
 * Widget для отображения графиков
 *
 * @module modules/ai-dashboard/components/widgets/ChartWidget
 */

'use client'

import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  RadarChart,
  Radar,
  RadialBarChart,
  RadialBar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import type { AIChartResponse } from '../../types'

interface ChartWidgetProps {
  chartType: AIChartResponse['content']['chartType']
  data: AIChartResponse['content']['data']
  xKey: AIChartResponse['content']['xKey']
  yKeys: AIChartResponse['content']['yKeys']
  title?: string
}

// Цветовая палитра для графиков
const COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
]

// Маппинг числовых значений статусов в текст
const STATUS_MAP: Record<number, string> = {
  50: 'В работе',
  100: 'Завершён',
}

/**
 * Получить текст статуса по числовому значению
 */
const getStatusLabel = (value: number): string => {
  return STATUS_MAP[value] || `${value}%`
}

/**
 * Форматтер для дат на оси Y
 */
const formatYAxisDate = (timestamp: number) => {
  const date = new Date(timestamp)
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

/**
 * Форматтер для tooltip с датами
 */
const formatTooltipDate = (timestamp: number) => {
  const date = new Date(timestamp)
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' })
}

/**
 * Проверяет, содержит ли данные даты (timestamp > 1000000000000 = после 2001 года)
 */
const hasDateData = (data: Record<string, any>[], yKeys: string[]) => {
  return data.some(item =>
    yKeys.some(key => {
      const val = item[key]
      return typeof val === 'number' && val > 1000000000000
    })
  )
}

/**
 * Компонент для рендеринга графиков
 */
export function ChartWidget({ chartType, data, xKey, yKeys, title }: ChartWidgetProps) {
  if (!data || data.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center">
        <p className="text-sm text-muted-foreground">Нет данных для отображения</p>
      </div>
    )
  }

  // Проверяем, есть ли даты в данных
  const containsDates = hasDateData(data, yKeys)

  const renderChart = () => {
    switch (chartType) {
      case 'line':
        return (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey={xKey} className="text-xs" />
            <YAxis
              className="text-xs"
              tickFormatter={containsDates ? formatYAxisDate : undefined}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '0.5rem',
              }}
              formatter={(value: any, name: string) => {
                if (typeof value === 'number' && value > 1000000000000) {
                  return [formatTooltipDate(value), name]
                }
                return [value, name]
              }}
            />
            <Legend />
            {yKeys.map((key, index) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={COLORS[index % COLORS.length]}
                strokeWidth={2}
              />
            ))}
          </LineChart>
        )

      case 'bar':
        return (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey={xKey} className="text-xs" angle={-45} textAnchor="end" height={80} />
            <YAxis className="text-xs" />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '0.5rem',
              }}
            />
            <Legend />
            {yKeys.map((key, index) => (
              <Bar key={key} dataKey={key} fill={COLORS[index % COLORS.length]} />
            ))}
          </BarChart>
        )

      case 'area':
        return (
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey={xKey} className="text-xs" />
            <YAxis className="text-xs" />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '0.5rem',
              }}
            />
            <Legend />
            {yKeys.map((key, index) => (
              <Area
                key={key}
                type="monotone"
                dataKey={key}
                stroke={COLORS[index % COLORS.length]}
                fill={COLORS[index % COLORS.length]}
                fillOpacity={0.6}
              />
            ))}
          </AreaChart>
        )

      case 'pie':
        // Для Pie chart используем первый yKey
        const pieData = data.map((item) => ({
          name: item[xKey],
          value: item[yKeys[0]],
        }))

        return (
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
              outerRadius={120}
              fill="#8884d8"
              dataKey="value"
            >
              {pieData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '0.5rem',
              }}
            />
          </PieChart>
        )

      case 'radar':
        // Лепестковая диаграмма для многомерного сравнения
        return (
          <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
            <PolarGrid className="stroke-muted" />
            <PolarAngleAxis dataKey={xKey} className="text-xs" />
            <PolarRadiusAxis className="text-xs" />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '0.5rem',
              }}
            />
            <Legend />
            {yKeys.map((key, index) => (
              <Radar
                key={key}
                name={key}
                dataKey={key}
                stroke={COLORS[index % COLORS.length]}
                fill={COLORS[index % COLORS.length]}
                fillOpacity={0.3}
              />
            ))}
          </RadarChart>
        )

      case 'radialBar':
        // Радиальный бар для статусов проектов
        const radialData = data.map((item, index) => ({
          name: item[xKey],
          value: item[yKeys[0]],
          fill: COLORS[index % COLORS.length],
          statusLabel: getStatusLabel(item[yKeys[0]]),
          displayNumber: index + 1, // Номер для отображения (начиная с 1)
        }))

        return (
          <RadialBarChart
            cx="35%"
            cy="50%"
            innerRadius="15%"
            outerRadius="80%"
            barSize={20}
            data={radialData}
            startAngle={180}
            endAngle={0}
          >
            <RadialBar
              background
              dataKey="value"
              label={{
                position: 'insideStart',
                fill: '#fff',
                fontSize: 11,
                fontWeight: 'bold',
                formatter: (value: number) => `${value}%`,
              }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '0.5rem',
                color: 'hsl(var(--card-foreground))',
              }}
              labelStyle={{
                color: 'hsl(var(--card-foreground))',
              }}
              itemStyle={{
                color: 'hsl(var(--card-foreground))',
              }}
              labelFormatter={() => ''}
              formatter={(value: number, _: string, props: any) => [
                `${props.payload.displayNumber}. ${props.payload.name}: ${value}% (${getStatusLabel(value)})`,
                null
              ]}
            />
            <Legend
              iconSize={12}
              layout="vertical"
              verticalAlign="middle"
              align="right"
              wrapperStyle={{ paddingLeft: '30px', fontSize: '13px' }}
              payload={radialData.map((item, idx) => ({
                value: `${idx + 1}. ${item.name} — ${item.statusLabel}`,
                type: 'circle',
                color: item.fill,
              }))}
            />
          </RadialBarChart>
        )

      default:
        return <p className="text-sm text-muted-foreground">Неподдерживаемый тип графика: {chartType}</p>
    }
  }

  return (
    <div className="rounded-lg border bg-card p-4">
      {title && <h3 className="text-lg font-semibold mb-4">{title}</h3>}
      <ResponsiveContainer width="100%" height={400}>
        {renderChart()}
      </ResponsiveContainer>
    </div>
  )
}
