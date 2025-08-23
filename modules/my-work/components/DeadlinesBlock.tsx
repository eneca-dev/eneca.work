"use client"

import React, { useMemo } from 'react'
import { Calendar, Clock, AlertTriangle } from 'lucide-react'
import type { UserLoading, DeadlinesBlockProps } from '../types'
import { ScrollableContainer } from './ScrollableContainer'

interface LocalDeadlineItem {
  id: string
  title: string
  date: Date
  type: 'loading'
  daysLeft: number
}

export const DeadlinesBlock: React.FC<DeadlinesBlockProps> = ({ loadings, isCompact = false, hideHeader = false }) => {
  // Функция для расчета количества дней до дедлайна
  const calculateDaysLeft = (date: Date): number => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const targetDate = new Date(date)
    targetDate.setHours(0, 0, 0, 0)
    
    const diffTime = targetDate.getTime() - today.getTime()
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  }

  // Функция для форматирования дней до дедлайна
  const formatDaysLeft = (daysLeft: number): { text: string; color: string } => {
    if (daysLeft < 0) {
      return {
        text: `просрочено на ${Math.abs(daysLeft)} дн.`,
        color: 'text-red-400'
      }
    } else if (daysLeft === 0) {
      return {
        text: 'сегодня',
        color: 'text-orange-400'
      }
    } else if (daysLeft === 1) {
      return {
        text: 'завтра',
        color: 'text-yellow-400'
      }
    } else if (daysLeft <= 7) {
      return {
        text: `через ${daysLeft} дн.`,
        color: 'text-blue-400'
      }
    } else {
      return {
        text: `через ${daysLeft} дн.`,
        color: 'text-gray-400'
      }
    }
  }

  // Подготовка списка дедлайнов
  const deadlines = useMemo(() => {
    const items: LocalDeadlineItem[] = []

    // Добавляем дедлайны загрузок
    loadings.forEach(loading => {
      if (loading.loading_finish) {
        const finishDate = new Date(loading.loading_finish)
        const daysLeft = calculateDaysLeft(finishDate)
        
        items.push({
          id: `loading-${loading.loading_id}`,
          title: loading.section_name || 'Загрузка',
          date: finishDate,
          type: 'loading',
          daysLeft
        })
      }
    })

    // Сортируем по близости к текущей дате (ближайшие сначала)
    items.sort((a, b) => {
      // Сначала просроченные (по убыванию дней просрочки)
      if (a.daysLeft < 0 && b.daysLeft < 0) {
        return b.daysLeft - a.daysLeft
      }
      // Затем актуальные (по возрастанию дней до дедлайна)
      if (a.daysLeft >= 0 && b.daysLeft >= 0) {
        return a.daysLeft - b.daysLeft
      }
      // Просроченные перед актуальными
      return a.daysLeft < 0 ? -1 : 1
    })

    // Берем первые 5
    return items.slice(0, 5)
  }, [loadings])

  if (deadlines.length === 0) {
    return (
      <div>
        {!hideHeader && (
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <h3 className="text-sm text-emerald-600 dark:text-emerald-400">Дедлайны</h3>
          </div>
        )}
        <div className="bg-gray-50 dark:bg-slate-600/20 rounded-lg border border-gray-100 dark:border-slate-500/20 p-4">
          <div className={`flex items-center justify-center text-center ${
            isCompact ? 'gap-2 py-2' : 'gap-4 py-4'
          }`}>
            <Clock className={`text-emerald-400 flex-shrink-0 ${isCompact ? 'w-4 h-4' : 'w-6 h-6'}`} />
            <div>
              <div className={`font-medium text-gray-900 dark:text-white ${isCompact ? 'text-sm' : 'text-base'}`}>
                Нет активных дедлайнов
              </div>
              {!isCompact && (
                <div className="text-gray-600 dark:text-gray-400 text-sm mt-1">
                  У вас нет информации по дедлайнам, так как нет активных загрузок
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      {!hideHeader && (
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <h3 className="text-sm text-emerald-600 dark:text-emerald-400">Дедлайны</h3>
        </div>
      )}
      
      <ScrollableContainer maxHeight="8rem">
        <div className="space-y-2">
          {deadlines.map((deadline) => {
            const daysFormat = formatDaysLeft(deadline.daysLeft)
            
            return (
              <div
                key={deadline.id}
                className="bg-gray-50 dark:bg-slate-600/20 rounded-lg p-2 border border-gray-100 dark:border-slate-500/20 hover:bg-gray-100 dark:hover:bg-slate-600/30 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {deadline.daysLeft < 0 ? (
                      <AlertTriangle className="h-3 w-3 text-red-400 flex-shrink-0" />
                    ) : (
                      <Clock className="h-3 w-3 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                    )}
                    <div className="text-xs text-gray-700 dark:text-gray-300 truncate">
                      {deadline.title}
                    </div>
                  </div>
                  <div className={`text-xs font-medium flex-shrink-0 ml-2 ${daysFormat.color}`}>
                    {daysFormat.text}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </ScrollableContainer>
    </div>
  )
}
