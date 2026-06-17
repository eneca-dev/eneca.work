import type { MeetingReport } from './types'

/** Собирает искомый текст созвона: тема, кто пригласил, summary, участники, обсуждение, вопросы. */
function reportHaystack(meeting: MeetingReport): string {
  const parts: string[] = [meeting.subject ?? '', meeting.invited_by_name ?? '']
  const report = meeting.report
  if (report) {
    parts.push(report.preview_summary ?? '')
    report.participants?.forEach((p) => parts.push(p.name))
    report.discussion_items?.forEach((d) => parts.push(d.topic ?? '', d.outcome ?? ''))
    report.open_questions?.forEach((q) => parts.push(q.question ?? ''))
  }
  return parts.join(' ').toLowerCase()
}

/**
 * Поиск по созвонам. Регистронезависимо по теме, участникам и содержимому протокола.
 * Пустой запрос возвращает исходный список (это основной список, а не отдельный режим поиска).
 */
export function searchReports(reports: MeetingReport[], query: string): MeetingReport[] {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return reports
  return reports.filter((meeting) => reportHaystack(meeting).includes(normalized))
}
