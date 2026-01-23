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
        'group',
        // Тонкая вертикальная полоска
        'w-1.5 h-16 rounded-l-sm',
        // Сразу видимый зелёный цвет
        'bg-primary hover:bg-primary/90',
        // Плавная анимация
        'transition-all duration-300 ease-out',
        // При наведении немного расширяется
        'hover:w-2 hover:h-20',
        // Скрываем когда панель открыта
        isOpen && 'opacity-0 pointer-events-none'
      )}
    >
      {/* Тултип с текстом появляется при наведении */}
      <span className={cn(
        'absolute right-full mr-2 top-1/2 -translate-y-1/2',
        'flex items-center gap-2 px-3 py-1.5 rounded-md',
        'bg-popover border border-border shadow-md',
        'opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100',
        'transition-all duration-200',
        'pointer-events-none whitespace-nowrap'
      )}>
        <StickyNote className="h-4 w-4 text-primary" />
        <span className="text-sm text-foreground">Заметки</span>
      </span>
    </button>
  )
}
