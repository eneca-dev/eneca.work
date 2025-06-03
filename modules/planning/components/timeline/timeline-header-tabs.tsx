"use client"

interface TimelineHeaderTabsProps {
  theme: string
  activeTab: "timeline" | "board" | "calendar"
  onTabChange: (tab: "timeline" | "board" | "calendar") => void
  onTodayClick: () => void
}

export function TimelineHeaderTabs({ theme, activeTab, onTabChange, onTodayClick }: TimelineHeaderTabsProps) {
  return null
}
