import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'

interface AuthorFilterState {
  authorId: string
  authorSearch: string
  setAuthorId: (id: string) => void
  setAuthorSearch: (q: string) => void
}

export const useReportsAuthorFilterStore = create<AuthorFilterState>()(
  devtools(
    persist(
      (set) => ({
        authorId: '',
        authorSearch: '',
        setAuthorId: (id) => set({ authorId: id }),
        setAuthorSearch: (q) => set({ authorSearch: q })
      }),
      {
        name: 'reports-author-filter'
      }
    )
  )
)

