"use client"

import { useRoadmap } from "../../context/roadmap-context"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { formatDate } from "@/lib/date-utils"
import type { Section } from "@/types/project-types"
import { mockPlanData } from "@/data/mock-plan-data"
import { useMemo } from "react"
import { useTheme } from "next-themes"

interface SectionDifferenceChartProps {
  section: Section
}

export function SectionDifferenceChart({ section }: SectionDifferenceChartProps) {
  const { workingDays, sectionAggregates, CELL_WIDTH, visibleCategories } = useRoadmap()

  // Перемещаем хук useTheme на верхний уровень компонента
  const { resolvedTheme } = useTheme()
  const isDarkTheme = resolvedTheme === "dark"

  // Pre-calculate all values for better performance
  // Обновим функцию расчета значений
  const calculatedValues = useMemo(() => {
    // Create lookup maps for faster access
    const planValues: Record<string, number> = {}
    const factValues: Record<string, number> = {}
    const differences: Record<string, number> = {}

    // Filter plan data for this section once
    const sectionPlans = mockPlanData.filter((plan) => plan.sectionId === section.id)

    // Calculate all values for each day
    workingDays.forEach((day) => {
      const dateKey = formatDate(day)

      // Initialize values
      planValues[dateKey] = 0

      // Calculate plan values
      sectionPlans.forEach((plan) => {
        if (day >= plan.startDate && day <= plan.endDate) {
          planValues[dateKey] += plan.rate
        }
      })

      // Get fact values
      const aggregates = sectionAggregates[section.id]?.[dateKey] || { total: 0 }
      factValues[dateKey] = aggregates.total

      // Calculate differences
      differences[dateKey] = factValues[dateKey] - planValues[dateKey]
    })

    return { planValues, factValues, differences }
  }, [workingDays, section.id, sectionAggregates])

  // Get max absolute difference for scaling
  const maxDifference = useMemo(() => {
    let maxDiff = 0.1 // Minimum to avoid division by zero

    workingDays.forEach((day) => {
      const dateKey = formatDate(day)
      const diff = Math.abs(calculatedValues.differences[dateKey] || 0)

      maxDiff = Math.max(maxDiff, diff)
    })

    return maxDiff
  }, [calculatedValues.differences, workingDays])

  // Get category colors
  const getCategoryColor = (category: "K" | "BC" | "GC") => {
    switch (category) {
      case "K":
        return "#97C5A3"
      case "BC":
        return "#89A9C9"
      case "GC":
        return "#D6AF87"
      default:
        return "#cccccc"
    }
  }

  // Generate rectangles for each category - новая логика с прямоугольниками вместо путей
  // Обновим функцию для генерации прямоугольников
  const rectangles = useMemo(() => {
    const generateRectangles = (isPositive: boolean) => {
      if (workingDays.length === 0) return []

      const centerY = 32 // Center of the chart (64px / 2)
      const maxHeight = 30 // Maximum height of the area (slightly less than half height)
      const rects: { x: number; y: number; width: number; height: number; diff: number }[] = []

      workingDays.forEach((day, index) => {
        const dateKey = formatDate(day)
        const diff = calculatedValues.differences[dateKey] || 0

        // Только включаем точки, соответствующие нашему фильтру положительных/отрицательных значений
        if ((isPositive && diff > 0) || (!isPositive && diff < 0)) {
          const normalizedDiff = Math.abs(diff) / maxDifference
          const height = normalizedDiff * maxHeight

          // Для положительных значений, прямоугольник растет вверх от центра
          // Для отрицательных значений, прямоугольник растет вниз от центра
          const y = isPositive ? centerY - height : centerY

          rects.push({
            x: index * CELL_WIDTH,
            y: isPositive ? y : centerY,
            width: CELL_WIDTH,
            height: height,
            diff: diff,
          })
        }
      })

      return rects
    }

    return {
      positive: generateRectangles(true),
      negative: generateRectangles(false),
    }
  }, [workingDays, calculatedValues.differences, maxDifference, CELL_WIDTH])

  // Create a unique pattern ID for this section
  const patternId = `negative-pattern-${section.id}`

  // Обновим JSX для отображения только общей разницы
  return (
    <div className="absolute inset-0">
      {/* Center line - сделана более заметной */}
      <div className="absolute left-0 right-0 border-t border-gray-200" style={{ top: "50%" }}></div>

      <svg width={`${workingDays.length * CELL_WIDTH}px`} height="100%" preserveAspectRatio="none">
        {/* Вертикальная разметка */}
        {workingDays.map((day, index) => (
          <line
            key={`grid-${index}`}
            x1={index * CELL_WIDTH}
            y1="0"
            x2={index * CELL_WIDTH}
            y2="100%"
            stroke={isDarkTheme ? "rgba(51, 65, 85, 0.3)" : "rgba(226, 232, 240, 0.7)"}
            strokeWidth="1"
          />
        ))}

        {/* Define the diagonal line pattern for negative areas */}
        <defs>
          <pattern id={patternId} patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="8" stroke="#ef4444" strokeWidth="2" />
          </pattern>
        </defs>

        {/* Positive rectangles (above center line) */}
        {rectangles.positive.map((rect, i) => (
          <rect
            key={`pos-${i}`}
            x={rect.x}
            y={rect.y}
            width={rect.width}
            height={rect.height}
            fill="#89A9C9"
            opacity={0.7}
          />
        ))}

        {/* Negative rectangles (below center line) */}
        {rectangles.negative.map((rect, i) => (
          <g key={`neg-${i}`}>
            {/* Pattern fill */}
            <rect
              x={rect.x}
              y={rect.y}
              width={rect.width}
              height={rect.height}
              fill={`url(#${patternId})`}
              stroke="#ef4444"
              strokeWidth={1}
              opacity={0.7}
            />
            {/* Solid fill under the pattern */}
            <rect x={rect.x} y={rect.y} width={rect.width} height={rect.height} fill="#89A9C9" opacity={0.3} />
          </g>
        ))}
      </svg>

      {/* Tooltips */}
      <div className="flex absolute inset-0">
        {workingDays.map((day, index) => {
          const dateKey = formatDate(day)

          const totalDiff = calculatedValues.differences[dateKey] || 0
          const planValue = calculatedValues.planValues[dateKey] || 0
          const factValue = calculatedValues.factValues[dateKey] || 0

          return (
            <TooltipProvider key={index}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className="h-full cursor-pointer"
                    style={{ width: `${CELL_WIDTH}px`, minWidth: `${CELL_WIDTH}px` }}
                  />
                </TooltipTrigger>
                <TooltipContent>
                  <div className="space-y-2">
                    <p className="font-semibold border-b pb-1">Difference (Fact - Plan)</p>
                    <p className={`font-medium ${totalDiff >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {totalDiff.toFixed(2)} ({factValue.toFixed(2)} / {planValue.toFixed(2)})
                    </p>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )
        })}
      </div>
    </div>
  )
}

