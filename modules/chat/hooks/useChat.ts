import { useState, useCallback, useRef, useEffect } from 'react'
import { ChatMessage } from '../types/chat'
import { useUserStore } from '@/stores/useUserStore'
import { useSidebarState } from '@/hooks/useSidebarState'
import { createClient } from '@/utils/supabase/client'

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [input, setInput] = useState('')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [chatSize, setChatSize] = useState({ width: 320, height: 448 })
  const [isResizing, setIsResizing] = useState(false)
  const resizeRef = useRef<{ startX: number; startY: number; startWidth: number; startHeight: number } | null>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const userId = useUserStore(state => state.id)
  const { collapsed } = useSidebarState()
  const supabase = createClient()

  // Загрузка или создание conversation
  useEffect(() => {
    if (!userId) return

    const initConversation = async () => {
      try {
        // Пытаемся найти активный conversation
        const { data: existingConversation } = await supabase
          .from('chat_conversations')
          .select('*')
          .eq('user_id', userId)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        if (existingConversation) {
          setConversationId(existingConversation.id)
          await loadMessages(existingConversation.id)
        } else {
          // Создаём новый conversation
          const { data: newConversation } = await supabase
            .from('chat_conversations')
            .insert({
              user_id: userId,
              status: 'active'
            })
            .select()
            .single()

          if (newConversation) {
            setConversationId(newConversation.id)
          }
        }
      } catch (error) {
        console.error('Error initializing conversation:', error)
      }
    }

    initConversation()
  }, [userId, supabase])

  // Загрузка истории сообщений
  const loadMessages = async (convId: string) => {
    try {
      const { data } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('conversation_id', convId)
        .eq('kind', 'message')
        .order('created_at', { ascending: true })

      if (data) {
        setMessages(data.map(msg => ({
          ...msg,
          created_at: new Date(msg.created_at)
        })))
      }
    } catch (error) {
      console.error('Error loading messages:', error)
    }
  }

  // Realtime подписка на новые сообщения
  useEffect(() => {
    if (!conversationId || !userId) return

    console.log('[Realtime] Creating subscription for conversation:', conversationId)

    const channel = supabase
      .channel(`chat:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `conversation_id=eq.${conversationId}`
        },
        (payload) => {
          const newMessage = payload.new as ChatMessage
          console.log('[Realtime] Received message:', newMessage)

          setMessages(prev => {
            console.log('[Realtime] Current messages count:', prev.length)

            // Если это сообщение уже есть (по реальному ID) - пропускаем
            if (prev.some(m => m.id === newMessage.id)) {
              console.log('[Realtime] Message already exists, skipping')
              return prev
            }

            // Если это сообщение от пользователя, ищем и заменяем временное
            if (newMessage.role === 'user') {
              const tempMessages = prev.filter(m => m.id.startsWith('temp-'))
              console.log('[Realtime] Temp messages:', tempMessages)

              const tempIndex = prev.findIndex(m =>
                m.id.startsWith('temp-') &&
                m.content === newMessage.content &&
                m.role === 'user'
              )

              if (tempIndex !== -1) {
                // Заменяем временное на реальное
                console.log('[Realtime] Replacing temp message at index:', tempIndex)
                const updated = [...prev]
                updated[tempIndex] = {
                  ...newMessage,
                  created_at: new Date(newMessage.created_at)
                }
                return updated
              } else {
                console.log('[Realtime] No temp message found to replace')
              }
            }

            // Добавляем новое сообщение
            console.log('[Realtime] Adding new message')
            return [...prev, {
              ...newMessage,
              created_at: new Date(newMessage.created_at)
            }]
          })

          // Если пришёл финальный ответ от бота
          if (newMessage.role === 'assistant' && newMessage.is_final) {
            // Очищаем таймаут и останавливаем индикатор печати
            if (typingTimeoutRef.current) {
              clearTimeout(typingTimeoutRef.current)
              typingTimeoutRef.current = null
            }
            setIsLoading(false)
            setIsTyping(false)
          }
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] Subscription status:', status)
      })

    return () => {
      console.log('[Realtime] Unsubscribing')
      channel.unsubscribe()
      // Очищаем таймаут при размонтировании
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
    }
  }, [conversationId, userId, supabase])

  const toggleChat = useCallback(() => {
    setIsOpen(prev => !prev)
  }, [])

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen(prev => !prev)
  }, [])

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

    const deltaX = resizeRef.current.startX - e.clientX
    const deltaY = resizeRef.current.startY - e.clientY

    const sidebarWidth = collapsed ? 80 : 256
    const rightMargin = 16
    const safeGap = 8
    const maxAllowedWidth = Math.max(280, window.innerWidth - sidebarWidth - rightMargin - safeGap)

    const newWidth = Math.max(280, Math.min(maxAllowedWidth, resizeRef.current.startWidth + deltaX))
    const newHeight = Math.max(400, Math.min(window.innerHeight * 0.9, resizeRef.current.startHeight + deltaY))

    setChatSize({ width: newWidth, height: newHeight })
  }, [isResizing, isFullscreen, collapsed])

  const handleResizeEnd = useCallback(() => {
    setIsResizing(false)
    resizeRef.current = null
  }, [])

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
    if (!content.trim() || isLoading || !userId || !conversationId) return

    console.log('[sendMessage] Starting...', { userId, conversationId, content })

    setIsLoading(true)
    setIsTyping(true)

    // Optimistic UI update - сразу показываем сообщение пользователя
    const tempId = `temp-${Date.now()}`
    const optimisticMessage: ChatMessage = {
      id: tempId,
      conversation_id: conversationId,
      user_id: userId,
      role: 'user',
      kind: 'message',
      content,
      is_final: true,
      created_at: new Date()
    }

    setMessages(prev => [...prev, optimisticMessage])

    try {
      // Записываем в БД - это триггернёт webhook на Python агент
      const { data, error } = await supabase
        .from('chat_messages')
        .insert({
          conversation_id: conversationId,
          user_id: userId,
          role: 'user',
          kind: 'message',
          content,
          is_final: true
        })
        .select()

      if (error) {
        console.error('[sendMessage] Insert error:', error)
        // Удаляем optimistic сообщение при ошибке
        setMessages(prev => prev.filter(m => m.id !== tempId))
        throw error
      }

      console.log('[sendMessage] Insert success:', data)

      // Realtime автоматически заменит временное сообщение на реальное
      // Сбрасываем состояние загрузки сразу после успешной вставки
      setIsLoading(false)

      // Устанавливаем таймаут для isTyping (60 секунд) на случай если бот не ответит
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
      typingTimeoutRef.current = setTimeout(() => {
        console.warn('[useChat] Typing timeout - bot did not respond')
        setIsTyping(false)
      }, 60000) // 60 секунд
    } catch (error) {
      console.error('[sendMessage] Error:', error)

      // Показываем ошибку
      const errorMessage: ChatMessage = {
        id: crypto.randomUUID(),
        conversation_id: conversationId,
        user_id: userId,
        role: 'assistant',
        kind: 'message',
        content: 'Произошла ошибка при отправке сообщения. Попробуйте еще раз.',
        is_final: true,
        created_at: new Date()
      }

      setMessages(prev => [...prev, errorMessage])
      setIsLoading(false)
      setIsTyping(false)
    }
  }, [userId, conversationId, isLoading, supabase])

  const clearMessages = useCallback(async () => {
    if (!userId || !conversationId) return

    try {
      // Удаляем все сообщения из текущего conversation
      const { error: deleteError } = await supabase
        .from('chat_messages')
        .delete()
        .eq('conversation_id', conversationId)

      if (deleteError) {
        throw deleteError
      }

      // Очищаем сообщения в UI
      setMessages([])

      // Сбрасываем состояние печати
      setIsTyping(false)
      setIsLoading(false)

      console.log('[clearMessages] Messages deleted for conversation:', conversationId)
    } catch (error) {
      console.error('[clearMessages] Error:', error)
    }
  }, [userId, conversationId, supabase])

  return {
    messages,
    isLoading,
    isTyping,
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
  }
}
