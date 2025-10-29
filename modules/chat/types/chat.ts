export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  // тип серверного события для сообщений ассистента
  // 'message' — обычный ответ; 'thinking' — размышления; 'tool' — использование инструмента; 'observation' — наблюдение
  kind?: 'thinking' | 'tool' | 'observation' | 'message'
}

export interface ChatHistory {
  messages: ChatMessage[]
  lastUpdated: Date
  sessionId: string
}

export interface ChatContextMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

export interface JWTUserData {
  id: string
  email: string | undefined
  phone: string | undefined
  created_at: string
  last_sign_in_at: string | undefined
  user_metadata: any
  app_metadata: any
}

export interface UserStoreData {
  name: string
  email: string | null
  permissionLabel: string | null
  profile: any
}

export interface UserContext {
  jwt: string // JWT токен для аутентификации
  user: JWTUserData // Данные пользователя из сессии
  store: UserStoreData // Данные из store приложения
}

export type ChatEnv = 'dev' | 'prod'

export interface ChatRequest {
  message: string
  userId?: string
  userContext?: UserContext
  systemRules?: string
  conversationId?: string
  env?: ChatEnv
}

export interface ChatRequestWithHistory extends ChatRequest {
  conversationHistory?: ChatContextMessage[]
}

export interface ChatResponse {
  message: string
} 