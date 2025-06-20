export interface Notion {
  notion_id: string
  notion_created_by: string
  notion_created_at: string
  notion_updated_at: string
  notion_content: string
  notion_done: boolean
}

export interface NotionInput {
  notion_content: string
}

export interface NotionUpdate {
  notion_content?: string
  notion_done?: boolean
}

// Вспомогательные интерфейсы для работы с заголовками в контенте
export interface ParsedNotion {
  title: string
  content: string
}

export interface NotionsFilter {
  search?: string
  done?: boolean
}

export interface NotionsState {
  notions: Notion[]
  selectedNotions: string[]
  searchQuery: string
  isLoading: boolean
  error: string | null
}

export interface NotionsMutations {
  fetchNotions: (filter?: NotionsFilter) => Promise<void>
  createNotion: (input: NotionInput) => Promise<void>
  updateNotion: (id: string, update: NotionUpdate) => Promise<void>
  deleteNotion: (id: string) => Promise<void>
  deleteNotions: (ids: string[]) => Promise<void>
  toggleNotionDone: (id: string) => Promise<void>
  setSelectedNotions: (ids: string[]) => void
  setSearchQuery: (query: string) => void
  selectAllNotions: () => void
  clearSelectedNotions: () => void
  markNotionsAsDone: (ids: string[]) => Promise<void>
  markNotionsAsUndone: (ids: string[]) => Promise<void>
} 