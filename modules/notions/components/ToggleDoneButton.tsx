import { Button } from '@/components/ui/button'
import { Check, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Notion } from '@/modules/notions/types'

interface ToggleDoneButtonProps {
  notion?: Notion
  onToggle?: () => void
  disabled?: boolean
  loading?: boolean
}

export function ToggleDoneButton({ 
  notion = { notion_done: false } as Notion, 
  onToggle = () => {}, 
  disabled = false, 
  loading = false 
}: ToggleDoneButtonProps) {
  const handleClick = () => {
    if (!disabled && !loading) {
      onToggle()
    }
  }

  const isDisabled = disabled || loading

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={handleClick}
      disabled={isDisabled}
      aria-pressed={notion.notion_done}
      aria-disabled={isDisabled}
      className="gap-2 hover:bg-gray-100 dark:hover:bg-gray-700"
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin text-gray-400 dark:text-gray-500" />
      ) : (
        <Check className={cn(
          "h-4 w-4",
          notion.notion_done ? "text-green-600 dark:text-green-400" : "text-gray-400 dark:text-gray-500"
        )} />
      )}
      {loading ? "Обработка..." : notion.notion_done ? "В архиве" : "Архивировать"}
    </Button>
  )
}
