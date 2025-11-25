import { useState, useCallback, useRef, useEffect } from 'react'
import { ChatMessage, ChatEnv } from '../types/chat'
import { sendChatMessage } from '../api/chat'
import { getHistory, saveMessage, clearHistory } from '../utils/chatCache'
import { useUserStore } from '@/stores/useUserStore'
import { useSidebarState } from '@/hooks/useSidebarState'
import { createClient } from '@/utils/supabase/client'

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [input, setInput] = useState('')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [chatSize, setChatSize] = useState({ width: 320, height: 448 }) // 28rem = 448px
  const [isResizing, setIsResizing] = useState(false)
  const resizeRef = useRef<{ startX: number; startY: number; startWidth: number; startHeight: number } | null>(null)
  const [conversationId, setConversationId] = useState<string>('')
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null)
  // Флаг ожидания финального ответа текущего запроса
  const awaitingFinalRef = useRef<boolean>(false)
  // Ref для блокировки множественных отправок
  const isLoadingRef = useRef<boolean>(false)
  // Безопасный таймер авто-сброса индикатора печати
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [isSubscribed, setIsSubscribed] = useState<boolean>(false)
  const [lastEventAt, setLastEventAt] = useState<Date | null>(null)
  const [lastEventKind, setLastEventKind] = useState<string | null>(null)
  const [lastError, setLastError] = useState<string | null>(null)
  const [lastLatencyMs, setLastLatencyMs] = useState<number | null>(null)
  // env удалён — всегда используем прод вебхук через серверный gateway

  const userStore = useUserStore()
  const userId = userStore.id
  const { collapsed } = useSidebarState()

  // Допустимые виды серверных событий чата
  type MessageKind = NonNullable<ChatMessage['kind']>
  const allowedKinds: readonly MessageKind[] = ['thinking', 'tool', 'observation', 'message'] as const

  // Нормализация и валидация kind: приводим к нижнему регистру, проверяем против разрешённых значений
  const normalizeKind = (value: unknown): MessageKind => {
    if (typeof value !== 'string') return 'message'
    const normalized = value.toLowerCase().trim()
    return (allowedKinds as readonly string[]).includes(normalized) ? (normalized as MessageKind) : 'message'
  }

  // Сравнение сообщений для дедупликации (замены последнего локального)
  // Совпадение по: роли, виду (kind) и содержимому (content). content сравниваем после trim.
  const areMessagesEquivalentForDedupe = useCallback((a: ChatMessage | undefined, b: ChatMessage | undefined): boolean => {
    if (!a || !b) return false
    const kindA = a.kind ? normalizeKind(a.kind) : 'message'
    const kindB = b.kind ? normalizeKind(b.kind) : 'message'
    return a.role === b.role && kindA === kindB && (a.content?.trim?.() ?? '') === (b.content?.trim?.() ?? '')
  }, [])

  // Возвращает новый массив сообщений, где входящее событие заменяет последнее локальное, если оно эквивалентно
  const replaceLastIfDuplicateElseAppend = useCallback((prev: ChatMessage[], incoming: ChatMessage): ChatMessage[] => {
    const last = prev.length > 0 ? prev[prev.length - 1] : undefined
    if (areMessagesEquivalentForDedupe(last, incoming)) {
      return [...prev.slice(0, -1), incoming]
    }
    return [...prev, incoming]
  }, [areMessagesEquivalentForDedupe])

  // Запуск/сброс страховочного таймера индикатора печати (~1.5 мин)
  const startTypingSafetyTimer = useCallback(() => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }
    typingTimeoutRef.current = setTimeout(() => {
      // Авто-очистка на случай отсутствия финального события
      console.warn('[useChat] Safety timeout: финальное событие не получено, принудительно снимаем блокировку')
      setIsTyping(false)
      awaitingFinalRef.current = false
      isLoadingRef.current = false
      setIsLoading(false)
    }, 90000)
  }, [])

  const clearTypingSafetyTimer = useCallback(() => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
      typingTimeoutRef.current = null
    }
  }, [])

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
          // Сохраняем тип сообщения для презентации в UI
          const kind = normalizeKind(row.kind)
          const evt: ChatMessage = {
            id: row.id,
            role,
            kind,
            content: row.content ?? '',
            timestamp: new Date(row.created_at ?? Date.now()),
          }
          // Дедупликация: если последнее локально добавленное сообщение совпадает с приходящим, заменяем его, иначе добавляем
          setMessages(prev => replaceLastIfDuplicateElseAppend(prev, evt))
          setLastEventAt(new Date())
          setLastEventKind(kind ?? 'message')
          // Индикатор печати после HTTP: thinking/tool → включаем, observation → выключаем, message → выключаем
          if (role === 'assistant') {
            if (kind === 'observation' || kind === 'message') {
              // Финальное событие от n8n - снимаем все блокировки
              setIsTyping(false)
              awaitingFinalRef.current = false
              isLoadingRef.current = false
              setIsLoading(false)
              clearTypingSafetyTimer()
              console.debug('[useChat] Финальное событие получено:', kind)
            } else if (kind === 'thinking' || kind === 'tool') {
              setIsTyping(true)
              awaitingFinalRef.current = true
              startTypingSafetyTimer()
            } else {
              // Непредвиденный тип события — явно сбрасываем индикатор, чтобы не зависал
              setIsTyping(false)
              awaitingFinalRef.current = false
              isLoadingRef.current = false
              setIsLoading(false)
              clearTypingSafetyTimer()
            }
          }
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
      // Чистим таймер при размонтировании/отписке
      clearTypingSafetyTimer()
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
    // Защита от множественных отправок - проверяем и ref, и state
    if (!content.trim() || isLoadingRef.current || !userId) {
      console.debug('[useChat] Отправка заблокирована:', {
        isEmpty: !content.trim(),
        isLoading: isLoadingRef.current,
        hasUserId: !!userId
      })
      return
    }

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      timestamp: new Date()
    }

    // Сохраняем сообщение пользователя в кеш с userId
    saveMessage(userMessage, userId)
    // Дедупликация локального добавления: если предыдущее сообщение эквивалентно, заменяем его
    setMessages(prev => replaceLastIfDuplicateElseAppend(prev, userMessage))
    
    // Устанавливаем флаги загрузки
    isLoadingRef.current = true
    setIsLoading(true)
    setIsTyping(true)
    awaitingFinalRef.current = true
    startTypingSafetyTimer()

    try {
      // Обеспечиваем наличие беседы и realtime-подписки
      const ensuredConvId = await ensureConversation()
      const startedAt = Date.now()
      const response = await sendChatMessage({
        message: content,
        conversationId: ensuredConvId || conversationId || undefined,
      })
      setLastLatencyMs(Date.now() - startedAt)

      const botMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: response.message,
        timestamp: new Date(),
        kind: 'message',
      }

      // Сохраняем ответ бота в кеш с userId
      saveMessage(botMessage, userId)
      // Дедупликация: если последнее локальное сообщение совпадает, заменяем вместо добавления
      setMessages(prev => replaceLastIfDuplicateElseAppend(prev, botMessage))
