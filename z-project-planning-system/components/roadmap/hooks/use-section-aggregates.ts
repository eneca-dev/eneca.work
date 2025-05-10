"use client"

import { useState, useEffect, useMemo } from "react"
import type { Project } from "@/types/project-types"
import type { CategoryAggregates } from "../types/roadmap-types"
import { getWorkingDaysInRange, formatDate } from "@/lib/date-utils"

export function useSectionAggregates(project: Project | null, workingDays: Date[]) {
  const [sectionAggregates, setSectionAggregates] = useState<Record<string, Record<string, CategoryAggregates>>>({})
  const [maxAggregates, setMaxAggregates] = useState<Record<string, number>>({})

  // Memoize the calculation of aggregates to prevent recalculation on every render
  // Обновим функцию расчета агрегатов
  const calculatedAggregates = useMemo(() => {
    if (!project || workingDays.length === 0) {
      return { aggregates: {}, maxValues: {} }
    }

    const aggregates: Record<string, Record<string, CategoryAggregates>> = {}
    const maxValues: Record<string, number> = {}

    // Create a date key lookup for faster access
    const dateKeyMap = new Map<string, Date>()
    workingDays.forEach((day) => {
      dateKeyMap.set(formatDate(day), day)
    })

    project.sections.forEach((section) => {
      aggregates[section.id] = {}

      // Initialize all days with 0 for total
      workingDays.forEach((day) => {
        const dateKey = formatDate(day)
        aggregates[section.id][dateKey] = {
          total: 0,
        }
      })

      // Sum up loadings for each day
      section.stages.forEach((stage) => {
        // Only use Fact loadings for the aggregates
        const factLoadings = stage.loadings.filter((l) => !l.type || l.type === "Fact")

        factLoadings.forEach((loading) => {
          const startDate = new Date(loading.date_start || loading.startDate)
          const endDate = new Date(loading.date_end || loading.endDate)
          const loadingDays = getWorkingDaysInRange(startDate, endDate)

          loadingDays.forEach((day) => {
            const dateKey = formatDate(day)
            if (aggregates[section.id][dateKey]) {
              // Increase total value
              aggregates[section.id][dateKey].total += loading.rate
            }
          })
        })
      })

      // Find maximum aggregate value for this section
      maxValues[section.id] = Math.max(
        0.1, // Minimum value to avoid division by zero
        ...Object.values(aggregates[section.id]).map((agg) => agg.total),
      )
    })

    return { aggregates, maxValues }
  }, [project, workingDays])

  useEffect(() => {
    setSectionAggregates(calculatedAggregates.aggregates)
    setMaxAggregates(calculatedAggregates.maxValues)
  }, [calculatedAggregates])

  return { sectionAggregates, maxAggregates }
}

