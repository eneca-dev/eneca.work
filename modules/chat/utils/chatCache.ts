import { ChatMessage, ChatContextMessage } from '../types/chat'

const MAX_MESSAGES = 10

// Ключ с userId для изоляции пользователей
const getStorageKey = (userId: string) => `eneca_chat_${userId}`

export function saveMessage(message: ChatMessage, userId: string): void {
  if (typeof window === 'undefined' || !userId) return
  
  try {
    const history = getHistory(userId)
    const updated = [...history, message].slice(-MAX_MESSAGES)
    sessionStorage.setItem(getStorageKey(userId), JSON.stringify(updated))
  } catch (error) {
    console.warn('Не удалось сохранить сообщение:', error)
  }
}

export function getHistory(userId: string): ChatMessage[] {
  if (typeof window === 'undefined' || !userId) return []
  
  try {
    const stored = sessionStorage.getItem(getStorageKey(userId))
    if (!stored) return []
    
    const messages = JSON.parse(stored)
    // Гарантируем, что timestamp является Date объектом
    return messages.map((msg: any) => ({
      ...msg,
      timestamp: new Date(msg.timestamp)
    }))
  } catch (error) {
    console.warn('Не удалось загрузить историю из кеша:', error)
    return []
  }
}

export function getContextForRequest(userId: string): ChatContextMessage[] {
  const history = getHistory(userId)
  
  // Берем последние 8 сообщений (4 пары вопрос-ответ) для контекста
  return history.slice(-8).map(msg => ({
    role: msg.role,
    content: msg.content,
    timestamp: msg.timestamp
  }))
}

export function clearHistory(userId: string): void {
  if (typeof window === 'undefined' || !userId) return
  
  try {
    sessionStorage.removeItem(getStorageKey(userId))
  } catch (error) {
    console.warn('Не удалось очистить историю:', error)
  }
}

export function getMessagesCount(userId: string): number {
  return getHistory(userId).length
}

export function hasHistory(userId: string): boolean {
  return getHistory(userId).length > 0
} 