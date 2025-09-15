import { useState, useCallback, useRef, useEffect } from 'react'
import { ChatMessage } from '../types/chat'
import { sendChatMessage } from '../api/chat'
import { getHistory, saveMessage, clearHistory } from '../utils/chatCache'
import { useUserStore } from '@/stores/useUserStore'
import { useSidebarState } from '@/hooks/useSidebarState'
import { createClient } from '@/utils/supabase/client'

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [input, setInput] = useState('')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [chatSize, setChatSize] = useState({ width: 320, height: 448 }) // 28rem = 448px
  const [isResizing, setIsResizing] = useState(false)
  const resizeRef = useRef<{ startX: number; startY: number; startWidth: number; startHeight: number } | null>(null)
  const [conversationId, setConversationId] = useState<string>('')
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null)
  const [isSubscribed, setIsSubscribed] = useState<boolean>(false)
  const [lastEventAt, setLastEventAt] = useState<Date | null>(null)
  const [lastEventKind, setLastEventKind] = useState<string | null>(null)
  const [lastError, setLastError] = useState<string | null>(null)
  const [lastLatencyMs, setLastLatencyMs] = useState<number | null>(null)

  const userStore = useUserStore()
  const userId = userStore.id
  const { collapsed } = useSidebarState()

  // Загружаем историю только при наличии авторизованного пользователя
  useEffect(() => {
    if (typeof window !== 'undefined' && userId && userStore.isAuthenticated) {
      const cachedMessages = getHistory(userId)
      if (cachedMessages.length > 0) {
        setMessages(cachedMessages)
      }
    } else {
      // Очищаем состояние если пользователь не авторизован
      setMessages([])
    }
  }, [userId, userStore.isAuthenticated])

  // ---- Realtime: управление беседой и подпиской ----
  const subscribeToConversation = useCallback(async (convId: string) => {
    if (!convId) return
    const supabase = createClient()
    // cleanup предыдущего канала
    if (channelRef.current) {
      try { channelRef.current.unsubscribe() } catch {}
      channelRef.current = null
    }
    const channel = supabase
      .channel(`realtime:chat:${convId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `conversation_id=eq.${convId}` },
        (payload) => {
          const row: any = payload.new
          const role: 'user' | 'assistant' = row.role === 'user' ? 'user' : 'assistant'
          // Обозначаем тип мыслей префиксом для визуального отличия
          const kind = row.kind as string | undefined
          const prefix = kind && kind !== 'message' ? `(${kind}) ` : ''
          const evt: ChatMessage = {
            id: row.id,
            role,
            content: `${prefix}${row.content ?? ''}`,
            timestamp: new Date(row.created_at ?? Date.now()),
          }
          setMessages(prev => [...prev, evt])
          setLastEventAt(new Date())
          setLastEventKind(kind ?? 'message')
        }
      )
      .subscribe()
    channelRef.current = channel
    setIsSubscribed(true)
  }, [])

  const ensureConversation = useCallback(async (): Promise<string> => {
    if (conversationId) return conversationId
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return ''
    // создаём беседу
    const { data, error } = await supabase
      .from('chat_conversations')
      .insert({ user_id: user.id, status: 'active' })
      .select('id')
      .single()
    if (error) {
      console.error('Не удалось создать беседу:', error)
      return ''
    }
    setConversationId(data.id)
    // подписываемся
    subscribeToConversation(data.id)
    return data.id
  }, [conversationId, subscribeToConversation])

  // Автоподписка при наличии conversationId
  useEffect(() => {
    if (conversationId) {
      subscribeToConversation(conversationId)
    }
    return () => {
      if (channelRef.current) {
        try { channelRef.current.unsubscribe() } catch {}
        channelRef.current = null
      }
      setIsSubscribed(false)
    }
  }, [conversationId, subscribeToConversation])

  const toggleChat = useCallback(() => {
    setIsOpen(!isOpen)
  }, [isOpen])

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen(!isFullscreen)
  }, [isFullscreen])

  // Обработчики для resize
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    if (isFullscreen) return
    
    e.preventDefault()
    setIsResizing(true)
    
    resizeRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startWidth: chatSize.width,
      startHeight: chatSize.height
    }
  }, [isFullscreen, chatSize])

  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!isResizing || !resizeRef.current || isFullscreen) return
    
    const deltaX = resizeRef.current.startX - e.clientX // Инвертируем для левого края
    const deltaY = resizeRef.current.startY - e.clientY // Инвертируем для верхнего края
    
    // Максимальная ширина: не заходить на левый сайдбар
    const sidebarWidth = collapsed ? 80 : 256
    const rightMargin = 16 // соответствует right-4
    const safeGap = 8 // небольшой отступ от сайдбара
    const maxAllowedWidth = Math.max(280, window.innerWidth - sidebarWidth - rightMargin - safeGap)

    const newWidth = Math.max(280, Math.min(maxAllowedWidth, resizeRef.current.startWidth + deltaX))
    const newHeight = Math.max(400, Math.min(window.innerHeight * 0.9, resizeRef.current.startHeight + deltaY))
    
    setChatSize({ width: newWidth, height: newHeight })
  }, [isResizing, isFullscreen, collapsed])

  const handleResizeEnd = useCallback(() => {
    setIsResizing(false)
    resizeRef.current = null
  }, [])

  // Эффект для добавления глобальных обработчиков мыши
  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleResizeMove)
      document.addEventListener('mouseup', handleResizeEnd)
      document.body.style.cursor = 'nw-resize'
      document.body.style.userSelect = 'none'
      
      return () => {
        document.removeEventListener('mousemove', handleResizeMove)
        document.removeEventListener('mouseup', handleResizeEnd)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }
    }
  }, [isResizing, handleResizeMove, handleResizeEnd])

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isLoading || !userId) return

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      timestamp: new Date()
    }

    // Сохраняем сообщение пользователя в кеш с userId
    saveMessage(userMessage, userId)
    setMessages(prev => [...prev, userMessage])
    setIsLoading(true)

    try {
      // Обеспечиваем наличие беседы и realtime-подписки
      await ensureConversation()
      const startedAt = Date.now()
      const response = await sendChatMessage({
        message: content
      })
      setLastLatencyMs(Date.now() - startedAt)

      const botMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: response.message,
        timestamp: new Date()
      }

      // Сохраняем ответ бота в кеш с userId
      saveMessage(botMessage, userId)
      setMessages(prev => [...prev, botMessage])
    } catch (error) {
      console.error('Chat error:', error)
      if (error instanceof Error) {
        setLastError(error.message)
      } else {
        setLastError('Unknown error')
      }
      
      let errorText = 'Извините, произошла ошибка. Попробуйте еще раз.'
      
      if (error instanceof Error) {
        if (error.message.includes('токен')) {
          errorText = 'Ошибка аутентификации. Попробуйте перезайти в систему.'
        } else if (error.message.includes('сервер')) {
          errorText = 'Сервер временно недоступен. Попробуйте позже.'
        } else {
          errorText = error.message
        }
      }
      
      const errorMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: errorText,
        timestamp: new Date()
      }
      
      // Сохраняем сообщение об ошибке в кеш с userId
      saveMessage(errorMessage, userId)
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }, [isLoading, userId])

  const clearMessages = useCallback(() => {
    if (!userId) return
    
    // Очищаем и кеш, и состояние с userId
    clearHistory(userId)
    setMessages([])
  }, [userId])

  return {
    messages,
    isLoading,
    isOpen,
    input,
    setInput,
    toggleChat,
    toggleFullscreen,
    sendMessage,
    clearMessages,
    isFullscreen,
    chatSize,
    setChatSize,
    handleResizeStart,
    isResizing,
    conversationId,
    setConversationId,
    startConversation: ensureConversation,
    debug: {
      isSubscribed,
      lastEventAt,
      lastEventKind,
      lastError,
      lastLatencyMs,
    }
  }
} 