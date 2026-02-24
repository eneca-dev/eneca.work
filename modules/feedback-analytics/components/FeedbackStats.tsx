"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import type { FeedbackStats } from "../services/feedbackAnalyticsService"

interface FeedbackStatsProps {
  stats: FeedbackStats | null
  isLoading: boolean
}

export function FeedbackStats({ stats, isLoading }: FeedbackStatsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                <div className="h-4 bg-muted rounded animate-pulse" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-muted rounded animate-pulse mb-2" />
              <div className="h-2 bg-muted rounded animate-pulse" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (!stats) return null

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Общая оценка */}
      <Card className="rounded-sm bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Общая оценка
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-foreground">
            {stats.averageScore.toFixed(1)}
          </div>
          <Progress value={stats.averageScore * 10} className="mt-2" />
        </CardContent>
      </Card>

      {/* Всего ответов */}
      <Card className="rounded-sm bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Всего ответов
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-foreground">
            {stats.totalResponses}
          </div>
        </CardContent>
      </Card>

      {/* Без проблем */}
      <Card className="rounded-sm bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Без проблем
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-green-600 dark:text-green-500">
            {stats.percentWithoutProblems.toFixed(1)}%
          </div>
          <Progress
            value={stats.percentWithoutProblems}
            className="mt-2 [&>div]:bg-green-600 dark:[&>div]:bg-green-500"
          />
        </CardContent>
      </Card>

      {/* С проблемами */}
      <Card className="rounded-sm bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            С проблемами
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-orange-600 dark:text-orange-500">
            {Number.isFinite(stats.percentWithProblems) ? stats.percentWithProblems.toFixed(1) : '—'}%
          </div>
          <Progress
            value={Number.isFinite(stats.percentWithProblems) ? Math.min(Math.max(stats.percentWithProblems, 0), 100) : 0}
            className="mt-2 [&>div]:bg-orange-600 dark:[&>div]:bg-orange-500"
          />        </CardContent>
      </Card>
    </div>
  )
}
