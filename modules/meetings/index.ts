// Публичный API модуля meetings (личные проекты + протоколы созвонов).

export { MeetingsPanel } from './components/MeetingsPanel'
export { useMeetingsStore } from './store'
export { searchProtocols, stripHtml } from './search'
export { mockProjects, mockProtocols } from './mock-data'
export type {
  PersonalProject,
  MeetingProtocol,
  MeetingsState,
  MeetingsActions,
} from './types'