<<<<<<< Updated upstream
      // После успешного HTTP-ответа продолжаем ждать финального события из realtime
      // НЕ сбрасываем isLoading/isLoadingRef - они будут сброшены при получении 'observation' или 'message'
      setIsTyping(true)
      awaitingFinalRef.current = true
      startTypingSafetyTimer()
      console.debug('[useChat] HTTP-ответ получен, ожидаем финальное событие от n8n')
=======

      // Для Python агента сразу завершаем, для N8N ждем realtime события
      if (agentType === 'python') {
        // Python агент: сразу сбрасываем индикаторы
        setIsTyping(false)
        awaitingFinalRef.current = false
        isLoadingRef.current = false
        setIsLoading(false)
        clearTypingSafetyTimer()
        console.debug('[useChat] Python агент: ответ получен и отображен')
      } else {
        // N8N агент: ждем финального события из realtime
        setIsTyping(true)
        awaitingFinalRef.current = true
        startTypingSafetyTimer()
        console.debug('[useChat] N8N: HTTP-ответ получен, ожидаем финальное событие от n8n')
      }
>>>>>>> Stashed changes
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
      // Дедупликация ошибок по тем же правилам
      setMessages(prev => replaceLastIfDuplicateElseAppend(prev, errorMessage))
      setIsTyping(false)
      awaitingFinalRef.current = false
      // При ошибке сбрасываем блокировку сразу
      isLoadingRef.current = false
      setIsLoading(false)
      clearTypingSafetyTimer()
    }
    // НЕ используем finally - isLoading сбросится только при получении финального события или ошибке
  }, [userId, conversationId, ensureConversation])

  const clearMessages = useCallback(() => {
    if (!userId) return
    
    // Очищаем и кеш, и состояние с userId
    clearHistory(userId)
    setMessages([])

    // Сбрасываем все флаги блокировки
    isLoadingRef.current = false
    setIsLoading(false)
    setIsTyping(false)
    awaitingFinalRef.current = false
    clearTypingSafetyTimer()
  }, [userId, clearTypingSafetyTimer])

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