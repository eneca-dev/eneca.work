import { ChatMessage, ChatContextMessage, ChatAgentType } from '../types/chat'

const MAX_MESSAGES = 10

// Ключ с userId для изоляции пользователей
const getStorageKey = (userId: string) => `eneca_chat_${userId}`

export function saveMessage(message: ChatMessage, userId: string): void {
  if (typeof window === 'undefined' || !userId) return
  
  try {
    const history = getHistory(userId)
    // Дедупликация: если последнее сообщение эквивалентно по роли, виду и содержимому — заменяем, иначе добавляем
    const last = history.length > 0 ? history[history.length - 1] as ChatMessage : undefined
    type MessageKind = NonNullable<ChatMessage['kind']>
    const allowedKinds: readonly MessageKind[] = ['thinking','tool','observation','message'] as const
    const normalizeKind = (k?: ChatMessage['kind']): MessageKind => {
      const v = (k ?? 'message') as string
      const normalized = v.toLowerCase().trim() as MessageKind
      return (allowedKinds as readonly string[]).includes(normalized) ? normalized : 'message'
    }
    const isEquivalent = (a?: ChatMessage, b?: ChatMessage): boolean => {
      if (!a || !b) return false
      const kindA = normalizeKind(a.kind)
      const kindB = normalizeKind(b.kind)
      const contentA = (a.content?.trim?.() ?? '')
      const contentB = (b.content?.trim?.() ?? '')
      return a.role === b.role && kindA === kindB && contentA === contentB
    }
    const updatedBase = isEquivalent(last, message) ? [...history.slice(0, -1), message] : [...history, message]
    const updated = updatedBase.slice(-MAX_MESSAGES)
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

// Agent type persistence
const AGENT_TYPE_KEY = 'eneca_chat_agent_type'

export function saveAgentType(agentType: ChatAgentType): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(AGENT_TYPE_KEY, agentType)
  } catch (error) {
    console.warn('Не удалось сохранить тип агента:', error)
  }
}

export function getAgentType(): ChatAgentType {
  if (typeof window === 'undefined') return 'n8n'
  try {
    const stored = localStorage.getItem(AGENT_TYPE_KEY)
    return (stored === 'python' || stored === 'n8n') ? stored : 'n8n'
  } catch (error) {
    console.warn('Не удалось загрузить тип агента:', error)
    return 'n8n'
  }
} 