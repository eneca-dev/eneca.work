"use client"

import { useState } from 'react'
import { supabase } from '@/lib/supabase-client'
import type { UserTask } from '../types'

export function useTasksData() {
  const [tasks, setTasks] = useState<UserTask[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchTasksForSection = async (sectionId: string) => {
    setIsLoading(true)
    setError(null)

    try {
      // Оптимизированный запрос с JOIN'ами - получаем все данные одним запросом
      const { data, error } = await supabase
        .from('assignments')
        .select(`
          assignment_id,
          title,
          link,
          description,
          created_by,
          to_section_id,
          from_section_id,
          created_at,
          updated_at,
          due_date,
          status,
          from_section:view_section_hierarchy_v2!from_section_id(
            section_name,
            project_name
          ),
          creator:profiles!created_by(
            user_id,
            first_name,
            last_name
          )
        `)
        .eq('to_section_id', sectionId)

      if (error) {
        // Fallback на старый метод если JOIN не работает
        const [assignmentsResult, sectionsResult, profilesResult] = await Promise.all([
          supabase.from('assignments').select('*').eq('to_section_id', sectionId),
          supabase.from('view_section_hierarchy_v2').select('section_id, section_name, project_name'),
          supabase.from('profiles').select('user_id, first_name, last_name')
        ])

        if (assignmentsResult.error) {
          throw new Error(`Ошибка загрузки заданий: ${assignmentsResult.error.message}`)
        }

        if (!assignmentsResult.data || assignmentsResult.data.length === 0) {
          setTasks([])
          return
        }

        const sectionsMap = new Map(
          (sectionsResult.data || []).map(s => [s.section_id, { section_name: s.section_name, project_name: s.project_name }])
        )
        
        const profilesMap = new Map(
          (profilesResult.data || []).map(p => [p.user_id, `${p.first_name} ${p.last_name}`])
        )

        const enrichedTasks: UserTask[] = assignmentsResult.data.map(assignment => {
          const senderSection = sectionsMap.get(assignment.from_section_id)
          
          return {
            task_id: assignment.assignment_id,
            task_name: assignment.title || 'Задание',
            task_description: assignment.description || assignment.link || '',
            task_responsible: assignment.created_by,
            task_parent_section: assignment.to_section_id,
            task_section_id: assignment.from_section_id,
            task_start_date: assignment.created_at,
            task_end_date: assignment.due_date,
            task_status: assignment.status || 'active',
            task_created: assignment.created_at,
            task_updated: assignment.updated_at,
            section_name: senderSection?.section_name || 'Неизвестный раздел',
            project_name: senderSection?.project_name || 'Неизвестный проект',
            responsible_name: profilesMap.get(assignment.created_by) || 'Неизвестный'
          }
        })

        setTasks(enrichedTasks)
        return
      }

      if (!data || data.length === 0) {
        setTasks([])
        return
      }

      // Обработка данных с JOIN'ами
      const enrichedTasks: UserTask[] = data.map(assignment => ({
        task_id: assignment.assignment_id,
        task_name: assignment.title || 'Задание',
        task_description: assignment.description || assignment.link || '',
        task_responsible: assignment.created_by,
        task_parent_section: assignment.to_section_id,
        task_section_id: assignment.from_section_id,
        task_start_date: assignment.created_at,
        task_end_date: assignment.due_date,
        task_status: assignment.status || 'active',
        task_created: assignment.created_at,
        task_updated: assignment.updated_at,
        section_name: (assignment.from_section as any)?.section_name || 'Неизвестный раздел',
        project_name: (assignment.from_section as any)?.project_name || 'Неизвестный проект',
        responsible_name: (assignment.creator as any) ? 
          `${(assignment.creator as any).first_name} ${(assignment.creator as any).last_name}` : 'Неизвестный'
      }))

      setTasks(enrichedTasks)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Неизвестная ошибка при загрузке заданий'
      setError(errorMessage)
      setTasks([])
    } finally {
      setIsLoading(false)
    }
  }

  return {
    tasks,
    isLoading,
    error,
    fetchTasksForSection
  }
}
