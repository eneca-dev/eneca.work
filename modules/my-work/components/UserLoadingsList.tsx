"use client"

import React from 'react'
import { Calendar, TrendingUp, Layers, CheckSquare, ExternalLink } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useProjectsStore } from '@/modules/projects/store'
import type { UserLoading, UserTask, DecompositionItem } from '../types'

// Utility функция для обрезания текста
const truncateText = (text: string, maxLength: number): string => {
  if (!text) return ''
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength) + '...'
}

interface UserLoadingsListProps {
  loadings: UserLoading[]
  onLoadingClick: (loading: UserLoading) => void
  selectedLoadingId?: string
  selectedLoading?: UserLoading | null
  decompositionItems?: DecompositionItem[]
  isDecompositionLoading?: boolean
  decompositionError?: string | null
  tasks?: UserTask[]
  isTasksLoading?: boolean
  tasksError?: string | null
  onLoadingHover?: (loadingId: string | null) => void
  highlightedLoadingId?: string | null
  onOpenSection?: (sectionId: string) => void
}

export const UserLoadingsList: React.FC<UserLoadingsListProps> = ({
  loadings,
  onLoadingClick,
  selectedLoadingId,
  selectedLoading,
  decompositionItems = [],
  isDecompositionLoading = false,
  decompositionError = null,
  tasks = [],
  isTasksLoading = false,
  tasksError = null,
  onLoadingHover,
  highlightedLoadingId,
  onOpenSection
}) => {
  const router = useRouter()
  const { focusSection } = useProjectsStore()
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  const formatRate = (rate: number) => {
    return rate === 1 ? '1 ставка' : `${rate} ставки`
  }



  if (loadings.length === 0) {
    return (
      <div className="bg-gray-50 dark:bg-slate-600/20 rounded-lg border border-gray-100 dark:border-slate-500/20 px-6 pb-6 pt-3 mx-6 mt-3">
        <div className="flex items-center justify-center gap-4 py-6 text-center">
          <CheckSquare className="w-6 h-6 text-emerald-400 flex-shrink-0" />
          <div>
            <div className="font-medium text-gray-900 dark:text-white text-base">У вас нет активных загрузок</div>
            <div className="text-gray-600 dark:text-gray-400 text-sm mt-1">
              Загрузки появятся здесь, когда будут назначены
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {loadings.map((loading) => (
        <div key={loading.loading_id}>
          {/* Карточка загрузки */}
          <div
            className={`p-3 cursor-pointer transition-all duration-200 rounded-lg border ${
              selectedLoadingId === loading.loading_id 
                ? 'bg-emerald-500/10 border-emerald-500/20 shadow-lg' 
                : highlightedLoadingId === loading.loading_id
                  ? 'bg-blue-500/10 border-blue-500/20 shadow-md'
                  : 'bg-gray-50 dark:bg-slate-600/20 border-gray-100 dark:border-slate-500/20 hover:bg-gray-100 dark:hover:bg-slate-600/30 hover:border-gray-200 dark:hover:border-slate-500/30'
            }`}
            onClick={() => onLoadingClick(loading)}
            onMouseEnter={() => onLoadingHover?.(loading.loading_id)}
            onMouseLeave={() => onLoadingHover?.(null)}
          >
            <div className="flex justify-between items-start mb-1">
              <div className="flex items-center gap-2 flex-1">
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
                <h3 className="font-medium text-gray-900 dark:text-gray-100 text-sm">
                  {loading.section_name}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
                  <Calendar className="h-3 w-3" />
                  <span>
                    {formatDate(loading.loading_start)} — {formatDate(loading.loading_finish)}
                  </span>
                </div>
                <a
                  href="#section"
                  title="Открыть окно раздела"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    if (onOpenSection) {
                      onOpenSection(loading.section_id)
                    } else {
                      focusSection(loading.section_id)
                      router.push('/dashboard/projects')
                    }
                  }}
                  className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-md border bg-white dark:bg-slate-700/40 border-gray-200 dark:border-slate-600 text-emerald-700 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300 hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  к разделу
                </a>
              </div>
            </div>

            <div className="flex justify-between items-center text-xs text-gray-600 dark:text-gray-400">
              <p>
                {loading.project_name} • {loading.stage_name} • {loading.object_name}
              </p>
              <span className="text-primary font-medium">{formatRate(loading.loading_rate)}</span>
            </div>
          </div>

          {/* Декомпозиция и задания - показываются прямо под выбранной загрузкой */}
          {selectedLoadingId === loading.loading_id && selectedLoading && (
            <div className="ml-4 space-y-3 mt-3 animate-in slide-in-from-top-2 duration-300 fade-in-0">
              {/* Декомпозиция */}
              <div>
                <div className="flex items-center gap-2 mb-3 animate-in fade-in-50 duration-200 delay-100">
                  <Layers className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <h4 className="text-sm font-medium text-emerald-600 dark:text-emerald-400">Декомпозиции</h4>
                </div>
                
                {isDecompositionLoading ? (
                  <div className="text-sm text-gray-600 dark:text-gray-400">Загрузка...</div>
                ) : decompositionError ? (
                  <div className="text-sm text-red-400">Ошибка: {decompositionError}</div>
                ) : decompositionItems.length === 0 ? (
                  <div className="text-sm text-gray-600 dark:text-gray-400">Декомпозиция не создана</div>
                ) : (
                  <div className="bg-gray-50 dark:bg-slate-600/20 rounded-lg overflow-hidden backdrop-blur-sm border border-gray-100 dark:border-slate-500/20">
                    {/* Заголовок таблицы */}
                    <div 
                      className="p-3 bg-gray-100 dark:bg-slate-600/15 text-xs font-medium text-gray-700 dark:text-gray-300"
                      style={{ 
                        display: 'grid', 
                        gridTemplateColumns: '1.5fr 1.2fr 80px 70px', 
                        gap: '12px' 
                      }}
                    >
                      <div>Описание работ</div>
                      <div>Категория</div>
                      <div className="text-center">Факт/План</div>
                      <div className="text-center">Срок</div>
                    </div>
                    
                    {/* Строки таблицы */}
                    <div className="divide-y divide-gray-100 dark:divide-slate-500/20">
                      {decompositionItems.map((item, index) => (
                        <div 
                          key={index} 
                          className="p-3 text-sm text-gray-900 dark:text-gray-200"
                          style={{ 
                            display: 'grid', 
                            gridTemplateColumns: '1.5fr 1.2fr 80px 70px', 
                            gap: '12px' 
                          }}
                        >
                          <div title={item.work_content}>
                            {truncateText(item.work_content, 50)}
                          </div>
                          <div className="text-gray-600 dark:text-gray-400 whitespace-nowrap overflow-hidden" title={item.work_type}>
                            {truncateText(item.work_type, 20)}
                          </div>
                          <div className="text-center font-mono text-sm">
                            <span className={item.actual_hours !== undefined && item.actual_hours > item.labor_costs ? "text-red-500 dark:text-red-400" : "text-gray-900 dark:text-white"}>
                              {item.actual_hours !== undefined ? item.actual_hours : 0}
                            </span>
                            <span className="text-gray-500">/</span>
                            <span className="text-gray-900 dark:text-white">{item.labor_costs}</span>
                          </div>
                          <div className="text-center text-gray-600 dark:text-gray-400 text-xs">
                            {item.due_date ? new Date(item.due_date).toLocaleDateString('ru-RU') : '—'}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Задания */}
              <div>
                <div className="flex items-center gap-2 mb-3 animate-in fade-in-50 duration-200 delay-200">
                  <CheckSquare className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <h4 className="text-sm font-medium text-emerald-600 dark:text-emerald-400">Задания</h4>
                </div>
                
                {isTasksLoading ? (
                  <div className="text-sm text-gray-600 dark:text-gray-400">Загрузка заданий...</div>
                ) : tasksError ? (
                  <div className="text-sm text-red-400">Ошибка: {tasksError}</div>
                ) : tasks.length === 0 ? (
                  <div className="text-sm text-gray-600 dark:text-gray-400">Нет заданий для данного раздела</div>
                ) : (
                  <div className="space-y-2">
                    {tasks.map((task) => (
                      <div key={task.task_id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-600/20 rounded-lg backdrop-blur-sm border border-gray-100 dark:border-slate-500/20">
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-900 dark:text-gray-200">{task.task_name}</div>
                          <div className="text-xs text-gray-600 dark:text-gray-400">от {task.section_name}</div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="px-2 py-1 rounded text-xs font-medium bg-blue-600 text-white">
                            {task.task_status === 'active' || task.task_status === 'in_progress' ? 'В работе' : 
                             task.task_status === 'pending' ? 'Ожидание' : task.task_status}
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-400">
                            {task.task_end_date ? formatDate(task.task_end_date) : '—'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
