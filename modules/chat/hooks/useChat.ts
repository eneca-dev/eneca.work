import { useState, useCallback, useRef, useEffect } from 'react'
import { ChatMessage } from '../types/chat'
import { sendChatMessage } from '../api/chat'
import { getHistory, saveMessage, clearHistory } from '../utils/chatCache'
import { useUserStore } from '@/stores/useUserStore'
import { useSidebarState } from '@/hooks/useSidebarState'

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [input, setInput] = useState('')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [chatSize, setChatSize] = useState({ width: 320, height: 448 })
  const [isResizing, setIsResizing] = useState(false)
  const resizeRef = useRef<{ startX: number; startY: number; startWidth: number; startHeight: number } | null>(null)

  const userId = useUserStore(state => state.id)
  const { collapsed } = useSidebarState()

  // Загрузка истории при монтировании
  useEffect(() => {
    if (userId) {
      const history = getHistory(userId)
      setMessages(history)
    }
  }, [userId])

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
    if (!content.trim() || isLoading || !userId) return

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    saveMessage(userMessage, userId)

    setIsLoading(true)
    setIsTyping(true)

    try {
      const response = await sendChatMessage({ message: content })

      const botMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: response.message,
        timestamp: new Date()
      }

      setMessages(prev => [...prev, botMessage])
      saveMessage(botMessage, userId)
    } catch (error) {
      const errorMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'Произошла ошибка. Попробуйте еще раз.',
        timestamp: new Date()
      }

      setMessages(prev => [...prev, errorMessage])
      saveMessage(errorMessage, userId)
    } finally {
      setIsLoading(false)
      setIsTyping(false)
    }
  }, [userId, isLoading])

  const clearMessages = useCallback(() => {
    if (!userId) return
    clearHistory(userId)
    setMessages([])
  }, [userId])

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
