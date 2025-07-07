// Экспорт компонентов
export { ChatInterface } from './components/ChatInterface'
export { MessageList } from './components/MessageList'
export { MessageInput } from './components/MessageInput'

// Экспорт хуков
export { useChat } from './hooks/useChat'

// Экспорт API
export { sendChatMessage } from './api/chat'

// Экспорт утилит
export { formatMessageTime, formatMessageDate, formatMessageDateTime } from './utils/formatTime'
export { 
  saveMessage, 
  getHistory, 
  getContextForRequest, 
  clearHistory, 
  getMessagesCount, 
  hasHistory 
} from './utils/chatCache'

// Экспорт типов
export type { 
  ChatMessage, 
  ChatRequest, 
  ChatResponse, 
  ChatHistory,
  ChatContextMessage,
  ChatRequestWithHistory 
} from './types/chat' 