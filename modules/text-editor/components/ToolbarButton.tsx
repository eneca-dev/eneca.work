import type { Editor } from '@tiptap/react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { ToolbarButtonConfig } from '@/modules/text-editor/config/toolbar-config'

interface ToolbarButtonProps {
  editor: Editor
  config: ToolbarButtonConfig
}

export function ToolbarButton({ editor, config }: ToolbarButtonProps) {
  const Icon = config.icon
  const isActive = config.isActive(editor)

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => config.onClick(editor)}
      className={cn(
        'h-8 w-8 p-0',
        isActive && 'bg-primary text-primary-foreground'
      )}
      title={config.title}
    >
      <Icon className="h-4 w-4" />
    </Button>
  )
}
