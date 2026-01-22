import { useState, useRef, useEffect } from 'react'
import { Send, Sparkles } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface MessageInputProps {
  onSendMessage: (message: string) => void
  isLoading: boolean
  input: string
  setInput: (value: string) => void
}

export function MessageInput({ onSendMessage, isLoading, input, setInput }: MessageInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Автоматическое изменение высоты textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [input])

  const handleSubmit = () => {
    if (input.trim() && !isLoading) {
      onSendMessage(input)
      setInput('')
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      // Не отправляем, если идет загрузка
      if (!isLoading) {
        handleSubmit()
      }
    }
  }

  return (
    <div className="border-t border-border bg-card p-3 rounded-b-xl">
      <div className="flex items-center space-x-2">
        {/* Меню быстрых операций */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="p-2 rounded-lg border border-primary/50 text-primary hover:bg-primary/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title={isLoading ? "Ожидание ответа..." : "Быстрые операции"}
              aria-label="Быстрые операции"
              disabled={isLoading}
            >
              <Sparkles size={16} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" sideOffset={6}>
            <DropdownMenuLabel>Быстрые операции</DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => {
                if (!isLoading) {
                  onSendMessage('план на день')
                  setInput('')
                }
              }}
            >
              План на день
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                if (!isLoading) {
                  onSendMessage('собрать отчёт')
                  setInput('')
                }
              }}
            >
              Собрать отчёт
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={isLoading ? "Ожидание ответа..." : "Напишите сообщение..."}
          className="flex-1 resize-none bg-muted border-0 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary max-h-24 disabled:opacity-50 disabled:cursor-not-allowed text-foreground placeholder:text-muted-foreground font-system"
          rows={1}
          disabled={isLoading}
          maxLength={500}
        />
        
        <button
          onClick={handleSubmit}
          disabled={isLoading || !input.trim()}
          className="bg-primary hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground text-primary-foreground p-2 rounded-lg transition-all duration-200 flex-shrink-0 shadow-sm hover:shadow-md disabled:shadow-none disabled:cursor-not-allowed"
          title={isLoading ? "Ожидание ответа..." : "Отправить сообщение"}
        >
          {isLoading ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Send size={14} />
          )}
        </button>
      </div>
    </div>
  )
} 