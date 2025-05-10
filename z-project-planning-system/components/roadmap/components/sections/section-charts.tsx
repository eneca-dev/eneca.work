"use client"

import { useRoadmap } from "../../context/roadmap-context"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { formatDate } from "@/lib/date-utils"
import type { Section } from "@/types/project-types"
import type { ChartType } from "@/types/project-types"
import { mockPlanData } from "@/data/mock-plan-data"
import { useMemo } from "react"

interface SectionChartsProps {
  section: Section
  type: ChartType
}

export function SectionCharts({ section, type }: SectionChartsProps) {
  const { workingDays, sectionAggregates, maxAggregates, CELL_WIDTH, isDarkTheme } = useRoadmap()

  // Use different colors for Plan and Fact
  const colorOpacity = type === "Plan" ? 0.7 : 0.8

  // Plan uses more blue-ish colors
  const kColor =
    type === "Plan" ? "rgba(181, 227, 193, " + colorOpacity + ")" : "rgba(151, 197, 163, " + colorOpacity + ")"

  const bcColor =
    type === "Plan" ? "rgba(167, 199, 231, " + colorOpacity + ")" : "rgba(137, 169, 201, " + colorOpacity + ")"

  const gcColor =
    type === "Plan" ? "rgba(244, 205, 165, " + colorOpacity + ")" : "rgba(214, 175, 135, " + colorOpacity + ")"

  const kStroke = type === "Plan" ? "#B5E3C1" : "#97C5A3"
  const bcStroke = type === "Plan" ? "#A7C7E7" : "#89A9C9"
  const gcStroke = type === "Plan" ? "#F4CDA5" : "#D6AF87"

  // Pre-calculate all aggregate values for better performance
  const aggregateValues = useMemo(() => {
    const values: Record<string, number> = {}

    if (type === "Plan") {
      // Filter plan data for this section once
      const sectionPlans = mockPlanData.filter((plan) => plan.sectionId === section.id)

      workingDays.forEach((day) => {
        const dateKey = formatDate(day)
        values[dateKey] = 0

        // Sum up rates for plans that include this day
        sectionPlans.forEach((plan) => {
          if (day >= plan.startDate && day <= plan.endDate) {
            values[dateKey] += plan.rate
          }
        })
      })
    } else {
      // For Fact, use the actual data
      workingDays.forEach((day) => {
        const dateKey = formatDate(day)
        const aggregates = sectionAggregates[section.id]?.[dateKey] || { total: 0 }
        values[dateKey] = aggregates.total
      })
    }

    return values
  }, [workingDays, section.id, type, sectionAggregates])

  // Calculate max value for scaling
  const maxValue = useMemo(() => {
    if (type === "Plan") {
      // Calculate max value from plan data for this section
      let maxValue = 0

      workingDays.forEach((day) => {
        const dateKey = formatDate(day)
        const k = aggregateValues[dateKey] || 0
        const bc = 0
        const gc = 0
        const total = k + bc + gc

        maxValue = Math.max(maxValue, total)
      })

      return Math.max(0.1, maxValue) // Ensure at least 0.1 to avoid division by zero
    }

    // For Fact, use the existing max values
    return maxAggregates[section.id] || 1
  }, [aggregateValues, maxAggregates, section.id, type, workingDays])

  // Generate rectangles for each category
  const rectangles = useMemo(() => {
    if (workingDays.length === 0) return []

    const rects: { x: number; y: number; width: number; height: number; value: number }[] = []
    const chartHeight = 64 // SVG height

    workingDays.forEach((day, index) => {
      const dateKey = formatDate(day)
      const value = aggregateValues[dateKey] || 0

      if (value > 0) {
        const normalizedValue = value / maxValue
        const height = normalizedValue * chartHeight * 0.8 // 80% of chart height

        rects.push({
          x: index * CELL_WIDTH,
          y: chartHeight - height, // Start from bottom
          width: CELL_WIDTH,
          height: height,
          value: value,
        })
      }
    })

    return rects
  }, [workingDays, aggregateValues, maxValue, CELL_WIDTH])

  return (
    <div className="absolute inset-0">
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

        {/* Горизонтальная линия посередине */}
        <line
          x1="0"
          y1="32"
          x2={workingDays.length * CELL_WIDTH}
          y2="32"
          stroke={isDarkTheme ? "rgba(51, 65, 85, 0.3)" : "rgba(226, 232, 240, 0.7)"}
          strokeWidth="1"
        />

        {/* Rectangles for total */}
        {rectangles.map((rect, i) => (
          <rect
            key={`total-${i}`}
            x={rect.x}
            y={rect.y}
            width={rect.width}
            height={rect.height}
            fill={type === "Plan" ? "rgba(167, 199, 231, 0.7)" : "rgba(137, 169, 201, 0.8)"}
            stroke={type === "Plan" ? "#A7C7E7" : "#89A9C9"}
            strokeWidth="1"
          />
        ))}
      </svg>

      {/* Interactive tooltip areas */}
      <div className="flex absolute inset-0">
        {workingDays.map((day, index) => {
          const dateKey = formatDate(day)
          const total = aggregateValues[dateKey] || 0

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
                  <div className="space-y-1">
                    <p className="font-semibold">
                      {type}: {total.toFixed(2)}
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

