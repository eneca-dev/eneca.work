import { ChatRequest, ChatResponse, ChatRequestWithHistory, ChatAgentType } from '../types/chat'
import { createClient } from '@/utils/supabase/client'
import { useUserStore } from '@/stores/useUserStore'
import { getContextForRequest } from '../utils/chatCache'
import * as Sentry from '@sentry/nextjs'

export async function sendChatMessage(request: ChatRequest, agentType: ChatAgentType = 'n8n'): Promise<ChatResponse> {
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

    // Выбор endpoint в зависимости от типа агента
    const endpoint = agentType === 'python' ? '/api/chat/python' : '/api/chat'

    const payload = {
      message: request.message,
      conversationHistory: conversationHistory,
      conversationId: request.conversationId,
    }
    console.debug(`sendChatMessage payload → ${endpoint} (agent: ${agentType})`, payload)
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      let errorMessage = `Ошибка сервера: ${response.status}`
      try {
        const errorData = await response.json()
        const serverMsg = (errorData?.message || errorData?.error || '').toString()
        if (serverMsg) errorMessage = serverMsg
      } catch (e) {
        console.warn('Не удалось распарсить ошибку сервера:', e)
      }
      // Санитизация: убираем HTML из ошибок, маппим таймауты
      if (/<!DOCTYPE|<html/i.test(errorMessage)) {
        errorMessage = 'Сервис временно недоступен. Попробуйте позже.'
      }
      if (response.status === 504 || /таймаут|timeout/i.test(errorMessage)) {
        errorMessage = 'Таймаут: сервис не ответил вовремя. Попробуйте позже.'
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