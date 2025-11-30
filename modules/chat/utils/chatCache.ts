import { ChatMessage } from '../types/chat'

const MAX_MESSAGES = 10
const getStorageKey = (userId: string) => `eneca_chat_${userId}`

export function saveMessage(message: ChatMessage, userId: string): void {
  if (typeof window === 'undefined' || !userId) return

  try {
    const history = getHistory(userId)
    const updated = [...history, message].slice(-MAX_MESSAGES)
    localStorage.setItem(getStorageKey(userId), JSON.stringify(updated))
  } catch (error) {
    console.warn('Ошибка сохранения сообщения:', error)
  }
}

export function getHistory(userId: string): ChatMessage[] {
  if (typeof window === 'undefined' || !userId) return []

  try {
    const stored = localStorage.getItem(getStorageKey(userId))
    if (!stored) return []

    const messages = JSON.parse(stored)
    return messages.map((msg: any) => ({
      ...msg,
      timestamp: new Date(msg.timestamp)
    }))
  } catch (error) {
    console.warn('Ошибка загрузки истории:', error)
    return []
  }
}

export function clearHistory(userId: string): void {
  if (typeof window === 'undefined' || !userId) return

  try {
    localStorage.removeItem(getStorageKey(userId))
  } catch (error) {
    console.warn('Ошибка очистки истории:', error)
  }
}

export function getMessagesCount(userId: string): number {
  return getHistory(userId).length
}

export function hasHistory(userId: string): boolean {
  return getHistory(userId).length > 0
}
