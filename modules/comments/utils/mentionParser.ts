/**
 * Утилиты для парсинга @упоминаний в комментариях
 */

/**
 * Извлекает упоминания пользователей из HTML контента
 * @param htmlContent - HTML контент комментария
 * @returns Массив ID упомянутых пользователей
 */
export function extractMentions(htmlContent: string): string[] {
  if (!htmlContent) return []

  const mentions = new Set<string>()

  // Паттерн 1: data-id в span элементах
  const dataIdPattern = /<span[^>]*data-id=["']([^"']+)["'][^>]*>/g
  let match = dataIdPattern.exec(htmlContent)
  while (match) {
    mentions.add(match[1])
    match = dataIdPattern.exec(htmlContent)
  }

  // Паттерн 2: для совместимости с разными форматами
  const mentionPattern = /@\[([^\]]+)\]\(([^)]+)\)/g
  match = mentionPattern.exec(htmlContent)
  while (match) {
    mentions.add(match[2])
    match = mentionPattern.exec(htmlContent)
  }

  // Паттерн 3: простые data-mention атрибуты
  const simpleMentionPattern = /data-mention=["']([^"']+)["']/g
  match = simpleMentionPattern.exec(htmlContent)
  while (match) {
    mentions.add(match[1])
    match = simpleMentionPattern.exec(htmlContent)
  }

  return Array.from(mentions)
}

 