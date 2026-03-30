'use client'

import { useEffect } from 'react'
import { Scissors } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useScissorsModeStore } from '@/stores'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip'

/**
 * Кнопка-тогл для активации режима "ножниц" (разрезание загрузок).
 *
 * ESC деактивирует режим.
 */
export function ScissorsToggle() {
  const isActive = useScissorsModeStore((s) => s.isActive)
  const toggle = useScissorsModeStore((s) => s.toggle)
  const deactivate = useScissorsModeStore((s) => s.deactivate)

  // ESC для выхода из режима
  useEffect(() => {
    if (!isActive) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        deactivate()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isActive, deactivate])

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'h-6 w-6',
              isActive && 'bg-primary text-primary-foreground hover:bg-primary/90'
            )}
            onClick={toggle}
          >
            <Scissors className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          {isActive ? 'Выключить ножницы (Esc)' : 'Разрезать загрузку (ножницы)'}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
