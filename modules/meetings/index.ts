// Публичный API модуля meetings (read-only отчёты о созвонах от Teams-бота).

export { MeetingsPanel } from './components/MeetingsPanel'
export { useMeetingsStore } from './store'
export { useMeetingReports } from './hooks/use-meeting-reports'
export { searchReports } from './search'
export type {
  MeetingReport,
  ProtocolReport,
  ReportPerson,
  ReportDiscussionItem,
  ReportOpenQuestion,
  MeetingsUiState,
  MeetingsUiActions,
} from './types'
