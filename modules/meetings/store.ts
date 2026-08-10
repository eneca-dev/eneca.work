import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { v4 as uuidv4 } from 'uuid'
import type { MeetingsUiState, MeetingsUiActions } from './types'

type MeetingsStore = MeetingsUiState & MeetingsUiActions

// UI-состояние созвонов. Данные — через TanStack Query (useMeetingReports).
// Папки и назначения — локальный прототип, персистятся в localStorage (без бэкенда).
export const useMeetingsStore = create<MeetingsStore>()(
  persist(
    (set) => ({
      selectedReportId: null,
      searchQuery: '',
      selectedFolderId: null,
      folders: [],
      assignments: {},

      selectReport: (id) => set({ selectedReportId: id }),
      setSearchQuery: (query) => set({ searchQuery: query }),
      selectFolder: (id) => set({ selectedFolderId: id }),

      addFolder: (name) =>
        set((state) => ({
          folders: [...state.folders, { id: uuidv4(), name: name.trim() }],
        })),

      renameFolder: (id, name) =>
        set((state) => ({
          folders: state.folders.map((f) => (f.id === id ? { ...f, name: name.trim() } : f)),
        })),

      deleteFolder: (id) =>
        set((state) => {
          const assignments: Record<string, string> = {}
          for (const [reportId, folderId] of Object.entries(state.assignments)) {
            if (folderId !== id) assignments[reportId] = folderId
          }
          return {
            folders: state.folders.filter((f) => f.id !== id),
            assignments,
            selectedFolderId: state.selectedFolderId === id ? null : state.selectedFolderId,
          }
        }),

      assignReport: (reportId, folderId) =>
        set((state) => {
          const assignments = { ...state.assignments }
          if (folderId) assignments[reportId] = folderId
          else delete assignments[reportId]
          return { assignments }
        }),
    }),
    {
      name: 'meetings-folders',
      // skipHydration — регидрируем вручную после монтирования (MeetingsPanel),
      // чтобы первый клиентский рендер совпал с SSR (без рассинхрона гидрации).
      skipHydration: true,
      // Персистим только пользовательскую раскладку, не временный выбор/поиск.
      partialize: (state) => ({
        folders: state.folders,
        assignments: state.assignments,
        selectedFolderId: state.selectedFolderId,
      }),
    },
  ),
)
