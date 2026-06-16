// Типы модуля meetings (личные проекты с протоколами созвонов).
// Фаза 1: мок-данные. Реальные таблицы БД и парсинг .docx — последующие этапы.

export interface MeetingProtocol {
  id: string
  projectId: string
  /** Название протокола, напр. «Протокол созвона по API» */
  title: string
  /** Дата созвона, ISO-строка */
  meetingDate: string
  participants: string[]
  /** Имя исходного файла, напр. «protocol-2026-06-10.docx» */
  fileName: string
  fileSizeKb: number
  /** Текст протокола (HTML). На фазе мок-данных — заранее подготовленный текст. */
  contentHtml: string
}

export interface PersonalProject {
  id: string
  name: string
  description?: string
  /** Дата последнего обновления, ISO-строка */
  updatedAt: string
}

export interface MeetingsState {
  /** Источник правды (фаза 1): сид из mock-data, мутабельный для CRUD-прототипа. */
  projects: PersonalProject[]
  protocols: MeetingProtocol[]
  selectedProjectId: string | null
  selectedProtocolId: string | null
  searchQuery: string
}

export interface MeetingsActions {
  selectProject: (projectId: string | null) => void
  selectProtocol: (protocolId: string | null) => void
  setSearchQuery: (query: string) => void

  // CRUD на мок-данных (in-memory, без persist; реальный бэкенд — MT-002)
  addProject: (name: string) => void
  renameProject: (projectId: string, name: string) => void
  deleteProject: (projectId: string) => void
  /** Заглушка: создаёт протокол-плейсхолдер (реальная загрузка .docx — MT-003). */
  addProtocol: (projectId: string, title: string) => void
  deleteProtocol: (protocolId: string) => void
}
