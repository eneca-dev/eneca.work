import { useState, useRef, useEffect } from 'react'
import { Send } from 'lucide-react'

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
      handleSubmit()
    }
  }

  return (
    <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 rounded-b-xl">
      <div className="flex items-center space-x-2">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Напишите сообщение..."
          className="flex-1 resize-none bg-gray-100 dark:bg-gray-700 border-0 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 max-h-24 disabled:opacity-50 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 font-system"
          rows={1}
          disabled={isLoading}
          maxLength={500}
        />
        
        <button
          onClick={handleSubmit}
          disabled={isLoading || !input.trim()}
          className="bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white p-2 rounded-lg transition-all duration-200 flex-shrink-0 shadow-sm hover:shadow-md disabled:shadow-none"
          title="Отправить сообщение"
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