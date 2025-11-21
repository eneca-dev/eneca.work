"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface AnalyticsStatsData {
  users_with_loading_count: number
  total_users_count: number
  percentage_users_with_loading: number
  sections_in_work_today: number
  projects_in_work_today: number
  avg_department_loading: number
  analytics_date?: string
}

interface AnalyticsStatsProps {
  stats: AnalyticsStatsData
  isLoading: boolean
}

export function AnalyticsStats({ stats, isLoading }: AnalyticsStatsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="rounded-sm dark:bg-[rgb(15_23_42)]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Пользователи с загрузкой */}
      <Card className="rounded-sm dark:bg-[rgb(15_23_42)]">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Пользователи с загрузкой
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-foreground dark:text-white">
            {stats.percentage_users_with_loading.toFixed(1)}%
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {stats.users_with_loading_count} из {stats.total_users_count}
          </p>
        </CardContent>
      </Card>

      {/* Разделов в работе */}
      <Card className="rounded-sm dark:bg-[rgb(15_23_42)]">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Разделов в работе
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-foreground dark:text-white">
            {stats.sections_in_work_today}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {stats.analytics_date ? new Date(stats.analytics_date).toLocaleDateString('ru-RU') : new Date().toLocaleDateString('ru-RU')}
          </p>
        </CardContent>
      </Card>

      {/* Проектов в работе */}
      <Card className="rounded-sm dark:bg-[rgb(15_23_42)]">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Проектов в работе
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-foreground dark:text-white">
            {stats.projects_in_work_today}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {stats.analytics_date ? new Date(stats.analytics_date).toLocaleDateString('ru-RU') : new Date().toLocaleDateString('ru-RU')}
          </p>
        </CardContent>
      </Card>

      {/* Средняя загрузка */}
      <Card className="rounded-sm dark:bg-[rgb(15_23_42)]">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Средняя загрузка
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-foreground dark:text-white">
            {stats.avg_department_loading.toFixed(2)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            на пользователя
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
