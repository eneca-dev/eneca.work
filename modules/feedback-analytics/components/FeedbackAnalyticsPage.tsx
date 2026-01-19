"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { RefreshCw, AlertCircle, UserPlus, MessageSquare } from "lucide-react"
import { FeedbackStats } from "./FeedbackStats"
import { FeedbackCommentsList } from "./FeedbackCommentsList"
import { UserReportsList } from "./UserReportsList"
import { AddUserModal } from "./AddUserModal"
import { useFeedbackAnalytics } from "../hooks/useFeedbackAnalytics"
import { useUserReports } from "../hooks/useUserReports"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Card, CardContent } from "@/components/ui/card"

export function FeedbackAnalyticsPage() {
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false)
  const [viewMode, setViewMode] = useState<'feedback' | 'reports'>('feedback')

  const { stats, comments, isLoading, error, refresh, hasAccess } = useFeedbackAnalytics()
  const {
    reports,
    isLoading: reportsLoading,
    error: reportsError,
    refresh: refreshReports,
    hasAccess: reportsAccess,
    sortOrder,
    toggleSortOrder
  } = useUserReports()

  // Проверка доступа в процессе (первая загрузка)
  const currentLoading = viewMode === 'feedback' ? isLoading : reportsLoading
  const currentAccess = viewMode === 'feedback' ? hasAccess : reportsAccess

  if (currentAccess === null && currentLoading) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6 flex justify-center items-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <span className="ml-3">Загрузка данных...</span>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Нет доступа
  if (currentAccess === false) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Доступ запрещен</AlertTitle>
          <AlertDescription>
            У вас нет доступа к аналитике опросов.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  const currentError = viewMode === 'feedback' ? error : reportsError

  return (
    <div className="space-y-6 p-6 min-h-screen bg-card">
      {/* Заголовок с кнопками */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-foreground dark:text-white">
          Аналитика опросов
        </h1>
        <div className="flex gap-2">
          <Button
            onClick={() => setViewMode(viewMode === 'feedback' ? 'reports' : 'feedback')}
            variant="outline"
            size="sm"
            className="bg-popover !border-border"
          >
            <MessageSquare className="h-4 w-4 mr-2" />
            {viewMode === 'feedback' ? 'Сообщения о проблемах' : 'Ответы пользователей'}
          </Button>
          <Button
            onClick={() => setIsAddUserModalOpen(true)}
            variant="outline"
            size="sm"
            className="bg-popover !border-border"
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Добавить
          </Button>
          <Button
            onClick={viewMode === 'feedback' ? refresh : refreshReports}
            disabled={currentLoading}
            variant="outline"
            size="sm"
            className="bg-popover !border-border"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${currentLoading ? "animate-spin" : ""}`} />
            Обновить
          </Button>
        </div>
      </div>

      {/* Модальное окно добавления пользователей */}
      <AddUserModal
        open={isAddUserModalOpen}
        onClose={() => setIsAddUserModalOpen(false)}
        onSuccess={() => {
          setIsAddUserModalOpen(false)
          refresh()
        }}
      />

      {/* Ошибка */}
      {currentError && (
        <Alert variant="destructive">
          <AlertDescription>
            {currentError.message}
          </AlertDescription>
        </Alert>
      )}

      {/* Статистика */}
      <FeedbackStats stats={stats} isLoading={isLoading} />

      {/* Список комментариев или сообщений о проблемах */}
      {viewMode === 'feedback' ? (
        <FeedbackCommentsList comments={comments} isLoading={isLoading} />
      ) : (
        <UserReportsList
          reports={reports}
          isLoading={reportsLoading}
          sortOrder={sortOrder}
          onToggleSortOrder={toggleSortOrder}
        />
      )}
    </div>
  )
}
