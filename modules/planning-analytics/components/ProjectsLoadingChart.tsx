"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from "recharts"
import type { ProjectLoading, DepartmentOption } from "../services/planningAnalyticsService"
import { useState } from "react"

interface ProjectsLoadingChartProps {
  projects: ProjectLoading[]
  isLoading: boolean
  title?: string
  description?: string
  chartHeight?: number
  selectedDepartmentIds?: string[]
  departmentOptions?: DepartmentOption[]
}

// Цвет для всех столбцов - темно-зелёный
const BAR_COLOR = "rgb(7 125 92)" 

// Функция для разделения текста на две строки
function splitTextIntoLines(text: string, maxCharsPerLine: number = 18): [string, string?] {
  if (!text || text.length === 0) {
    return [""]
  }

  // Если текст короткий, возвращаем одну строку
  if (text.length <= maxCharsPerLine) {
    return [text]
  }

  // Ищем последний пробел в пределах maxCharsPerLine
  const firstPart = text.substring(0, maxCharsPerLine)
  const lastSpaceIndex = firstPart.lastIndexOf(' ')

  if (lastSpaceIndex > 5) { // Минимум 5 символов в первой строке
    // Нашли пробел - делим там
    const line1 = text.substring(0, lastSpaceIndex).trim()
    let line2 = text.substring(lastSpaceIndex + 1).trim()

    // Обрезаем вторую строку если ОЧЕНЬ длинная (увеличили лимит)
    if (line2.length > maxCharsPerLine + 20) {
      line2 = line2.substring(0, maxCharsPerLine + 18) + '...'
    }

    return line1 && line2 ? [line1, line2] : [text]
  } else {
    // Нет пробела близко к началу - ищем любой пробел
    const anySpaceIndex = text.indexOf(' ', 5)

    if (anySpaceIndex > 0 && anySpaceIndex < maxCharsPerLine + 10) {
      const line1 = text.substring(0, anySpaceIndex).trim()
      let line2 = text.substring(anySpaceIndex + 1).trim()

      if (line2.length > maxCharsPerLine + 20) {
        line2 = line2.substring(0, maxCharsPerLine + 18) + '...'
      }

      return line1 && line2 ? [line1, line2] : [text]
    }

    // Совсем нет пробелов - показываем как есть
    return [text]
  }
}

// Кастомный компонент для тиков оси Y с выделением только на названиях проектов
const CustomYAxisTick = ({ x, y, payload, activeIndex }: any) => {
  const isActive = payload.index === activeIndex

  // Разделяем текст на две строки
  const [line1, line2] = splitTextIntoLines(payload.value)

  return (
    <g transform={`translate(${x},${y})`}>
      {/* Фон выделения только для области текста */}
      {isActive && (
        <rect
          x={-162}
          y={-17}
          width={158}
          height={35}
          rx={4}
          ry={4}
          fill="rgb(229, 231, 235)"
          className="transition-colors duration-200 dark:fill-gray-600"
        />
      )}
      {/* Первая строка */}
      <text
        x={-5}
        y={line2 ? -8 : 0}
        dy={6}
        textAnchor="end"
        fontSize={10}
        className="fill-gray-600 dark:fill-gray-400"
      >
        {line1}
      </text>
      {/* Вторая строка (если есть) */}
      {line2 && (
        <text
          x={-5}
          y={5}
          dy={4}
          textAnchor="end"
          fontSize={10}
          className="fill-gray-600 dark:fill-gray-400"
        >
          {line2}
        </text>
      )}
    </g>
  )
}

// Кастомный компонент для меток с цифрами в кружочках
const CustomBarLabel = (props: any) => {
  const { x, y, width, height, value } = props

  // Радиус кружочка (увеличен в 0.5 раза от исходного)
  const radius = 10.5

  // Позиция кружочка: правый верхний угол столбика
  const cx = x + width - radius - 5
  const cy = y + height / 2

  return (
    <g>
      {/* Прозрачный кружочек с темно-зеленой обводкой */}
      <circle
        cx={cx}
        cy={cy}
        r={radius}
        fill="transparent"
        stroke="rgb(7 125 92)" // green-800 (темно-зеленый)
        strokeWidth={2}
        className="transition-colors duration-200"
      />
      {/* Цифра внутри кружочка */}
      <text
        x={cx}
        y={cy}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={10}
        fontWeight="600"
        className="fill-gray-700 dark:fill-gray-300"
      >
        {value}
      </text>
    </g>
  )
}

