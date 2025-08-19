"use client"

import { CheckCircle, XCircle, Loader2, Clock } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import type { ProcessingMode, ProcessingStatus } from "../types"

interface ProcessingProgressProps {
  modes: ProcessingMode[]
  statuses: Record<string, ProcessingStatus>
}

export const ProcessingProgress = ({ modes, statuses }: ProcessingProgressProps) => {
  const enabledModes = modes.filter((mode) => mode.enabled)

  const getStatusIcon = (status: ProcessingStatus) => {
    switch (status.status) {
      case "processing":
        return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
      case "completed":
        return <CheckCircle className="w-5 h-5 text-green-500" />
      case "error":
        return <XCircle className="w-5 h-5 text-red-500" />
      case "idle":
        return <Clock className="w-5 h-5 text-gray-400" />
      default:
        return <div className="w-5 h-5 rounded-full bg-gray-200" />
    }
  }

  const getStatusText = (mode: ProcessingMode, status: ProcessingStatus) => {
    switch (status.status) {
      case "processing":
        return `Обработка... ${Math.round(status.progress)}%`
      case "completed":
        return "Завершено успешно"
      case "error":
        return status.error || "Ошибка обработки"
      case "idle":
        return "Ожидание очереди"
      default:
        return "Ожидание"
    }
  }

  const getStatusColor = (status: ProcessingStatus) => {
    switch (status.status) {
      case "processing":
        return "border-blue-200 bg-blue-50"
      case "completed":
        return "border-green-200 bg-green-50"
      case "error":
        return "border-red-200 bg-red-50"
      case "idle":
        return "border-gray-200 bg-gray-50"
      default:
        return "border-gray-200"
    }
  }

  const completedCount = Object.values(statuses).filter((s) => s.status === "completed").length
  const errorCount = Object.values(statuses).filter((s) => s.status === "error").length
  const totalCount = enabledModes.length

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Прогресс обработки</CardTitle>
          <div className="text-sm text-gray-600">
            Завершено: {completedCount} из {totalCount}
            {errorCount > 0 && <span className="text-red-600 ml-2">(ошибок: {errorCount})</span>}
          </div>
        </div>
        {totalCount > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Общий прогресс</span>
              <span>{Math.round(((completedCount + errorCount) / totalCount) * 100)}%</span>
            </div>
            <Progress value={((completedCount + errorCount) / totalCount) * 100} className="h-2" />
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {enabledModes.map((mode, index) => {
          const status = statuses[mode.id]
          if (!status) return null

          return (
            <div key={mode.id} className={`p-4 rounded-lg border ${getStatusColor(status)}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium text-gray-500">#{index + 1}</span>
                    {getStatusIcon(status)}
                  </div>
                  <div>
                    <p className="font-medium text-sm">{mode.name}</p>
                    <p className="text-xs text-gray-500">{getStatusText(mode, status)}</p>
                  </div>
                </div>
              </div>
              {status.status === "processing" && <Progress value={status.progress} className="h-2" />}
            </div>
          )
        })}

        <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-sm text-blue-800">
            <strong>Последовательная обработка:</strong> Каждый режим выполняется последовательно. При ошибке в режиме
            обработка автоматически переходит к следующему.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
