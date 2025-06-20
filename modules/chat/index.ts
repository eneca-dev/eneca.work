// Экспорт компонентов
export { ChatInterface } from './components/ChatInterface'
export { MessageList } from './components/MessageList'
export { MessageInput } from './components/MessageInput'

// Экспорт хуков
export { useChat } from './hooks/useChat'

// Экспорт API
export { sendChatMessage } from './api/chat'

// Экспорт типов
export type { ChatMessage, ChatRequest, ChatResponse } from './types/chat' 