export function ProjectsLoadingChart({
  projects,
  isLoading,
  title = "Распределение ресурсов по проектам (топ-10)",
  description,
  chartHeight = 400,
  selectedDepartmentIds = [],
  departmentOptions = []
}: ProjectsLoadingChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  // Получаем названия выбранных отделов для отображения в виде меток
  const selectedDepartmentNames = selectedDepartmentIds
    .filter(id => id !== "all")
    .map(id => departmentOptions.find(opt => opt.id === id)?.name)
    .filter(Boolean) as string[]

  // Проверяем, выбрано ли "Общее"
  const isAllSelected = selectedDepartmentIds.includes("all") && selectedDepartmentIds.length === 1

  if (isLoading) {
    return (
      <Card className="rounded-sm dark:bg-[rgb(15_23_42)]">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">
            <div className="h-6 bg-gray-200 dark:bg-[rgb(15_23_42)] rounded animate-pulse w-3/4" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-gray-200 dark:bg-[rgb(15_23_42)] rounded animate-pulse" style={{ height: `${chartHeight}px` }} />
        </CardContent>
      </Card>
    )
  }
  if (!projects || projects.length === 0) {
    return (
      <Card className="rounded-sm dark:bg-[rgb(15_23_42)]">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`flex items-center justify-center text-muted-foreground`} style={{ height: `${chartHeight}px` }}>
            Нет данных для отображения
          </div>
        </CardContent>
      </Card>
    )
  }

  // Форматируем данные для диаграммы и сортируем по количеству загрузок
  const chartData = projects
    .map((project) => ({
      name: project.project_name, // Теперь не обрезаем, разделение на строки в CustomYAxisTick
      fullName: project.project_name,
      projectId: project.project_id,
      value: project.total_loadings_count, // Отображаем количество загрузок
      count: project.total_loadings_count,
      loadingRate: Number(project.total_loading_rate),
    }))
    .sort((a, b) => b.count - a.count) // Сортировка по убыванию количества загрузок

  return (
    <Card className="rounded-sm dark:bg-[rgb(15_23_42)]">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-foreground dark:text-white">
          {title}
        </CardTitle>
        {description && (
          <p className="text-sm text-muted-foreground mt-1">
            {description}
          </p>
        )}
        {/* Отображение меток выбранных отделов */}
        {!isAllSelected && selectedDepartmentNames.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {selectedDepartmentNames.map((name, index) => (
              <Badge
                key={index}
                variant="secondary"
                className="text-xs px-2.5 py-0.5"
              >
                {name}
              </Badge>
            ))}
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div>
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 5, right: 40, left: 10, bottom: 30 }}
              onMouseMove={(state: any) => {
                if (state.isTooltipActive) {
                  const index = state.activeTooltipIndex
                  setActiveIndex(index)
                } else {
                  setActiveIndex(null)
                }
              }}
              onMouseLeave={() => {
                setActiveIndex(null)
              }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                className="stroke-gray-200 dark:stroke-gray-700"
              />
            <XAxis
              type="number"
              className="text-xs fill-gray-600 dark:fill-gray-400"
              label={{
                value: 'Количество загрузок',
                position: 'insideBottom',
                offset: -10,
                className: "fill-gray-600 dark:fill-gray-400"
              }}
            />
            <YAxis
              dataKey="name"
              type="category"
              width={160}
              interval={0}
              tick={(props) => (
                <CustomYAxisTick
                  {...props}
                  activeIndex={activeIndex}
                />
              )}
            />
            <Tooltip
              cursor={false}
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload
                  return (
                    <div className="bg-white dark:bg-[rgb(15_23_42)] border border-gray-200 dark:border-gray-700 rounded-sm shadow-lg p-3">
                      <p className="font-semibold text-sm text-foreground dark:text-white mb-1">
                        {data.fullName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Количество загрузок: <span className="font-bold text-sky-500">{data.count}</span>
                      </p>
                    </div>
                  )
                }
                return null
              }}
            />
            <Bar
              dataKey="value"
              radius={[0, 4, 4, 0]}
              fill={BAR_COLOR}
              activeBar={{ fill: BAR_COLOR }}
            >
              <LabelList
                dataKey="value"
                content={<CustomBarLabel />}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
