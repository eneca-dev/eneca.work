"use client"

import { useState, useEffect, useMemo } from "react"
import type { MonthGroup } from "../types/roadmap-types"

export function useMonthGroups(workingDays: Date[]) {
  const [monthGroups, setMonthGroups] = useState<MonthGroup[]>([])

  // Memoize month groups calculation to prevent recalculation on every render
  const calculatedMonthGroups = useMemo(() => {
    if (workingDays.length === 0) return []

    // Group days by month
    const groups: MonthGroup[] = []
    let currentMonth = ""
    let startIndex = 0
    let dayCount = 0

    workingDays.forEach((day, index) => {
      const month = `${day.toLocaleString("default", { month: "long" })} ${day.getFullYear()}`

      if (month !== currentMonth) {
        if (currentMonth !== "") {
          groups.push({
            month: currentMonth,
            startIndex,
            days: dayCount,
          })
        }
        currentMonth = month
        startIndex = index
        dayCount = 1
      } else {
        dayCount++
      }
    })

    // Add the last month group
    if (currentMonth !== "") {
      groups.push({
        month: currentMonth,
        startIndex,
        days: dayCount,
      })
    }

    return groups
  }, [workingDays])

  useEffect(() => {
    setMonthGroups(calculatedMonthGroups)
  }, [calculatedMonthGroups])

  return { monthGroups }
}

