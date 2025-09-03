import { useEffect, useRef } from 'react'
import { ChatMessage } from '../types/chat'
import { formatMessageTime } from '../utils/formatTime'
import { MarkdownRenderer } from './MarkdownRenderer'

interface MessageListProps {
  messages: ChatMessage[]
  isLoading: boolean
}

function TypingIndicator() {
  return (
    <div className="flex justify-start mt-1">
      <div className="bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1.5 shadow-sm">
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-500 dark:text-gray-400">Печатаю</span>
          <div className="flex items-center space-x-1">
            <span className="text-lg text-gray-400 dark:text-gray-500 animate-bounce inline-block" style={{animationDelay: '0s'}}>•</span>
            <span className="text-lg text-gray-400 dark:text-gray-500 animate-bounce inline-block" style={{animationDelay: '0.2s'}}>•</span>
            <span className="text-lg text-gray-400 dark:text-gray-500 animate-bounce inline-block" style={{animationDelay: '0.4s'}}>•</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export function MessageList({ messages, isLoading }: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Автоскролл к новым сообщениям
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/30 dark:bg-gray-900/30">
      {messages.map((message) => (
        <div
          key={message.id}
          className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          <div
            className={`px-4 py-2 rounded-lg shadow-sm break-words ${
              message.role === 'user'
                ? 'max-w-[80%] bg-gradient-to-r from-emerald-500 to-emerald-600 text-white relative'
                : 'max-w-[100%] bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 border border-gray-200 dark:border-gray-600'
            }`}
            style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}
          >
            {message.role === 'user' ? (
              // Структура для сообщений пользователя - время справа от текста
              <>
                <div className="pr-12">
                  <MarkdownRenderer 
                    content={message.content}
                    isUserMessage={true}
                  />
                </div>
                <span className="absolute bottom-2 right-3 text-xs text-emerald-100">
                  {formatMessageTime(message.timestamp)}
                </span>
              </>
            ) : (
              // Структура для сообщений агента - время под текстом
              <>
                <div className="mb-1">
                  <MarkdownRenderer 
                    content={message.content}
                    isUserMessage={false}
                  />
                </div>
                <div className="text-xs mt-1 text-gray-500 dark:text-gray-400 text-right">
                  {formatMessageTime(message.timestamp)}
                </div>
              </>
            )}
          </div>
        </div>
      ))}
      
      {isLoading && <TypingIndicator />}
      
      <div ref={messagesEndRef} />
    </div>
  )
} 