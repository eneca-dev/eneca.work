"use client"

import { CheckSquare, Square, RotateCcw } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import type { ProcessingMode } from "../types"

interface ProcessingModesProps {
  modes: ProcessingMode[]
  onToggleMode: (modeId: string) => void
  onSelectAll: () => void
  onClearAll: () => void
  onStartProcessing: () => void
  disabled?: boolean
}

export const ProcessingModes = ({
  modes,
  onToggleMode,
  onSelectAll,
  onClearAll,
  onStartProcessing,
  disabled,
}: ProcessingModesProps) => {
  const enabledCount = modes.filter((mode) => mode.enabled).length
  const totalCount = modes.length
  const allSelected = enabledCount === totalCount
  const noneSelected = enabledCount === 0

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Выберите режимы обработки</CardTitle>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onSelectAll}
              disabled={disabled || allSelected}
              className="text-sm"
            >
              <CheckSquare className="w-4 h-4 mr-1" />
              Выбрать все
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onClearAll}
              disabled={disabled || noneSelected}
              className="text-sm"
            >
              <Square className="w-4 h-4 mr-1" />
              Очистить все
            </Button>
          </div>
        </div>
        {enabledCount > 0 && (
          <p className="text-sm text-gray-500">
            Выбрано: {enabledCount} из {totalCount} режимов
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3">
          {modes.map((mode) => (
            <div
              key={mode.id}
              className={`flex items-start space-x-3 p-3 rounded-lg border transition-colors ${
                mode.enabled ? "border-blue-200 bg-blue-50" : "border-gray-200 hover:bg-gray-50"
              }`}
            >
              <Checkbox
                id={mode.id}
                checked={mode.enabled}
                onCheckedChange={() => onToggleMode(mode.id)}
                disabled={disabled}
                className="mt-1"
              />
              <div className="flex-1">
                <label
                  htmlFor={mode.id}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  {mode.name}
                </label>
                <p className="text-xs text-gray-500 mt-1">{mode.description}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="pt-4 border-t">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              {enabledCount === 0 && "Выберите хотя бы один режим для начала обработки"}
              {enabledCount === 1 && "Готов к обработке 1 режим"}
              {enabledCount > 1 && `Готово к обработке ${enabledCount} режимов`}
            </div>
            <Button
              onClick={onStartProcessing}
              disabled={enabledCount === 0 || disabled}
              size="lg"
              className="min-w-[200px]"
            >
              {disabled ? (
                <>
                  <RotateCcw className="w-4 h-4 mr-2 animate-spin" />
                  Обработка...
                </>
              ) : (
                `Запустить обработку (${enabledCount})`
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
