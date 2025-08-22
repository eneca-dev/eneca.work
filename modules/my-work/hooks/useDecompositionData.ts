"use client"

import { useState } from 'react'
import { supabase } from '@/lib/supabase-client'
import type { DecompositionItem } from '../types'

export function useDecompositionData() {
  const [decompositionItems, setDecompositionItems] = useState<DecompositionItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchDecomposition = async (sectionId: string) => {
    setIsLoading(true)
    setError(null)

    try {
      
      // Загружаем из таблицы decomposition_items с упрощенным запросом
      const { data: decompositionData, error: decompositionError } = await supabase
        .from('decomposition_items')
        .select('*')
        .eq('decomposition_item_section_id', sectionId)
        .order('decomposition_item_order')

      if (decompositionError) {
        throw new Error(`Ошибка загрузки декомпозиции: ${decompositionError.message}`)
      }

      if (!decompositionData || decompositionData.length === 0) {
        setDecompositionItems([])
        return
      }

      // Получаем категории работ отдельным запросом
      const categoryIds = decompositionData.map(item => item.decomposition_item_work_category_id).filter(Boolean)
      
      interface WorkCategory {
        work_category_id: string
        work_category_name: string
      }

      let categoriesData: WorkCategory[] = []
      if (categoryIds.length > 0) {
        const { data: categories, error: categoriesError } = await supabase
          .from('work_categories')
          .select('work_category_id, work_category_name')
          .in('work_category_id', categoryIds)

        if (!categoriesError) {
          categoriesData = categories || []
        }
      }

      // Получаем фактические часы из work_logs
      const decompositionIds = decompositionData.map(item => item.decomposition_item_id)
      interface WorkLogSummary {
        decomposition_item_id: string
        work_log_hours: number
      }

      let workLogsData: WorkLogSummary[] = []
      
      if (decompositionIds.length > 0) {
        const { data: workLogs, error: workLogsError } = await supabase
          .from('work_logs')
          .select('decomposition_item_id, work_log_hours')
          .in('decomposition_item_id', decompositionIds)

        if (!workLogsError) {
          workLogsData = workLogs || []
        }
      }

      // Вычисляем сумму фактических часов для каждого элемента
      const actualHoursMap = workLogsData.reduce((acc, log) => {
        const itemId = log.decomposition_item_id
        const hours = Number(log.work_log_hours) || 0
        acc[itemId] = (acc[itemId] || 0) + hours
        return acc
      }, {} as Record<string, number>)

      // Преобразуем данные в нужный формат
      const items: DecompositionItem[] = decompositionData.map(item => {
        const category = categoriesData.find(c => c.work_category_id === item.decomposition_item_work_category_id)
        const actualHours = actualHoursMap[item.decomposition_item_id] || 0
        
        return {
          work_type: category?.work_category_name || 'Неизвестная категория',
          work_content: item.decomposition_item_description,
          labor_costs: Number(item.decomposition_item_planned_hours) || 0,
          actual_hours: actualHours, // Добавляем фактические часы
          due_date: item.decomposition_item_planned_due_date // Добавляем срок
        }
      })
      
      setDecompositionItems(items)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Неизвестная ошибка при загрузке декомпозиции'
      setError(errorMessage)
      setDecompositionItems([])
    } finally {
      setIsLoading(false)
    }
  }

  return {
    decompositionItems,
    isLoading,
    error,
    fetchDecomposition
  }
}
