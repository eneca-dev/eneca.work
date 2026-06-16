import { format, formatDistanceToNow } from 'date-fns'
import { ru } from 'date-fns/locale'

/** Дата созвона: «10 июня 2026». */
export function formatMeetingDate(iso: string): string {
  return format(new Date(iso), 'd MMMM yyyy', { locale: ru })
}

/** Дата и время созвона: «10 июня 2026, 14:30». */
export function formatMeetingDateTime(iso: string): string {
  return format(new Date(iso), 'd MMMM yyyy, HH:mm', { locale: ru })
}

/** Размер файла: «24 КБ» / «1.4 МБ». */
export function formatFileSize(kb: number): string {
  return kb < 1024 ? `${kb} КБ` : `${(kb / 1024).toFixed(1)} МБ`
}

/** Относительное время: «2 дня назад». */
export function formatRelative(iso: string): string {
  return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: ru })
}
