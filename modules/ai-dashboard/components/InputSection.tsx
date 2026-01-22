/**
 * Секция ввода запроса
 *
 * @module modules/ai-dashboard/components/InputSection
 */

'use client'

import { useState } from 'react'
import { Sparkles, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface InputSectionProps {
  onSubmit: (query: string) => void
  isLoading: boolean
}

/**
 * Компонент для ввода запроса пользователя
 */
export function InputSection({ onSubmit, isLoading }: InputSectionProps) {
  const [query, setQuery] = useState('')

  const handleSubmit = () => {
    if (query.trim() && !isLoading) {
      onSubmit(query)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="rounded-lg border bg-card p-4">
      <textarea
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Введите запрос для анализа (например: Покажи топ 5 проектов по бюджету)"
        disabled={isLoading}
        className="w-full min-h-[100px] p-3 mb-3
                   bg-background
                   border rounded-md
                   text-sm
                   placeholder:text-muted-foreground
                   focus:outline-none focus:ring-2 focus:ring-primary/50
                   disabled:opacity-50 disabled:cursor-not-allowed
                   resize-none"
      />

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Нажмите Enter для отправки
        </p>

        <Button
          onClick={handleSubmit}
          disabled={!query.trim() || isLoading}
          className="gap-2"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Анализ...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Запустить анализ
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
