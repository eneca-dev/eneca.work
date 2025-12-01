import { ChatRequest, ChatResponse } from '../types/chat'
import { createClient } from '@/utils/supabase/client'

export async function sendChatMessage(request: ChatRequest): Promise<ChatResponse> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session?.access_token) {
    throw new Error('Не авторизован')
  }

  const response = await fetch('/api/chat/python', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ message: request.message })
  })

  if (!response.ok) {
    throw new Error('Ошибка сервера')
  }

  const data = await response.json()
  return { message: data.message }
}
