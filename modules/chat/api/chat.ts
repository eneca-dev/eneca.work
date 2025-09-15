import { ChatRequest, ChatResponse, ChatRequestWithHistory } from '../types/chat'
import { createClient } from '@/utils/supabase/client'
import { useUserStore } from '@/stores/useUserStore'
import { getContextForRequest } from '../utils/chatCache'
import * as Sentry from '@sentry/nextjs'

export async function sendChatMessage(request: ChatRequest): Promise<ChatResponse> {
  try {
    // Получаем JWT токен из Supabase
    const supabase = createClient()
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError || !session?.access_token) {
      throw new Error('Не удалось получить токен аутентификации')
    }

    // Получаем информацию о пользователе из store
    const userStore = useUserStore.getState()
    const userId = userStore.id
    
    const conversationHistory = userId && typeof window !== 'undefined' 
      ? getContextForRequest(userId) 
      : []
    
    // Идём через наш гейт /api/chat (full switch)
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        message: request.message,
        conversationHistory: conversationHistory
      })
    })

    if (!response.ok) {
      let errorMessage = `Ошибка сервера: ${response.status}`
      try {
        const errorData = await response.json()
        if (errorData && typeof errorData.message === 'string') {
          errorMessage = errorData.message
        } else if (errorData && typeof errorData.error === 'string') {
          errorMessage = errorData.error
        }
      } catch (e) {
        // Если не удалось распарсить JSON, используем статус код
        console.warn('Не удалось распарсить ошибку сервера:', e)
      }
      Sentry.captureException(new Error(errorMessage), {
        tags: { module: 'chat', endpoint: 'gateway-client' },
        extra: { status: response.status }
      })
      throw new Error(errorMessage)
    }

    const data = await response.json()
    return {
      message: data.message
    }
  } catch (error) {
    console.error('Ошибка отправки сообщения:', error)
    
    // Более детальное логирование для отладки
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error('Не удалось подключиться к n8n webhook. Проверьте интернет-соединение и доступность сервиса.')
    }
    
    if (error instanceof Error) {
      throw error
    }
    
    console.error('Неизвестный тип ошибки:', typeof error, error)
    throw new Error('Неизвестная ошибка при отправке сообщения')
  }
}