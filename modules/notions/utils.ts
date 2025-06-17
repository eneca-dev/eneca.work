import type { Notion, ParsedNotion } from './types'

/**
 * Парсит заголовок и контент из notion_content
 * Формат: TITLE:::\nCONTENT или просто CONTENT
 */
export function parseNotionContent(notion: Notion): ParsedNotion {
  const content = notion.notion_content || ''
  
  // Проверяем, есть ли разделитель заголовка
  const titleSeparator = ':::'
  const separatorIndex = content.indexOf('\n' + titleSeparator + '\n')
  
  if (separatorIndex !== -1) {
    const title = content.substring(0, separatorIndex).trim()
    const contentBody = content.substring(separatorIndex + titleSeparator.length + 2).trim()
    return { title, content: contentBody }
  }
  
  // Если разделителя нет, пробуем извлечь первую строку как заголовок
  const lines = content.split('\n')
  const firstLine = lines[0]?.trim() || ''
  
  // Если первая строка короткая (до 100 символов) и есть еще контент, считаем её заголовком
  if (firstLine.length > 0 && firstLine.length <= 100 && lines.length > 1) {
    const restContent = lines.slice(1).join('\n').trim()
    if (restContent.length > 0) {
      return { title: firstLine, content: restContent }
    }
  }
  
  return { title: '', content }
}

/**
 * Объединяет заголовок и контент в один notion_content
 */
export function combineNotionContent(title: string, content: string): string {
  const trimmedTitle = title.trim()
  const trimmedContent = content.trim()
  
  // Если нет заголовка, но есть контент - ставим "Без названия"
  if (!trimmedTitle && trimmedContent) {
    return `Без названия\n:::\n${trimmedContent}`
  }
  
  if (!trimmedTitle) {
    return trimmedContent
  }
  
  if (!trimmedContent) {
    return trimmedTitle
  }
  
  return `${trimmedTitle}\n:::\n${trimmedContent}`
}

/**
 * Получает отображаемый заголовок заметки
 */
export function getNotionDisplayTitle(notion: Notion): string {
  const parsed = parseNotionContent(notion)
  
  if (parsed.title) {
    return parsed.title.substring(0, 50) + (parsed.title.length > 50 ? '...' : '')
  }
  
  // Если заголовка нет, берем начало контента
  const firstLine = parsed.content.split('\n')[0]?.trim() || ''
  return firstLine
    .replace(/^#+\s*/, '') // убираем # заголовки
    .replace(/\*\*(.*?)\*\*/g, '$1') // убираем жирный текст
    .replace(/\*(.*?)\*/g, '$1') // убираем курсив
    .replace(/__(.*?)__/g, '$1') // убираем подчеркивание
    .replace(/`(.*?)`/g, '$1') // убираем код
    .substring(0, 50) + (firstLine.length > 50 ? '...' : '')
} 