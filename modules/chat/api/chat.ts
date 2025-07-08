import { ChatRequest, ChatResponse, ChatRequestWithHistory } from '../types/chat'
import { createClient } from '@/utils/supabase/client'
import { useUserStore } from '@/stores/useUserStore'
import { getContextForRequest } from '../utils/chatCache'

// Чат теперь работает через n8n webhook
// n8n принимает запрос и пересылает его на backend сервер

export async function sendChatMessage(request: ChatRequest): Promise<ChatResponse> {
  try {
    // Получаем JWT токен из Supabase
    const supabase = createClient()
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError || !session?.access_token) {
      throw new Error('Не удалось получить токен аутентификации')
    }

    // Получаем информацию о пользователе из JWT и store
    const userStore = useUserStore.getState()
    const userId = userStore.id
    
    // Получаем контекст предыдущих сообщений только для авторизованного пользователя
    const conversationHistory = userId && typeof window !== 'undefined' 
      ? getContextForRequest(userId) 
      : []
    
    // Отправляем запрос на n8n webhook
    const response = await fetch('https://eneca.app.n8n.cloud/webhook-test/0378ba55-d98b-4983-b0ef-83a0ac4ee28c', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: request.message,
        userContext: {
          jwt: session.access_token,
          user: session.user,
          store: {
            name: userStore.name,
            email: userStore.email,
            permissionLabel: userStore.getActivePermission() ? userStore.getPermissionLabel(userStore.getActivePermission()!) : null,
            profile: userStore.profile
          }
        },
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
    
    // Если ошибка не является Error объектом
    console.error('Неизвестный тип ошибки:', typeof error, error)
    throw new Error('Неизвестная ошибка при отправке сообщения')
  }
}