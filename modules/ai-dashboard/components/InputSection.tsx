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
    <div className="bg-white dark:bg-slate-900/95
                    border border-gray-200 dark:border-slate-700/50
                    rounded-lg p-4 shadow-md">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-5 h-5 text-primary" />
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
          AI Аналитика
        </h2>
      </div>

      <textarea
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Введите ваш запрос... (например: Покажи топ 5 проектов по бюджету)"
        disabled={isLoading}
        className="w-full min-h-[100px] p-3
                   bg-slate-50 dark:bg-slate-800/50
                   border border-slate-300 dark:border-slate-700
                   rounded-md
                   text-sm text-slate-900 dark:text-slate-100
                   placeholder:text-slate-400 dark:placeholder:text-slate-500
                   focus:outline-none focus:ring-2 focus:ring-primary/50
                   disabled:opacity-50 disabled:cursor-not-allowed
                   resize-none"
      />

      <div className="flex items-center justify-between mt-3">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Нажмите Enter для отправки
        </p>

        <Button
          onClick={handleSubmit}
          disabled={!query.trim() || isLoading}
          className="bg-primary hover:bg-primary/90 text-white font-medium"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Анализ...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-2" />
              Запустить анализ
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
