/**
 * Sections Page Context
 *
 * Контекст для actions (создание/редактирование загрузок)
 */

'use client'

import { createContext, useContext, type ReactNode } from 'react'

interface SectionsPageActions {
  /** Открыть модалку редактирования загрузки */
  onEditLoading: (loadingId: string, loading: {
    id: string
    employee_id: string
    start_date: string
    end_date: string
    rate: number
    comment: string | null
    stage_id?: string | null
  }, breadcrumbs: {
    sectionId: string
    sectionName: string
    objectName: string
    projectName: string
  }, stages?: Array<{ id: string; name: string; order: number | null }>) => void
}

const SectionsPageContext = createContext<SectionsPageActions | null>(null)

export function useSectionsPageActions() {
  const ctx = useContext(SectionsPageContext)
  if (!ctx) {
    throw new Error('useSectionsPageActions must be used within SectionsPageProvider')
  }
  return ctx
}

interface SectionsPageProviderProps {
  children: ReactNode
  onEditLoading: (loadingId: string, loading: {
    id: string
    employee_id: string
    start_date: string
    end_date: string
    rate: number
    comment: string | null
    stage_id?: string | null
  }, breadcrumbs: {
    sectionId: string
    sectionName: string
    objectName: string
    projectName: string
  }, stages?: Array<{ id: string; name: string; order: number | null }>) => void
}

export function SectionsPageProvider({
  children,
  onEditLoading,
}: SectionsPageProviderProps) {
  return (
    <SectionsPageContext.Provider value={{ onEditLoading }}>
      {children}
    </SectionsPageContext.Provider>
  )
}
