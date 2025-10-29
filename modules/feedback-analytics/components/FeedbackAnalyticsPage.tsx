"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { RefreshCw, AlertCircle, UserPlus } from "lucide-react"
import { FeedbackStats } from "./FeedbackStats"
import { FeedbackCommentsList } from "./FeedbackCommentsList"
import { AddUserModal } from "./AddUserModal"
import { useFeedbackAnalytics } from "../hooks/useFeedbackAnalytics"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Card, CardContent } from "@/components/ui/card"

export function FeedbackAnalyticsPage() {
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false)
  const { stats, comments, isLoading, error, refresh, hasAccess } = useFeedbackAnalytics()

  // Проверка доступа в процессе (первая загрузка)
  if (hasAccess === null && isLoading) {
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
  if (hasAccess === false) {
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

  return (
    <div className="space-y-6 p-6 min-h-screen dark:bg-[rgb(17_24_39)]">
      {/* Заголовок с кнопками */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-foreground dark:text-white">
          Аналитика опросов
        </h1>
        <div className="flex gap-2">
          <Button
            onClick={() => setIsAddUserModalOpen(true)}
            variant="outline"
            size="sm"
            className="bg-white dark:bg-[rgb(15_23_42)] !border-gray-200 dark:!border-slate-600"
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Добавить
          </Button>
          <Button
            onClick={refresh}
            disabled={isLoading}
            variant="outline"
            size="sm"
            className="bg-white dark:bg-[rgb(15_23_42)] !border-gray-200 dark:!border-slate-600"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
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
      {error && (
        <Alert variant="destructive">
          <AlertDescription>
            {error.message}
          </AlertDescription>
        </Alert>
      )}

      {/* Статистика */}
      <FeedbackStats stats={stats} isLoading={isLoading} />

      {/* Список комментариев */}
      <FeedbackCommentsList comments={comments} isLoading={isLoading} />
    </div>
  )
}
