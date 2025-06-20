import { ChatRequest, ChatResponse } from '../types/chat'
import { createClient } from '@/utils/supabase/client'
import { useUserStore } from '@/stores/useUserStore'

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
    
    // Отправляем запрос на сервер чата
    const response = await fetch('http://localhost:5000/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: request.message,
        userContext: {
          jwt: session.user,
          store: {
            name: userStore.name,
            email: userStore.email,
            permissionLabel: userStore.getActivePermission() ? userStore.getPermissionLabel(userStore.getActivePermission()!) : null,
            profile: userStore.profile
          }
        }
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
      throw new Error('Не удалось подключиться к серверу. Проверьте что сервер запущен на порту 5000.')
    }
    
    if (error instanceof Error) {
      throw error
    }
    
    // Если ошибка не является Error объектом
    console.error('Неизвестный тип ошибки:', typeof error, error)
    throw new Error('Неизвестная ошибка при отправке сообщения')
  }
}

// Реальная реализация (будет раскомментирована после создания Edge Function)
/*
import { createClient } from '@/utils/supabase/client'

export async function sendChatMessage(request: ChatRequest): Promise<ChatResponse> {
  const supabase = createClient()
  
  const { data, error } = await supabase.functions.invoke('chat', {
    body: request
  })
  
  if (error) {
    throw new Error(error.message || 'Ошибка чата')
  }
  
  return data
}
*/ 