"use client"

import { useState } from "react"
import { createPortal } from "react-dom"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import { ru } from "date-fns/locale"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface FreshnessIndicatorProps {
  teamId: string
  teamName: string
  daysSinceUpdate?: number
  lastUpdate?: Date | null
  theme: 'light' | 'dark'
  size?: 'sm' | 'md'
  onConfirm: (teamId: string) => Promise<{ success: boolean; error?: string }>
  // Для актуализации нескольких команд (например, всего отдела)
  teamIds?: string[]
  onConfirmMultiple?: (teamIds: string[]) => Promise<{ success: boolean; error?: string }>
  // Отключение кнопки актуализации (если нет прав)
  disabled?: boolean
  // Позиция тултипа (по умолчанию "top")
  tooltipSide?: 'top' | 'bottom' | 'left' | 'right'
}

export function FreshnessIndicator({
  teamId,
  teamName,
  daysSinceUpdate,
  lastUpdate,
  theme,
  size = 'md',
  onConfirm,
  teamIds,
  onConfirmMultiple,
  disabled = false,
  tooltipSide = 'top'
}: FreshnessIndicatorProps) {
  const [showConfirmModal, setShowConfirmModal] = useState(false)

  // Определение цвета на основе количества дней
  const getColor = () => {
    if (daysSinceUpdate === undefined) return 'gray'
    if (daysSinceUpdate < 3) return 'green'
    if (daysSinceUpdate <= 5) return 'yellow'
    return 'red'
  }

  const color = getColor()
  const dotSize = size === 'sm' ? 'w-2 h-2' : 'w-2.5 h-2.5'

  // Цвета точки
  const colorClasses = {
    green: 'bg-emerald-500',
    yellow: 'bg-amber-500',
    red: 'bg-red-500',
    gray: 'bg-slate-400'
  }

  // Формирование текста для склонения "день/дня/дней"
  const getDaysText = (days: number) => {
    if (days === 1) return 'день'
    if (days >= 2 && days <= 4) return 'дня'
    return 'дней'
  }

  // Tooltip текст
  const getTooltipText = () => {
    if (daysSinceUpdate === undefined || !lastUpdate) {
      return 'Нет данных об обновлениях'
    }

    const actionLine = disabled ? 'Нет прав для актуализации' : 'Нажмите для актуализации'

    // Если давно не обновлялось - не показываем дату
    if (daysSinceUpdate > 200) {
      return `Не обновлялось\n${actionLine}`
    }

    // Если обновлялось недавно - показываем дату
    const statusLine = daysSinceUpdate === 0
      ? 'Обновлено сегодня'
      : `Обновлено ${daysSinceUpdate} ${getDaysText(daysSinceUpdate)} назад`
    const dateLine = `Дата: ${format(lastUpdate, 'dd.MM.yyyy, HH:mm', { locale: ru })}`

    return `${statusLine}\n${dateLine}\n${actionLine}`
  }

  const tooltipText = getTooltipText()

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    if (!disabled) {
      setShowConfirmModal(true)
    }
  }

  return (
    <>
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label={disabled ? 'Нет прав для актуализации данных команды' : 'Обновить данные команды'}
              className={cn(
                "rounded-full transition-all border-0 p-0",
                disabled ? "cursor-default opacity-50" : "cursor-pointer hover:scale-125",
                dotSize,
                colorClasses[color]
              )}
              onClick={handleClick}
              disabled={disabled}
            />
          </TooltipTrigger>
          <TooltipContent
            side={tooltipSide}
            sideOffset={12}
            collisionPadding={16}
            className={cn(
              "max-w-xs px-2 py-1.5 whitespace-pre-line text-xs border-2 z-[999999]",
              theme === 'dark'
                ? 'bg-slate-800 text-slate-100 border-slate-700'
                : 'bg-white text-slate-800 border-slate-200'
            )}
          >
            {tooltipText}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {showConfirmModal && typeof document !== 'undefined' && createPortal(
        <ConfirmModal
          teamId={teamId}
          teamName={teamName}
          theme={theme}
          onConfirm={onConfirm}
          onClose={() => setShowConfirmModal(false)}
          teamIds={teamIds}
          onConfirmMultiple={onConfirmMultiple}
        />,
        document.body
      )}
    </>
  )
}

// Вспомогательный компонент ConfirmModal (временно здесь, потом вынесем)
interface ConfirmModalProps {
  teamId: string
  teamName: string
  theme: 'light' | 'dark'
  onConfirm: (teamId: string) => Promise<{ success: boolean; error?: string }>
  onClose: () => void
  teamIds?: string[]
  onConfirmMultiple?: (teamIds: string[]) => Promise<{ success: boolean; error?: string }>
}

function ConfirmModal({
  teamId,
  teamName,
  theme,
  onConfirm,
  onClose,
  teamIds,
  onConfirmMultiple
}: ConfirmModalProps) {
  const [isConfirming, setIsConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleConfirm = async (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()

    setIsConfirming(true)
    setError(null)

    try {
      // Валидация: проверяем что есть команды для актуализации
      if (teamIds && teamIds.length === 0) {
        setError('Нет команд для актуализации')
        setIsConfirming(false)
        return
      }

      // Если переданы teamIds и функция для множественной актуализации
      const result = teamIds && onConfirmMultiple
        ? await onConfirmMultiple(teamIds)
        : await onConfirm(teamId)

      if (result.success) {
        onClose()
      } else {
        setError(result.error || 'Ошибка при подтверждении')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Неожиданная ошибка')
    } finally {
      setIsConfirming(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/5"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
    >
      <div
        className={cn(
          "rounded-lg p-6 max-w-md w-full mx-4 shadow-2xl border",
          theme === 'dark'
            ? 'bg-slate-800 text-slate-200 border-slate-700'
            : 'bg-white text-slate-800 border-slate-200'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold mb-2">
          Актуализировать данные?
        </h3>
        <p className={cn("text-sm mb-4", theme === 'dark' ? 'text-slate-400' : 'text-slate-600')}>
          {teamIds && onConfirmMultiple ? (
            <>Вы подтверждаете, что данные всех команд отдела <strong>{teamName}</strong> актуальны на данный момент</>
          ) : (
            <>Вы подтверждаете, что данные команды <strong>{teamName}</strong> актуальны на данный момент</>
          )}
        </p>

        {error && (
          <div className={cn(
            "mb-4 p-3 rounded text-sm",
            theme === 'dark'
              ? 'bg-red-900/30 text-red-300 border border-red-800'
              : 'bg-red-50 text-red-800 border border-red-200'
          )}>
            {error}
          </div>
        )}

        <div className="flex gap-2 justify-end">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onClose()
            }}
            disabled={isConfirming}
            className={cn(
              "px-4 py-2 rounded transition-colors",
              theme === 'dark'
                ? 'bg-slate-700 hover:bg-slate-600 text-slate-200'
                : 'bg-slate-200 hover:bg-slate-300 text-slate-800',
              isConfirming && 'opacity-50 cursor-not-allowed'
            )}
          >
            Отмена
          </button>
          <button
            onClick={handleConfirm}
            disabled={isConfirming}
            className={cn(
              "px-4 py-2 rounded transition-colors",
              "bg-teal-600 hover:bg-teal-700 text-white",
              isConfirming && 'opacity-50 cursor-not-allowed'
            )}
          >
            {isConfirming ? 'Подтверждение...' : 'Подтвердить'}
          </button>
        </div>
      </div>
    </div>
  )
}
