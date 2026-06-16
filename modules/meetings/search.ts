import type { MeetingProtocol } from './types'

/** Убирает HTML-теги и схлопывает пробелы — для текстового поиска по телу протокола. */
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Глобальный поиск по протоколам.
 * Регистронезависимо, по названию, тексту (contentHtml) и участникам.
 * Пустой/пробельный запрос возвращает пустой массив (поиск не активен).
 */
export function searchProtocols(
  protocols: MeetingProtocol[],
  query: string,
): MeetingProtocol[] {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return []

  return protocols.filter((protocol) => {
    const haystack = [
      protocol.title,
      stripHtml(protocol.contentHtml),
      protocol.participants.join(' '),
    ]
      .join(' ')
      .toLowerCase()

    return haystack.includes(normalized)
  })
}
