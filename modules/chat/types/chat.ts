export interface ChatMessage {
  id: string
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
  id: string | null
  email: string | null
  name: string
  profile: any
  permissions: string[]
  activePermission: string | null
  permissionLabel: string | null
  isAuthenticated: boolean
}

export interface UserContext {
  jwt: JWTUserData
  store: UserStoreData
}

export interface ChatRequest {
  message: string
  userId?: string
  userContext?: UserContext
  systemRules?: string
}

export interface ChatResponse {
  message: string
} 