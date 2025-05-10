"use client"

import { createContext, useContext, type ReactNode, useMemo } from "react"
import type { Project, Loading } from "@/types/project-types"
import type { RoadmapContextType as RoadmapContextTypeInterface } from "../types/roadmap-types"
import { useMonthGroups } from "../hooks/use-month-groups"
import { useSectionAggregates } from "../hooks/use-section-aggregates"
import { useTheme } from "next-themes"

// Добавляем isDarkTheme в контекст
export interface RoadmapContextType extends RoadmapContextTypeInterface {
  isDarkTheme: boolean
  collapseAllSections?: () => void
}

// Создаем контекст
const RoadmapContext = createContext<RoadmapContextType | null>(null)

interface RoadmapProviderProps {
  children: ReactNode
  project: Project
  expandedSections: Record<string, boolean>
  onToggleSection: (sectionId: string) => void
  onAddLoading: (stageId: string) => void
  onEditLoading: (loading: Loading, stageId: string) => void
  visibleDays: Date[]
  allDays: Date[]
  sidebarWidth?: number
  showPlanCharts?: boolean
  showFactCharts?: boolean
  togglePlanCharts?: () => void
  toggleFactCharts?: () => void
  responsibleColumnWidth?: number
  isResponsibleColumnCollapsed?: boolean
  toggleResponsibleColumn?: () => void
  collapseAllSections?: () => void
}

export function RoadmapProvider({
  children,
  project,
  expandedSections,
  onToggleSection,
  onAddLoading,
  onEditLoading,
  visibleDays,
  allDays,
  sidebarWidth = 264,
  showPlanCharts = true,
  showFactCharts = true,
  togglePlanCharts = () => {},
  toggleFactCharts = () => {},
  responsibleColumnWidth = 150,
  isResponsibleColumnCollapsed = false,
  toggleResponsibleColumn = () => {},
  collapseAllSections = () => {},
}: RoadmapProviderProps) {
  // Константы
  const CELL_WIDTH = 25

  // Получаем текущую тему
  const { resolvedTheme } = useTheme()
  const isDarkTheme = resolvedTheme === "dark"

  // Используем кастомные хуки для получения данных
  const { monthGroups } = useMonthGroups(visibleDays)
  const { sectionAggregates, maxAggregates } = useSectionAggregates(project, visibleDays)

  // Memoize the context value to prevent unnecessary re-renders
  const contextValue = useMemo<RoadmapContextType>(
    () => ({
      project,
      workingDays: visibleDays,
      allDays,
      monthGroups,
      sectionAggregates,
      maxAggregates,
      expandedSections,
      onToggleSection,
      onAddLoading,
      onEditLoading,
      CELL_WIDTH,
      sidebarWidth,
      showPlanCharts,
      showFactCharts,
      togglePlanCharts,
      toggleFactCharts,
      responsibleColumnWidth,
      isResponsibleColumnCollapsed,
      toggleResponsibleColumn,
      isDarkTheme,
      collapseAllSections,
    }),
    [
      project,
      visibleDays,
      allDays,
      monthGroups,
      sectionAggregates,
      maxAggregates,
      expandedSections,
      onToggleSection,
      onAddLoading,
      onEditLoading,
      sidebarWidth,
      showPlanCharts,
      showFactCharts,
      togglePlanCharts,
      toggleFactCharts,
      responsibleColumnWidth,
      isResponsibleColumnCollapsed,
      toggleResponsibleColumn,
      isDarkTheme,
      collapseAllSections,
    ],
  )

  return <RoadmapContext.Provider value={contextValue}>{children}</RoadmapContext.Provider>
}

// Хук для использования контекста
export function useRoadmap() {
  const context = useContext(RoadmapContext)
  if (!context) {
    throw new Error("useRoadmap must be used within a RoadmapProvider")
  }
  return context
}

