"use client"

import { useState, useEffect } from "react"
import type { Project } from "@/types/project-types"
import { getWorkingDaysInRange } from "@/lib/date-utils"

export function useWorkingDays(project: Project | null, visibleRange?: { startDate: Date; endDate: Date }) {
  const [workingDays, setWorkingDays] = useState<Date[]>([])
  const [allDays, setAllDays] = useState<Date[]>([])
  const [currentStartIndex, setCurrentStartIndex] = useState(0)

  useEffect(() => {
    if (project) {
      // Find the earliest start date across all loadings
      let earliestDate: Date | null = null

      project.sections.forEach((section) => {
        section.stages.forEach((stage) => {
          stage.loadings.forEach((loading) => {
            if (!earliestDate || loading.startDate < earliestDate) {
              earliestDate = new Date(loading.startDate)
            }
          })
        })
      })

      // If no loadings, use current month
      if (!earliestDate) {
        const today = new Date()
        earliestDate = new Date(today.getFullYear(), today.getMonth(), 1)
      }

      // Set end date to end of year
      const currentYear = new Date().getFullYear()
      const endDate = new Date(currentYear, 11, 31) // December 31st of current year

      // Get all working days in the range
      const days = getWorkingDaysInRange(earliestDate, endDate)
      setAllDays(days)

      // If we have a specific visible range, filter days
      if (visibleRange) {
        const filteredDays = days.filter((day) => day >= visibleRange.startDate && day <= visibleRange.endDate)
        setWorkingDays(filteredDays)
      } else {
        // Default to showing first 10 days
        setWorkingDays(days.slice(0, 10))
      }
    }
  }, [project, visibleRange])

  return { workingDays, allDays, setCurrentStartIndex, currentStartIndex }
}

