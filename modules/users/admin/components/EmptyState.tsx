import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"

interface EmptyStateProps {
  message: string
  buttonText?: string
  onButtonClick?: () => void
}

export default function EmptyState({ message, buttonText, onButtonClick }: EmptyStateProps) {
  return (
    <div className="text-center py-8">
      <p className="text-gray-500 dark:text-gray-400 mb-4">{message}</p>
      {buttonText && onButtonClick && (
        <Button onClick={onButtonClick} variant="outline">
          <Plus className="mr-2 h-4 w-4" />
          {buttonText}
        </Button>
      )}
    </div>
  )
} 