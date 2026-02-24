"use client"

import { useState, useEffect } from 'react'
import * as Sentry from "@sentry/nextjs"
import { supabase } from '@/lib/supabase-client'
import { useUserStore } from '@/stores/useUserStore'
import type { UserLoading, UserTask, UserAnalytics, ResponsibilityInfo, MyWorkData, WorkLogEntry } from '../types'

export function useMyWorkData() {
  const [data, setData] = useState<MyWorkData>({
    loadings: [],
    tasks: [],
    analytics: {
      comments_count: 0,
      mentions_count: 0,
      active_loadings_count: 0,
      archived_loadings_count: 0,
      today_hours: 0, // Оптимизировано: теперь берется из view_my_work_analytics
      week_hours: 0   // Оптимизировано: теперь берется из view_my_work_analytics
    },
    responsibilities: [],
    workLogs: []
  })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const userStore = useUserStore()
  const userId = userStore.id

  // Загрузка активных загрузок пользователя (оптимизированная через RPC функцию)
  const fetchUserLoadings = async (userId: string): Promise<UserLoading[]> => {
    try {
      // Используем оптимизированную RPC функцию вместо медленного VIEW
      // Ускорение: ~900x (0.02 сек вместо 18+ сек)
      const { data, error } = await supabase
        .rpc('get_user_active_loadings', {
          p_user_id: userId
        })

      if (error) {
        // Улучшенная обработка ошибок с Sentry
        const err = new Error(`Ошибка загрузки загрузок: ${error.message}`)

        Sentry.captureException(err, {
          tags: {
            module: 'my-work',
            hook: 'useMyWorkData',
            action: 'fetch_user_loadings',
            error_type: 'rpc_error'
          },
          extra: {
            errorMessage: error.message,
            errorDetails: error,
            userId,
            hint: error.hint,
            code: error.code,
            timestamp: new Date().toISOString()
          }
        })

        throw err
      }

      // Преобразуем данные в нужный формат
      const userLoadings: UserLoading[] = (data || []).map(item => ({
        loading_id: item.loading_id,
        loading_responsible: item.loading_responsible,
        section_id: item.section_id,
        loading_start: item.loading_start,
        loading_finish: item.loading_finish,
        loading_rate: item.loading_rate,
        loading_status: item.loading_status,
        section_name: item.section_name,
        project_name: item.project_name,
        project_id: item.project_id,
        object_name: item.object_name || '',
        stage_name: item.stage_name || '',
        responsible_first_name: item.responsible_first_name || '',
        responsible_last_name: item.responsible_last_name || ''
      }))

      return userLoadings
    } catch (error) {
      console.error('Ошибка в fetchUserLoadings:', error)
      // Ошибка уже залогирована в Sentry выше (строка 44-59)
      // Просто пробрасываем дальше
      throw error
    }
  }

  // Удалено: fetchUserTasks не используется, задачи загружаются через useTasksData

  // Загрузка аналитики пользователя (оптимизированная через view)
  const fetchUserAnalytics = async (userId: string): Promise<UserAnalytics> => {
    try {
      const { data, error } = await supabase
        .from('view_my_work_analytics')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (error) {
        console.error('Ошибка загрузки аналитики из view:', error)
        Sentry.captureException(error, { tags: { module: 'my-work', hook: 'useMyWorkData', action: 'load_analytics', error_type: 'db_error' }, extra: { user_id: userId } })
        return {
          comments_count: 0,
          mentions_count: 0,
          active_loadings_count: 0,
          archived_loadings_count: 0,
          today_hours: 0,
          week_hours: 0
        }
      }

      return {
        comments_count: data.comments_count || 0,
        mentions_count: data.mentions_count || 0,
        active_loadings_count: data.active_loadings_count || 0,
        archived_loadings_count: data.archived_loadings_count || 0,
        today_hours: data.today_hours || 0,
        week_hours: data.week_hours || 0
      }
    } catch (error) {
      console.error('Ошибка в fetchUserAnalytics:', error)
      Sentry.captureException(error, { tags: { module: 'my-work', hook: 'useMyWorkData', action: 'load_analytics', error_type: 'unexpected' }, extra: { user_id: userId } })
      return {
        comments_count: 0,
        mentions_count: 0,
        active_loadings_count: 0,
        archived_loadings_count: 0,
        today_hours: 0,
        week_hours: 0
      }
    }
  }

  // Загрузка записей work_logs для графика задач (оптимизированная через представление)
  const fetchUserWorkLogs = async (userId: string, daysBack: number = 30): Promise<WorkLogEntry[]> => {
    try {
      const { data, error } = await supabase
        .from('view_work_logs_enriched')
        .select('work_log_id, work_log_date, work_log_hours, work_log_description, section_name, work_category_name')
        .eq('author_id', userId)
        .gte('work_log_date', new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
        .order('work_log_date', { ascending: false })

      if (error) {
        throw new Error(`Ошибка загрузки work_logs: ${error.message}`)
      }

      if (!data || data.length === 0) {
        return []
      }

      // Данные уже в нужном формате благодаря представлению
      const workLogs: WorkLogEntry[] = data.map(log => ({
        work_log_id: log.work_log_id,
        work_log_date: log.work_log_date,
        work_log_hours: parseFloat(log.work_log_hours?.toString() || '0'),
        work_log_description: log.work_log_description || '',
        section_name: log.section_name || 'Неизвестный раздел',
        work_category_name: log.work_category_name || 'Без категории'
      }))

      return workLogs
    } catch (error) {
      console.error('Ошибка в fetchUserWorkLogs:', error)
      Sentry.captureException(error, { tags: { module: 'my-work', hook: 'useMyWorkData', action: 'load_work_logs', error_type: 'db_error' }, extra: { user_id: userId, days_back: daysBack } })
      return []
    }
  }

  // Загрузка информации об ответственности пользователя (оптимизированная через UNION)
  const fetchUserResponsibilities = async (userId: string): Promise<ResponsibilityInfo[]> => {
    try {
      // Берём ответственности напрямую из представления view_my_work_analytics
      const { data, error } = await supabase
        .from('view_my_work_analytics')
        .select('responsibilities')
        .eq('user_id', userId)
        .single()

      if (error) {
        console.error('Ошибка загрузки responsibilities из view_my_work_analytics:', error)
        return []
      }

      const list = (data?.responsibilities as ResponsibilityInfo[] | null) || []
      return list
    } catch (error) {
      console.error('Ошибка в fetchUserResponsibilities:', error)
      return []
    }
  }

  const fetchAllData = async () => {
    if (!userId) {
      return
    }
    setIsLoading(true)
    setError(null)

    try {
      const [loadings, analytics, responsibilities, workLogs] = await Promise.all([
        fetchUserLoadings(userId),
        fetchUserAnalytics(userId),
        fetchUserResponsibilities(userId),
        fetchUserWorkLogs(userId, 30)
      ])



      setData({
        loadings,
        tasks: [], // Задачи теперь загружаются отдельно через useTasksData
        analytics,
        responsibilities,
        workLogs
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Произошла ошибка при загрузке данных')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (userId) {
      fetchAllData()
    }
  }, [userId])

  return {
    data,
    isLoading,
    error,
    refetch: fetchAllData
  }
}
