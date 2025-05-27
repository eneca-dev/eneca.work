"use client"
import { FolderOpen } from "lucide-react"
import { Button } from "@/components/ui/button"

interface EmptyStateProps {
  /** Текст описания пустого состояния */
  message?: string
  /** Текст кнопки для добавления записи */
  buttonText?: string
  /** Обработчик нажатия на кнопку */
  onButtonClick?: () => void
}

export default function EmptyState({
  message = "Записи не найдены",
  buttonText,
  onButtonClick
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-center p-6">
      <div className="bg-muted rounded-full p-4 mb-4">
        <FolderOpen className="h-10 w-10 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-medium mb-2">{message}</h3>
      <p className="text-muted-foreground text-sm mb-6">
        Возможно, нужно создать первую запись или изменить параметры поиска.
      </p>
      {buttonText && onButtonClick && (
        <Button onClick={onButtonClick}>
          {buttonText}
        </Button>
      )}
    </div>
  )
} 