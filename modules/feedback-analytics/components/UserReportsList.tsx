"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, ArrowUpDown } from "lucide-react"
import type { UserReport } from "../services/feedbackAnalyticsService"

interface UserReportsListProps {
  reports: UserReport[]
  isLoading: boolean
  sortOrder: 'asc' | 'desc'
  onToggleSortOrder: () => void
}

export function UserReportsList({ reports, isLoading, sortOrder, onToggleSortOrder }: UserReportsListProps) {
  const [searchQuery, setSearchQuery] = useState("")

  // Фильтрация сообщений по поисковому запросу
  const filteredReports = useMemo(() => {
    if (!searchQuery.trim()) {
      return reports
    }

    const query = searchQuery.toLowerCase()
    return reports.filter((report) => {
      const fullName = `${report.first_name} ${report.last_name}`.toLowerCase()
      const shortDesc = (report.user_report_short_description || "").toLowerCase()
      const detailedDesc = (report.user_report_detailed_description || "").toLowerCase()
      return fullName.includes(query) || shortDesc.includes(query) || detailedDesc.includes(query)
    })
  }, [reports, searchQuery])

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Сообщения о проблемах</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="border rounded-lg p-4 space-y-2">
                <div className="h-4 bg-muted rounded animate-pulse w-1/4" />
                <div className="h-3 bg-muted rounded animate-pulse w-full" />
                <div className="h-3 bg-muted rounded animate-pulse w-3/4" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="rounded-sm bg-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Сообщения о проблемах</CardTitle>

          {/* Кнопка сортировки */}
          <Button
            variant="outline"
            size="sm"
            onClick={onToggleSortOrder}
            className="bg-popover border-border"
          >
            <ArrowUpDown className="h-4 w-4 mr-2" />
            {sortOrder === 'desc' ? 'Сначала новые' : 'Сначала старые'}
          </Button>
        </div>

        <div className="relative mt-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Поиск по имени или тексту сообщения..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 rounded-sm bg-popover border-border"
          />
        </div>
      </CardHeader>
      <CardContent>
        {filteredReports.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            {searchQuery ? "Ничего не найдено" : "Нет сообщений"}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredReports.map((report) => {
              const createdDate = new Date(report.user_report_created_at)
              const formattedDate = createdDate.toLocaleDateString("ru-RU", {
                year: "numeric",
                month: "long",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })

              return (
                <div
                  key={report.user_report_id}
                  className="border rounded-sm p-4 space-y-2 hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="font-semibold text-foreground dark:text-white">
                      {report.first_name} {report.last_name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formattedDate}
                    </span>
                  </div>

                  <div className="text-sm font-medium text-foreground200">
                    {report.user_report_short_description}
                  </div>

                  {report.user_report_detailed_description && (
                    <p className="text-sm text-foreground300 whitespace-pre-wrap">
                      {report.user_report_detailed_description}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
