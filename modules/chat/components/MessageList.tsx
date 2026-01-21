import { useEffect, useRef } from 'react'
import { ChatMessage } from '../types/chat'
import { formatMessageTime } from '../utils/formatTime'
import { MarkdownRenderer } from './MarkdownRenderer'

interface MessageListProps {
  messages: ChatMessage[]
  isLoading: boolean
  isTyping?: boolean
}

function TypingIndicator() {
  return (
    <div className="flex justify-start mt-1">
      <div className="bg-card text-foreground border border-border rounded-lg px-3 py-1.5 shadow-sm">
        <div className="flex items-center space-x-2">
          <span className="text-sm text-muted-foreground">Печатаю</span>
          <div className="flex items-center space-x-1">
            <span className="text-lg text-muted-foreground animate-bounce inline-block" style={{animationDelay: '0s'}}>•</span>
            <span className="text-lg text-muted-foreground animate-bounce inline-block" style={{animationDelay: '0.2s'}}>•</span>
            <span className="text-lg text-muted-foreground animate-bounce inline-block" style={{animationDelay: '0.4s'}}>•</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export function MessageList({ messages, isLoading, isTyping }: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Автоскролл к новым сообщениям
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading, isTyping])

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/30">
      {messages.map((message) => (
        <div
          key={message.id}
          className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          <div
            className={`px-4 py-2 rounded-lg shadow-sm break-words ${
              message.role === 'user'
                ? 'max-w-[80%] bg-gradient-to-r from-emerald-500 to-emerald-600 text-white relative'
                : 'max-w-[100%] bg-card text-foreground border border-border'
            }`}
            style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}
          >
            {message.role === 'user' ? (
              <>
                <div className="pr-12">
                  <MarkdownRenderer
                    content={message.content}
                    isUserMessage={true}
                  />
                </div>
                <span className="absolute bottom-2 right-3 text-xs text-emerald-100">
                  {formatMessageTime(message.created_at)}
                </span>
              </>
            ) : (
              <>
                <div className="mb-1">
                  <MarkdownRenderer
                    content={message.content}
                    isUserMessage={false}
                  />
                </div>
                <div className="text-xs mt-1 text-muted-foreground text-right">
                  {formatMessageTime(message.created_at)}
                </div>
              </>
            )}
          </div>
        </div>
      ))}
      
      {(isTyping || isLoading) && <TypingIndicator />}
      
      <div ref={messagesEndRef} />
    </div>
  )
} 