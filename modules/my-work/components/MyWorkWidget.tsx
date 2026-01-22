"use client"

import React, { useState, useEffect } from 'react'
import { Loader2, Calendar } from 'lucide-react'
import { UserLoadingsList } from './UserLoadingsList'
import { ResponsibilitiesBlock } from './ResponsibilitiesBlock'
import { WorkTasksChart } from './WorkTasksChart'
import { DeadlinesBlock } from './DeadlinesBlock'
import { useMyWorkData } from '../hooks/useMyWorkData'
import { useDecompositionData } from '../hooks/useDecompositionData'
import { useTasksData } from '../hooks/useTasksData'
import { supabase } from '@/lib/supabase-client'
import { useUserStore } from '@/stores/useUserStore'
import type { UserLoading } from '../types'
import { SectionPanel } from '@/components/modals'

export const MyWorkWidget: React.FC = () => {
  const userStore = useUserStore()
  const { data, isLoading, error } = useMyWorkData()
  const { decompositionItems, isLoading: isDecompositionLoading, error: decompositionError, fetchDecomposition } = useDecompositionData()
  const { tasks, isLoading: isTasksLoading, error: tasksError, fetchTasksForSection } = useTasksData()
  const [selectedLoading, setSelectedLoading] = useState<UserLoading | null>(null)
  const [highlightedLoadingId, setHighlightedLoadingId] = useState<string | null>(null)
  const [loadingStatus, setLoadingStatus] = useState<'active' | 'archived'>('active')
  const [displayedLoadings, setDisplayedLoadings] = useState<UserLoading[]>([])
  const [listHeight, setListHeight] = useState<number>(400)
  const [isSectionPanelOpen, setIsSectionPanelOpen] = useState(false)
  const [sectionPanelId, setSectionPanelId] = useState<string | null>(null)

  // Вычисляем доступную высоту viewport
      const calculateAvailableHeight = () => {
      const viewportHeight = window.innerHeight
      const headerHeight = 80 // Высота заголовка виджета
      const chartHeight = 0 // График всегда в правой колонке, сверху ничего не отнимаем
      const margins = 48 // Отступы между блоками
      const scrollBoundary = 19 // 5мм от границы (примерно 19px)
      const selectedLoadingBuffer = selectedLoading ? 20 : 30 // Дополнительный буфер (больше для неразвернутого списка)
      
      return viewportHeight - headerHeight - chartHeight - margins - scrollBoundary - selectedLoadingBuffer
    }

  // Вычисляем динамическую высоту для списка загрузок
  const getLoadingsListHeight = () => {
    const availableHeight = calculateAvailableHeight()
    
    if (!selectedLoading) {
      // Когда загрузка не выбрана, используем более консервативный подход
      // чтобы список не выходил за границы окна
      return Math.max(availableHeight * 0.85, 200)
    }
    
    // Когда загрузка выбрана, используем практически всю доступную высоту
    // (здесь все работает хорошо, не трогаем)
    return Math.max(availableHeight * 0.95, 200)
  }

  const handleLoadingClick = (loading: UserLoading) => {
    // Если уже выбрана эта же загрузка, то закрываем блоки
    if (selectedLoading?.loading_id === loading.loading_id) {
      setSelectedLoading(null)
    } else {
      // Иначе открываем новую загрузку
      setSelectedLoading(loading)
      fetchDecomposition(loading.section_id)
      fetchTasksForSection(loading.section_id)
    }
  }

  const fetchLoadingsForDisplay = async (status: 'active' | 'archived') => {
    if (!data) return
    
    try {
      const { data: loadingsData, error } = await supabase
        .from('view_sections_with_loadings')
        .select('*')
        .eq('loading_responsible', userStore.id)
        .eq('loading_status', status)
        .not('loading_id', 'is', null)

      if (error) {
        console.error('Ошибка загрузки загрузок для отображения:', error)
        return
      }

      setDisplayedLoadings(loadingsData || [])
    } catch (error) {
      console.error('Ошибка в fetchLoadingsForDisplay:', error)
    }
  }

  const handleStatusChange = (status: 'active' | 'archived') => {
    setLoadingStatus(status)
    setSelectedLoading(null) // Сбрасываем выбранную загрузку при смене статуса
    fetchLoadingsForDisplay(status)
  }

  const openSectionPanel = (sectionId: string) => {
    setSectionPanelId(sectionId)
    setIsSectionPanelOpen(true)
  }

  // Эффект для инициализации отображаемых загрузок
  useEffect(() => {
    if (data.loadings.length > 0 && loadingStatus === 'active') {
      setDisplayedLoadings(data.loadings)
    }
  }, [data.loadings])

  // Эффект для загрузки архивных загрузок
  useEffect(() => {
    if (loadingStatus === 'archived') {
      fetchLoadingsForDisplay('archived')
    }
  }, [loadingStatus])

  // Эффект для пересчета высоты при изменениях
  useEffect(() => {
    const updateHeight = () => {
      setListHeight(getLoadingsListHeight())
    }
    
    updateHeight()
    
    // Пересчитываем при изменении размера окна
    const handleResize = () => updateHeight()
    window.addEventListener('resize', handleResize)
    
    return () => window.removeEventListener('resize', handleResize)
  }, [selectedLoading, data.workLogs.length])
  
  // Эффект для пересчета высоты при изменении selectedLoading
  useEffect(() => {
    setListHeight(getLoadingsListHeight())
  }, [selectedLoading])

  // Часы теперь берутся из аналитики view, вычисления не нужны

  const isLeader = data.responsibilities.length > 0

  if (isLoading) {
    return (
      <div className="h-full flex flex-col">
        <div className="p-6 pb-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            <h2 className="card-title dark:text-gray-200">Моя работа</h2>
          </div>
        </div>
        <div className="flex-1 overflow-hidden px-6 flex items-center justify-center">
          <div className="flex items-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="text-muted-foreground">Загрузка...</span>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-full flex flex-col">
        <div className="p-6 pb-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            <h2 className="card-title dark:text-gray-200">Моя работа</h2>
          </div>
        </div>
        <div className="flex-1 overflow-hidden px-6 flex items-center justify-center">
          <div className="text-center text-destructive">
            Ошибка: {error}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-6 pb-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          <h2 className="card-title dark:text-gray-200">Моя работа</h2>
        </div>
      </div>
      
      <div className="flex-1 overflow-hidden px-6">
        <div className="h-full overflow-y-auto overflow-x-hidden pr-2 space-y-6">
          {/* Адаптивный layout: 1 колонка на мобильных, 2 на md+, всегда равные колонки на lg */}
          <div className={`grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-2`}>
            {/* Левая колонка - Заголовок и список загрузок */}
            <div className="flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <h3 className="text-sm text-emerald-600 dark:text-emerald-400">
                    {loadingStatus === 'active' ? 'Активные загрузки' : 'Архивированные'}
                  </h3>
                </div>
                <div className="flex items-center bg-gray-50 dark:bg-slate-600/20 rounded-lg p-1">
                  <button
                    onClick={() => handleStatusChange('active')}
                    className={`px-3 py-1 text-xs rounded-md transition-all duration-200 ${
                      loadingStatus === 'active'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-gray-400 hover:text-gray-300'
                    }`}
                  >
                    Активные
                  </button>
                  <button
                    onClick={() => handleStatusChange('archived')}
                    className={`px-3 py-1 text-xs rounded-md transition-all duration-200 ${
                      loadingStatus === 'archived'
                        ? 'bg-gray-600 text-white shadow-sm'
                        : 'text-gray-400 hover:text-gray-300'
                    }`}
                  >
                    Архив
                  </button>
                </div>
              </div>

              {/* Список загрузок с динамической высотой и невидимым скроллом */}
              <div className="bg-gray-50 dark:bg-slate-600/20 rounded-lg p-4">
                <div
                  className="overflow-y-auto overflow-x-hidden pr-2 transition-all duration-300"
                style={{
                  maxHeight: `${listHeight}px`,
                  scrollbarWidth: 'none', /* Firefox */
                  msOverflowStyle: 'none'  /* IE и Edge */
                }}
                onScroll={(e) => {
                  const element = e.currentTarget
                  const { scrollTop, scrollHeight, clientHeight } = element
                  
                  // Автоскролл при приближении к границе (в пределах 50px от низа)
                  if (scrollHeight - scrollTop - clientHeight < 50) {
                    // Можно добавить логику подгрузки или другие действия
                  }
                }}
              >
                <style jsx>{`
                  div::-webkit-scrollbar {
                    display: none; /* Chrome, Safari, Opera */
                  }
                `}</style>
                <UserLoadingsList
                  loadings={displayedLoadings}
                  onLoadingClick={handleLoadingClick}
                  selectedLoadingId={selectedLoading?.loading_id}
                  selectedLoading={selectedLoading}
                  decompositionItems={decompositionItems}
                  isDecompositionLoading={isDecompositionLoading}
                  decompositionError={decompositionError}
                  tasks={tasks}
                  isTasksLoading={isTasksLoading}
                  tasksError={tasksError}
                  onLoadingHover={setHighlightedLoadingId}
                  highlightedLoadingId={highlightedLoadingId || undefined}
                  onOpenSection={openSectionPanel}
                />
              </div>
              </div>
            </div>

                         {/* Правая колонка - всегда видна */}
            <div className="flex flex-col space-y-6 overflow-hidden h-full">
              {/* График задач всегда в правой колонке */}
              <WorkTasksChart 
                workLogs={data.workLogs}
                daysToShow={7}
                height={118}
              />

                             {/* Ответственности для руководителей */}
               {isLeader && <ResponsibilitiesBlock responsibilities={data.responsibilities} isCompact={!!selectedLoading} />}

                              {/* Заголовок Дедлайны с выравниванием */}
                <div className={`flex items-center gap-2 mb-4 ${
                  // Добавляем отступ сверху чтобы выровнять с заголовком "Активные загрузки"
                  !selectedLoading && !isLeader ? 'mt-0' : // Если нет ни графика ни ответственностей
                  !selectedLoading || !isLeader ? '-mt-2' : // Если есть только один блок сверху
                  '-mt-4' // Если есть и график и ответственности
                }`}>
                  <Calendar className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <h3 className="text-sm text-emerald-600 dark:text-emerald-400">Дедлайны</h3>
                </div>

                              {/* Дедлайны без заголовка */}
                <DeadlinesBlock loadings={data.loadings} isCompact={!!selectedLoading} hideHeader={true} />
            </div>
          </div>
        </div>
      </div>
      {isSectionPanelOpen && sectionPanelId && (
        <SectionPanel
          isOpen={isSectionPanelOpen}
          onClose={() => setIsSectionPanelOpen(false)}
          sectionId={sectionPanelId}
          initialTab={'overview'}
        />
      )}
    </div>
  )
}
