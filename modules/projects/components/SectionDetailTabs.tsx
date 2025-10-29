"use client"

import SectionTasksPreview from './SectionTasksPreview'
import { CommentsPanel } from '@/modules/comments/components/CommentsPanel'

interface SectionDetailTabsProps {
  sectionId: string
}

export function SectionDetailTabs({ sectionId }: SectionDetailTabsProps) {

  return (
    <div className="space-y-4">
      <div className="min-h-0">
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

        {/* Вкладка "Декомпозиция" удалена: декомпозиция доступна только в модальном окне SectionPanel */}
      </div>
    </div>
  )
}
