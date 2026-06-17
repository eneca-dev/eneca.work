// Типы модуля meetings: read-only отчёты о созвонах от Teams-бота (recall.ai).
// Источник — таблица meeting_reports в отдельном Supabase-проекте.

/** Человек в протоколе (участник/автор). Email в данных пока нет — только имя/роль/организация. */
export interface ReportPerson {
  name: string
  role?: string | null
  organization?: string | null
}

export interface ReportDiscussionItem {
  topic?: string | null
  status?: string | null
  outcome?: string | null
  deadline?: string | null
  responsible?: string | null
}

export interface ReportOpenQuestion {
  question?: string | null
  comment?: string | null
  deadline?: string | null
  responsible?: string | null
}

export interface ReportRisk {
  description?: string | null
  comment?: string | null
  responsible?: string | null
  deadline?: string | null
}

/** Содержимое колонки meeting_reports.report (jsonb) — структурированный протокол. */
export interface ProtocolReport {
  date?: string | null
  subject?: string | null
  project?: string | null
  duration?: string | null
  location?: string | null
  author?: ReportPerson | null
  participants?: ReportPerson[] | null
  preview_summary?: string | null
  discussion_items?: ReportDiscussionItem[] | null
  open_questions?: ReportOpenQuestion[] | null
  risks?: ReportRisk[] | null
  transcript_url?: string | null
  previous_protocol_url?: string | null
}

/** Строка meeting_reports (нужные колонки). */
export interface MeetingReport {
  id: string
  created_at: string
  subject: string | null
  meeting_date: string | null
  meeting_started_at: string | null
  status: string
  invited_by_name: string | null
  protocol_docx_url: string | null
  transcript_docx_url: string | null
  report: ProtocolReport | null
}

/** Локальная «папка» для группировки созвонов (прототип; хранится в localStorage). */
export interface MeetingFolder {
  id: string
  name: string
}

/** Спецзначение фильтра «Без папки». null = «Все». */
export const UNFILED_FOLDER = '__unfiled__'

// UI-состояние (клиентское; данные созвонов — через TanStack Query).
// folders/assignments/selectedFolderId персистятся в localStorage.
export interface MeetingsUiState {
  selectedReportId: string | null
  searchQuery: string
  /** Фильтр: null = все, UNFILED_FOLDER = без папки, иначе id папки. */
  selectedFolderId: string | null
  folders: MeetingFolder[]
  /** reportId → folderId. */
  assignments: Record<string, string>
}

export interface MeetingsUiActions {
  selectReport: (id: string | null) => void
  setSearchQuery: (query: string) => void
  selectFolder: (id: string | null) => void
  addFolder: (name: string) => void
  renameFolder: (id: string, name: string) => void
  deleteFolder: (id: string) => void
  /** Назначить созвон в папку (folderId = null — убрать из папки). */
  assignReport: (reportId: string, folderId: string | null) => void
}
