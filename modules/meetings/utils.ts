import { formatDistanceToNow } from 'date-fns'
import { ru } from 'date-fns/locale'
import { formatMinsk } from '@/lib/timezone-utils'

/** Дата созвона (Europe/Minsk): «10 июня 2026». Принимает 'YYYY-MM-DD' или ISO. */
export function formatMeetingDate(iso: string): string {
  return formatMinsk(new Date(iso), 'd MMMM yyyy', { locale: ru })
}

/** Дата и время созвона (Europe/Minsk): «10 июня 2026, 14:30». */
export function formatMeetingDateTime(iso: string): string {
  return formatMinsk(new Date(iso), 'd MMMM yyyy, HH:mm', { locale: ru })
}

/** Относительное время: «2 дня назад». */
export function formatRelative(iso: string): string {
  return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: ru })
}
