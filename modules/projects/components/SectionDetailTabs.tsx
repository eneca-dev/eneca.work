"use client"

import React, { useState } from 'react'
import SectionDecompositionTab from './SectionDecompositionTab'
import SectionTasksPreview from './SectionTasksPreview'
import { CommentsPanel } from '@/modules/comments/components/CommentsPanel'

interface SectionDetailTabsProps {
  sectionId: string
}

type TabType = 'tasks-comments' | 'decomposition'

export function SectionDetailTabs({ sectionId }: SectionDetailTabsProps) {
  const [activeTab, setActiveTab] = useState<TabType>('tasks-comments')

  return (
    <div className="space-y-4">
      {/* Вкладки */}
      <div className="flex border-b border-slate-200 dark:border-slate-700">
        <button
          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "tasks-comments"
              ? "border-blue-500 text-blue-600 dark:text-blue-400"
              : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
          }`}
          onClick={() => setActiveTab("tasks-comments")}
        >
          Задания / Комментарии
        </button>
        <button
          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "decomposition"
              ? "border-blue-500 text-blue-600 dark:text-blue-400"
              : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
          }`}
          onClick={() => setActiveTab("decomposition")}
        >
          Декомпозиция
        </button>
      </div>

      {/* Контент вкладок */}
      <div className="min-h-0">
        {activeTab === 'tasks-comments' && (
          <div className="flex gap-4 h-[80vh]">
            {/* Левая половина: Задания */}
            <div className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 overflow-hidden flex flex-col">
              <div className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-3">Задания</div>
              <div className="flex-1 min-h-0 overflow-auto">
                <SectionTasksPreview sectionId={sectionId} />
              </div>
            </div>

            {/* Правая половина: Комментарии */}
            <div className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 overflow-hidden flex flex-col">
              <div className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-3">Комментарии</div>
              <div className="flex-1 min-h-0">
                <CommentsPanel sectionId={sectionId} autoScrollOnMount={true} />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'decomposition' && (
          <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
            <SectionDecompositionTab sectionId={sectionId} compact={false} />
          </div>
        )}
      </div>
    </div>
  )
}
