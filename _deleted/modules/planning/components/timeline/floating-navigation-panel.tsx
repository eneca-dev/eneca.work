"use client"

import React from 'react'
import { cn } from '@/lib/utils'
import { NavigationControls } from './navigation-controls'
import { Pagination } from '../pagination'

interface FloatingNavigationPanelProps {
  theme: 'light' | 'dark'
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  onScrollBackward: () => void
  onScrollForward: () => void
  startDate: Date | string
  daysToShow: number
  onTodayClick: () => void
}

export function FloatingNavigationPanel({
  theme,
  currentPage,
  totalPages,
  onPageChange,
  onScrollBackward,
  onScrollForward,
  startDate,
  daysToShow,
  onTodayClick
}: FloatingNavigationPanelProps) {
  return (
    <div className="fixed bottom-20 right-20 z-50">
      <div className={cn(
        "flex justify-between items-center py-2 px-4 rounded-lg border shadow-lg backdrop-blur-sm",
        theme === "dark" 
          ? "bg-slate-800/90 border-slate-700" 
          : "bg-white/90 border-slate-200"
      )}>
        {/* Пустое место слева */}
        <div></div>

        {/* Пагинация в центре */}
        {totalPages > 1 && (
          <Pagination 
            currentPage={currentPage} 
            totalPages={totalPages} 
            onPageChange={onPageChange} 
            theme={theme} 
          />
        )}

        {/* Блок с датами справа */}
        <NavigationControls
          theme={theme}
          onScrollBackward={onScrollBackward}
          onScrollForward={onScrollForward}
          startDate={startDate}
          daysToShow={daysToShow}
          onTodayClick={onTodayClick}
        />
      </div>
    </div>
  )
} 