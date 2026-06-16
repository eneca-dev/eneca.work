import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import { mockProjects, mockProtocols } from './mock-data'
import type { MeetingsState, MeetingsActions } from './types'

type MeetingsStore = MeetingsState & MeetingsActions

const nowIso = () => new Date().toISOString()

export const useMeetingsStore = create<MeetingsStore>((set) => ({
  // State (сид из мок-данных; мутабельный для CRUD-прототипа)
  projects: mockProjects,
  protocols: mockProtocols,
  selectedProjectId: null,
  selectedProtocolId: null,
  searchQuery: '',

  // Навигация / поиск
  // selectProject — это фильтр списка; открытый во вьюере протокол не сбрасывается.
  selectProject: (projectId) => set({ selectedProjectId: projectId }),
  selectProtocol: (protocolId) => set({ selectedProtocolId: protocolId }),
  setSearchQuery: (query) => set({ searchQuery: query }),

  // CRUD проектов
  addProject: (name) =>
    set((state) => ({
      projects: [{ id: uuidv4(), name: name.trim(), updatedAt: nowIso() }, ...state.projects],
    })),

  renameProject: (projectId, name) =>
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === projectId ? { ...p, name: name.trim(), updatedAt: nowIso() } : p,
      ),
    })),

  deleteProject: (projectId) =>
    set((state) => {
      const removedProtocolIds = new Set(
        state.protocols.filter((p) => p.projectId === projectId).map((p) => p.id),
      )
      return {
        projects: state.projects.filter((p) => p.id !== projectId),
        protocols: state.protocols.filter((p) => p.projectId !== projectId),
        selectedProjectId:
          state.selectedProjectId === projectId ? null : state.selectedProjectId,
        selectedProtocolId:
          state.selectedProtocolId && removedProtocolIds.has(state.selectedProtocolId)
            ? null
            : state.selectedProtocolId,
      }
    }),

  // CRUD протоколов
  addProtocol: (projectId, title) =>
    set((state) => {
      const now = nowIso()
      const protocol = {
        id: uuidv4(),
        projectId,
        title: title.trim(),
        meetingDate: now,
        participants: [],
        fileName: 'без-файла.docx',
        fileSizeKb: 0,
        contentHtml: '<p><em>Текст протокола появится после загрузки .docx.</em></p>',
      }
      return {
        protocols: [protocol, ...state.protocols],
        projects: state.projects.map((p) =>
          p.id === projectId ? { ...p, updatedAt: now } : p,
        ),
        selectedProtocolId: protocol.id,
      }
    }),

  deleteProtocol: (protocolId) =>
    set((state) => ({
      protocols: state.protocols.filter((p) => p.id !== protocolId),
      selectedProtocolId:
        state.selectedProtocolId === protocolId ? null : state.selectedProtocolId,
    })),
}))
