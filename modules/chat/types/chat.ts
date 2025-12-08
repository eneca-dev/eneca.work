export interface ChatMessage {
  id: string
  conversation_id: string
  user_id: string
  role: 'user' | 'assistant' | 'system'
  kind: 'message' | 'thinking' | 'tool' | 'observation'
  content: string
  is_final: boolean
  created_at: Date
}

export interface ChatConversation {
  id: string
  user_id: string
  task_id?: string
  status: 'active' | 'closed'
  created_at: Date
}

export interface ChatRequest {
  message: string
}

export interface ChatResponse {
  message: string
}
