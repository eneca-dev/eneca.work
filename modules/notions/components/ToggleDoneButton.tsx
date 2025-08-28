import { Button } from '@/components/ui/button'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Notion } from '@/modules/notions/types'

interface ToggleDoneButtonProps {
  notion: Notion
  onToggle: () => void
}

export function ToggleDoneButton({ notion, onToggle }: ToggleDoneButtonProps) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onToggle}
      className="gap-2 hover:bg-gray-100 dark:hover:bg-gray-700"
    >
      <Check className={cn(
        "h-4 w-4",
        notion.notion_done ? "text-green-600 dark:text-green-400" : "text-gray-400 dark:text-gray-500"
      )} />
      {notion.notion_done ? "В архиве" : "Архивировать"}
    </Button>
  )
}
