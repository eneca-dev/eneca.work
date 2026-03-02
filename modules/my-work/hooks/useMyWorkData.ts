"use client"

import { useState, useEffect, useRef, useCallback } from 'react'
import * as Sentry from "@sentry/nextjs"
import { supabase } from '@/lib/supabase-client'
import { useUserStore } from '@/stores/useUserStore'
import type { UserLoading, UserTask, UserAnalytics, ResponsibilityInfo, MyWorkData, WorkLogEntry } from '../types'

const emptyAnalytics: UserAnalytics = {
  comments_count: 0,
  mentions_count: 0,
  active_loadings_count: 0,
  archived_loadings_count: 0,
  today_hours: 0,
  week_hours: 0
}

// Загрузка активных загрузок пользователя (оптимизированная через RPC функцию)
async function fetchUserLoadings(userId: string): Promise<UserLoading[]> {
  const { data, error } = await supabase
    .rpc('get_user_active_loadings', { p_user_id: userId })

  if (error) {
    const err = new Error(`Ошибка загрузки загрузок: ${error.message}`)
    Sentry.captureException(err, {
      tags: { module: 'my-work', hook: 'useMyWorkData', action: 'fetch_user_loadings', error_type: 'rpc_error' },
      extra: { errorMessage: error.message, errorDetails: error, userId, hint: error.hint, code: error.code }
    })
    throw err
  }

  return (data || []).map(item => ({
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
}

// Загрузка аналитики И ответственностей из ОДНОГО запроса к view_my_work_analytics
// (раньше это были 2 отдельных запроса к тому же view — лишняя нагрузка)
async function fetchAnalyticsAndResponsibilities(userId: string): Promise<{
  analytics: UserAnalytics
  responsibilities: ResponsibilityInfo[]
}> {
  const { data, error } = await supabase
    .from('view_my_work_analytics')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    Sentry.captureException(error, {
      tags: { module: 'my-work', hook: 'useMyWorkData', action: 'load_analytics', error_type: 'db_error' },
      extra: { user_id: userId }
    })
    return { analytics: emptyAnalytics, responsibilities: [] }
  }

  if (!data) {
    return { analytics: emptyAnalytics, responsibilities: [] }
  }

  return {
    analytics: {
      comments_count: data.comments_count || 0,
      mentions_count: data.mentions_count || 0,
      active_loadings_count: data.active_loadings_count || 0,
      archived_loadings_count: data.archived_loadings_count || 0,
      today_hours: data.today_hours || 0,
      week_hours: data.week_hours || 0
    },
    responsibilities: (data.responsibilities as ResponsibilityInfo[] | null) || []
  }
}

// Загрузка записей work_logs для графика задач
async function fetchUserWorkLogs(userId: string, daysBack: number = 30): Promise<WorkLogEntry[]> {
  const { data, error } = await supabase
    .from('view_work_logs_enriched')
    .select('work_log_id, work_log_date, work_log_hours, work_log_description, section_name, work_category_name')
    .eq('author_id', userId)
    .gte('work_log_date', new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
    .order('work_log_date', { ascending: false })

  if (error) {
    Sentry.captureException(error, {
      tags: { module: 'my-work', hook: 'useMyWorkData', action: 'load_work_logs', error_type: 'db_error' },
      extra: { user_id: userId, days_back: daysBack }
    })
    return []
  }

  if (!data || data.length === 0) return []

  return data
    .filter((log): log is typeof log & { work_log_id: string; work_log_date: string } =>
      log.work_log_id != null && log.work_log_date != null
    )
    .map(log => ({
      work_log_id: log.work_log_id,
      work_log_date: log.work_log_date,
      work_log_hours: parseFloat(log.work_log_hours?.toString() || '0'),
      work_log_description: log.work_log_description || '',
      section_name: log.section_name || 'Неизвестный раздел',
      work_category_name: log.work_category_name || 'Без категории'
    }))
}

export function useMyWorkData() {
  const [data, setData] = useState<MyWorkData>({
    loadings: [],
    tasks: [],
    analytics: emptyAnalytics,
    responsibilities: [],
    workLogs: []
  })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Примитивный селектор — не вызывает лишних ре-рендеров (rerender-derived-state)
  const userId = useUserStore(state => state.id)

  // Защита от двойного вызова при race condition persist middleware
  // Если userId приходит дважды с одинаковым значением — второй fetch игнорируется
  const lastFetchedUserIdRef = useRef<string | null>(null)
  const isFetchingRef = useRef(false)
  const hasErrorRef = useRef(false)

  const fetchAllData = useCallback(async (targetUserId: string) => {
    // Дедупликация: если уже загружаем для этого userId — пропускаем
    if (isFetchingRef.current && lastFetchedUserIdRef.current === targetUserId) {
      return
    }

    // Если данные уже загружены для этого userId и нет ошибки — пропускаем
    // (повторная загрузка будет через refetch)
    if (lastFetchedUserIdRef.current === targetUserId && !hasErrorRef.current) {
      return
    }

    isFetchingRef.current = true
    lastFetchedUserIdRef.current = targetUserId
    setIsLoading(true)
    setError(null)
    hasErrorRef.current = false

    try {
      // async-parallel: все запросы независимы — запускаем параллельно
      const [loadings, analyticsData, workLogs] = await Promise.all([
        fetchUserLoadings(targetUserId),
        fetchAnalyticsAndResponsibilities(targetUserId), // 1 запрос вместо 2
        fetchUserWorkLogs(targetUserId, 30)
      ])

      // Проверяем что userId не изменился пока шли запросы
      if (lastFetchedUserIdRef.current !== targetUserId) return

      setData({
        loadings,
        tasks: [],
        analytics: analyticsData.analytics,
        responsibilities: analyticsData.responsibilities,
        workLogs
      })
    } catch (err) {
      if (lastFetchedUserIdRef.current !== targetUserId) return
      hasErrorRef.current = true
      setError(err instanceof Error ? err.message : 'Произошла ошибка при загрузке данных')
    } finally {
      isFetchingRef.current = false
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (userId) {
      fetchAllData(userId)
    }
  }, [userId]) // eslint-disable-line react-hooks/exhaustive-deps -- fetchAllData has empty deps (uses only refs), safe to omit

  // refetch сбрасывает guard чтобы принудительно перезагрузить
  const refetch = useCallback(() => {
    if (!userId) return
    lastFetchedUserIdRef.current = null
    return fetchAllData(userId)
  }, [userId, fetchAllData])

  return {
    data,
    isLoading,
    error,
    refetch
  }
}
