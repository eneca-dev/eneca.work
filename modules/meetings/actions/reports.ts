'use server'

import { createClient } from '@/utils/supabase/server'
import type { ActionResult } from '@/modules/cache/types'
import { getMeetingsClient } from '../server/meetings-client'
import type { MeetingReport } from '../types'

const REPORT_COLUMNS =
  'id, created_at, subject, meeting_date, meeting_started_at, status, invited_by_name, protocol_docx_url, transcript_docx_url, report'

/**
 * Список отчётов о созвонах из meetings-проекта.
 *
 * Доступ: требуется авторизация в основном проекте.
 * Фильтрация по участнику пока не применяется — в данных нет email участников.
 * Когда бот начнёт писать participant_emails (text[]), добавить фильтр:
 *   .contains('participant_emails', [user.email])
 */
export async function getMeetingReports(): Promise<ActionResult<MeetingReport[]>> {
  try {
    const main = await createClient()
    const {
      data: { user },
      error: authError,
    } = await main.auth.getUser()
    if (authError || !user) {
      return { success: false, error: 'Не авторизован' }
    }

    const meetings = getMeetingsClient()
    const { data, error } = await meetings
      .from('meeting_reports')
      .select(REPORT_COLUMNS)
      .order('meeting_date', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(500)

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true, data: (data ?? []) as unknown as MeetingReport[] }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ошибка загрузки созвонов',
    }
  }
}
