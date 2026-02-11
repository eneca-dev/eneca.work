'use client'

import { createContext, useContext } from 'react'

interface DeptTimelineContextValue {
  onCreateLoading: (sectionId: string) => void
}

const DeptTimelineContext = createContext<DeptTimelineContextValue>({
  onCreateLoading: () => {},
})

export const DeptTimelineProvider = DeptTimelineContext.Provider
export const useDeptTimelineActions = () => useContext(DeptTimelineContext)
