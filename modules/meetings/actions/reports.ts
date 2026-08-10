'use server'

import { createClient } from '@/utils/supabase/server'
import type { ActionResult } from '@/modules/cache/types'
import { getMeetingsClient } from '../server/meetings-client'
import type { MeetingReport } from '../types'

const REPORT_COLUMNS =
  'id, created_at, subject, meeting_date, meeting_started_at, status, invited_by_name, invited_by_email, protocol_docx_url, transcript_docx_url, report'

// Исключения: email входа в eneca.work → email(ы) в Teams (invited_by_email),
// когда они различаются. Ключ и значения — lowercase. У всех текущих пользователей
// почты совпадают (вход = Teams), поэтому маппингов нет.
const EMAIL_ALIASES: Record<string, string[]> = {}

/** Все email, которые считаются «текущим пользователем как владельцем» (его почта + алиасы). */
function ownerEmailsFor(userEmail: string | null): string[] {
  if (!userEmail) return []
  const lower = userEmail.toLowerCase()
  const aliases = (EMAIL_ALIASES[lower] ?? []).map((a) => a.toLowerCase())
  return Array.from(new Set([lower, ...aliases]))
}

/** Текущий пользователь основного проекта (id + email). */
async function getCurrentUser() {
  const main = await createClient()
  const {
    data: { user },
    error,
  } = await main.auth.getUser()
  if (error || !user) return null
  return { id: user.id, email: user.email ?? null }
}

/**
 * Созвоны, доступные текущему пользователю: свои (он пригласил бота — invited_by_email = его email)
 * + расшаренные ему (meeting_report_shares.shared_with_user_id = его user_id).
 */
export async function getMeetingReports(): Promise<ActionResult<MeetingReport[]>> {
  try {
    const user = await getCurrentUser()
    if (!user) return { success: false, error: 'Не авторизован' }

    const meetings = getMeetingsClient()

    // Свои (как пригласивший) — по email пользователя + его алиасам. Точное сравнение (.in),
    // без ilike: символ '_' в email трактуется ilike как wildcard и может зацепить чужой созвон.
    const ownerEmails = ownerEmailsFor(user.email)
    const ownedPromise = ownerEmails.length
      ? meetings.from('meeting_reports').select(REPORT_COLUMNS).in('invited_by_email', ownerEmails)
      : Promise.resolve({ data: [], error: null })

    // Расшаренные мне
    const sharesRes = await meetings
      .from('meeting_report_shares')
      .select('report_id')
      .eq('shared_with_user_id', user.id)
    if (sharesRes.error) return { success: false, error: sharesRes.error.message }
    const sharedIds = (sharesRes.data ?? []).map((s: { report_id: string }) => s.report_id)

    const sharedPromise = sharedIds.length
      ? meetings.from('meeting_reports').select(REPORT_COLUMNS).in('id', sharedIds)
      : Promise.resolve({ data: [], error: null })

    const [ownedRes, sharedRes] = await Promise.all([ownedPromise, sharedPromise])
    if (ownedRes.error) return { success: false, error: ownedRes.error.message }
    if (sharedRes.error) return { success: false, error: sharedRes.error.message }

    // Слияние без дублей + признак владельца
    const byId = new Map<string, MeetingReport>()
    const ownerSet = new Set(ownerEmails)
    for (const row of [...(ownedRes.data ?? []), ...(sharedRes.data ?? [])] as MeetingReport[]) {
      if (byId.has(row.id)) continue
      const invitedEmail = row.invited_by_email?.toLowerCase()
      const isOwner = !!invitedEmail && ownerSet.has(invitedEmail)
      byId.set(row.id, { ...row, isOwner })
    }

    const data = Array.from(byId.values()).sort((a, b) => {
      const da = a.meeting_date ?? a.created_at
      const db = b.meeting_date ?? b.created_at
      return db.localeCompare(da)
    })

    return { success: true, data }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ошибка загрузки созвонов',
    }
  }
}

/** Проверяет, что текущий пользователь — владелец (пригласивший) созвона. */
async function assertOwner(
  reportId: string,
  user: { id: string; email: string | null },
): Promise<string | null> {
  const ownerEmails = ownerEmailsFor(user.email)
  if (!ownerEmails.length) return 'Нет email пользователя'
  const meetings = getMeetingsClient()
  const { data, error } = await meetings
    .from('meeting_reports')
    .select('invited_by_email')
    .eq('id', reportId)
    .single()
  if (error) return error.message
  const ownerEmail = (data?.invited_by_email as string | null)?.toLowerCase() ?? null
  if (!ownerEmail || !ownerEmails.includes(ownerEmail)) {
    return 'Только владелец может управлять доступом'
  }
  return null
}

export interface ShareInput {
  reportId: string
  userId: string
}

/** Расшарить созвон пользователю eneca.work (только владелец). */
export async function shareReport(input: ShareInput): Promise<ActionResult<true>> {
  try {
    const user = await getCurrentUser()
    if (!user) return { success: false, error: 'Не авторизован' }

    const ownerError = await assertOwner(input.reportId, user)
    if (ownerError) return { success: false, error: ownerError }

    const meetings = getMeetingsClient()
    const { error } = await meetings.from('meeting_report_shares').upsert(
      {
        report_id: input.reportId,
        shared_with_user_id: input.userId,
        shared_by_user_id: user.id,
      },
      { onConflict: 'report_id,shared_with_user_id' },
    )
    if (error) return { success: false, error: error.message }
    return { success: true, data: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Ошибка шеринга' }
  }
}

/** Убрать доступ пользователя к созвону (только владелец). */
export async function unshareReport(input: ShareInput): Promise<ActionResult<true>> {
  try {
    const user = await getCurrentUser()
    if (!user) return { success: false, error: 'Не авторизован' }

    const ownerError = await assertOwner(input.reportId, user)
    if (ownerError) return { success: false, error: ownerError }

    const meetings = getMeetingsClient()
    const { error } = await meetings
      .from('meeting_report_shares')
      .delete()
      .eq('report_id', input.reportId)
      .eq('shared_with_user_id', input.userId)
    if (error) return { success: false, error: error.message }
    return { success: true, data: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Ошибка отзыва доступа' }
  }
}

/** user_id пользователей, которым расшарен созвон (только владелец). */
export async function getReportShares(reportId: string): Promise<ActionResult<string[]>> {
  try {
    const user = await getCurrentUser()
    if (!user) return { success: false, error: 'Не авторизован' }

    const ownerError = await assertOwner(reportId, user)
    if (ownerError) return { success: false, error: ownerError }

    const meetings = getMeetingsClient()
    const { data, error } = await meetings
      .from('meeting_report_shares')
      .select('shared_with_user_id')
      .eq('report_id', reportId)
    if (error) return { success: false, error: error.message }
    return {
      success: true,
      data: (data ?? []).map((s: { shared_with_user_id: string }) => s.shared_with_user_id),
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Ошибка загрузки доступа' }
  }
}
