'use client'

import { StickyNote } from 'lucide-react'
import { cn } from '@/lib/utils'

interface NotesTabButtonProps {
  onClick: () => void
  isOpen: boolean
}

export function NotesTabButton({ onClick, isOpen }: NotesTabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'fixed right-0 top-1/2 -translate-y-1/2 z-30',
        'w-10 h-10 rounded-l-lg',
        'bg-primary/90 hover:bg-primary',
        'border border-r-0 border-primary',
        'shadow-lg hover:shadow-xl',
        'transition-all duration-200',
        'flex items-center justify-center',
        'backdrop-blur-sm',
        isOpen && 'opacity-0 pointer-events-none'
      )}
      title="Открыть заметки"
    >
      <StickyNote className="h-5 w-5 text-primary-foreground" />
    </button>
  )
}
