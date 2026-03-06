"use client"

import { useMemo } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { queryKeys, staleTimePresets } from "@/modules/cache"
import {
  getUsersByDepartment,
  getUsersByTeam,
  getUsersByCategory,
  getActiveUsersCount,
  getUsersJoinedByMonth,
} from "@/services/org-data-service"
import * as Sentry from "@sentry/nextjs"

// ============================================================================
// Types
// ============================================================================

export interface AnalyticsDataPoint {
  name: string
  value: number
}

interface AnalyticsRawData {
  departmentData: AnalyticsDataPoint[]
  teamData: AnalyticsDataPoint[]
  categoryData: AnalyticsDataPoint[]
  monthlyData: AnalyticsDataPoint[]
  activeUsers: number
}

// ============================================================================
// Query Function
// ============================================================================

async function fetchAnalyticsData(): Promise<AnalyticsRawData> {
  // 5 уникальных запросов параллельно (вместо 8, убраны дубли)
  const [departmentData, teamData, categoryData, monthlyData, activeUsers] =
    await Sentry.startSpan(
      { name: "Users/UserAnalytics loadAnalytics", op: "ui.load" },
      () =>
        Promise.all([
          getUsersByDepartment(),
          getUsersByTeam(),
          getUsersByCategory(),
          getUsersJoinedByMonth(),
          getActiveUsersCount(),
        ])
    )

  // Фильтруем записи без имени (nullable из DB)
  const clean = <T extends { name: string | null }>(items: T[]) =>
    items.filter((i): i is T & { name: string } => i.name != null)

  return {
    departmentData: clean(departmentData),
    teamData: clean(teamData),
    categoryData: clean(categoryData),
    monthlyData: clean(monthlyData),
    activeUsers,
  }
}

// ============================================================================
// Hook
// ============================================================================

/** Аналитика пользователей. Один TanStack Query запрос, derived state через useMemo. */
export function useUserAnalytics() {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: queryKeys.admin.analytics(),
    queryFn: fetchAnalyticsData,
    staleTime: staleTimePresets.static,
  })

  // Derived state: topDepartments = departmentData с переименованным полем
  const topDepartments = useMemo(() => {
    return (query.data?.departmentData || []).map((d) => ({
      name: d.name,
      count: d.value,
    }))
  }, [query.data?.departmentData])

  // Derived state: topTeams = teamData с переименованным полем
  const topTeams = useMemo(() => {
    return (query.data?.teamData || []).map((t) => ({
      name: t.name,
      count: t.value,
    }))
  }, [query.data?.teamData])

  const refetch = async () => {
    await queryClient.invalidateQueries({
      queryKey: queryKeys.admin.analytics(),
    })
  }

  return {
    departmentData: query.data?.departmentData || [],
    teamData: query.data?.teamData || [],
    categoryData: query.data?.categoryData || [],
    monthlyData: query.data?.monthlyData || [],
    activeUsers: query.data?.activeUsers ?? 0,
    topDepartments,
    topTeams,
    isLoading: query.isLoading,
    error: query.error,
    refetch,
  }
}
