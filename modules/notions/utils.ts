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
 * Конвертирует markdown в HTML для отображения
 */
export function markdownToHtml(text: string): string {
  let html = text
    // Сначала обрабатываем заголовки (чтобы они не попали в обработку переносов)
    .replace(/^### (.+)$/gm, '<h3 class="text-lg font-bold mt-4 mb-2">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-xl font-bold mt-4 mb-2">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold mt-4 mb-2">$1</h1>')
    // Чекбоксы
    .replace(/^- \[ \] (.+)$/gm, '<div class="checkbox-line"><input type="checkbox" class="mr-2 pointer-events-none"> $1</div>')
    .replace(/^- \[x\] (.+)$/gm, '<div class="checkbox-line"><input type="checkbox" checked class="mr-2 pointer-events-none"> <span class="line-through opacity-60">$1</span></div>')
    // Буллет-листы (не чекбоксы)
    .replace(/^- (?!\[[ x]\])(.+)$/gm, '<div class="bullet-line">• $1</div>')
    // Форматирование текста
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/__(.*?)__/g, '<u>$1</u>')

  // Обрабатываем переносы строк последними
  // Двойные переносы становятся абзацами
  html = html.replace(/\n\n/g, '</p><p>')
  
  // Одиночные переносы становятся <br/>, но НЕ перед/после блочных элементов
  html = html.replace(/\n(?!<\/?(h[1-6]|div|p))/g, '<br/>')
  html = html.replace(/(?<=<\/(h[1-6]|div|p)>)\n/g, '')
  html = html.replace(/\n(?=<(h[1-6]|div|p))/g, '')
  
  // Оборачиваем в параграфы если есть </p><p>
  if (html.includes('</p><p>')) {
    html = '<p>' + html + '</p>'
  }
  
  return html
}

/**
 * Нормализует HTML из contentEditable, удаляя лишние стили
 */
function normalizeContentEditableHTML(html: string): string {
  console.log('Normalizing HTML:', html)
  
  // Создаем временный элемент для обработки
  const tempDiv = document.createElement('div')
  tempDiv.innerHTML = html
  
  // Рекурсивно очищаем элементы
  function cleanElement(element: Element) {
    // Удаляем все style атрибуты и классы, кроме наших специальных классов
    element.removeAttribute('style')
    
    // Сохраняем только наши специальные классы
    const classList = element.classList
    const keepClasses = ['bullet-line', 'checkbox-line']
    const classesToKeep = Array.from(classList).filter(cls => keepClasses.includes(cls))
    element.className = classesToKeep.join(' ')
    
    // Заменяем &nbsp; на обычные пробелы
    if (element.innerHTML.includes('&nbsp;')) {
      element.innerHTML = element.innerHTML.replace(/&nbsp;/g, ' ')
    }
    
    // Обрабатываем дочерние элементы
    Array.from(element.children).forEach(child => cleanElement(child))
  }
  
  // Очищаем все элементы
  Array.from(tempDiv.children).forEach(child => cleanElement(child))
  
  // Также очищаем текстовые узлы от &nbsp;
  const walker = document.createTreeWalker(
    tempDiv,
    NodeFilter.SHOW_TEXT,
    null
  )
  
  let node
  while (node = walker.nextNode()) {
    if (node.textContent) {
      node.textContent = node.textContent.replace(/\u00A0/g, ' ') // Заменяем неразрывные пробелы
    }
  }
  
  const normalized = tempDiv.innerHTML
  console.log('Normalized HTML:', normalized)
  return normalized
}

/**
 * Конвертирует HTML обратно в markdown
 */
export function htmlToMarkdown(html: string): string {
  console.log('Converting HTML to markdown:', html)
  
  // Сначала нормализуем HTML, удаляя лишние стили
  const normalizedHtml = normalizeContentEditableHTML(html)
  
  // Создаем временный элемент для парсинга
  const tempDiv = document.createElement('div')
  tempDiv.innerHTML = normalizedHtml
  
  let markdown = ''
  
  // Рекурсивно обрабатываем элементы
  function processNode(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent || ''
    }
    
    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as Element
      const tagName = element.tagName.toLowerCase()
      let content = ''
      
      // Обрабатываем дочерние узлы
      for (const child of Array.from(node.childNodes)) {
        content += processNode(child)
      }
      
      switch (tagName) {
        case 'h1':
          return `# ${content}`
        case 'h2':
          return `## ${content}`
        case 'h3':
          return `### ${content}`
        case 'strong':
        case 'b':
          return `**${content}**`
        case 'em':
        case 'i':
          return `*${content}*`
        case 'u':
          return `__${content}__`
        case 'br':
          return '\n'
        case 'p':
          // Игнорируем пустые параграфы
          if (!content.trim()) {
            return ''
          }
          return content
        case 'div':
          if (element.classList.contains('bullet-line')) {
            // Убираем символ буллета, если он есть
            const cleanContent = content.replace(/^•\s*/, '').trim()
            return `- ${cleanContent}`
          } else if (element.classList.contains('checkbox-line')) {
            // Обрабатываем чекбоксы
            const checkbox = element.querySelector('input[type="checkbox"]')
            const isChecked = checkbox?.hasAttribute('checked')
            const textContent = content.replace(/^\s*/, '').trim()
            return `- [${isChecked ? 'x' : ' '}] ${textContent}`
          } else {
            return content
          }
        case 'span':
          return content
        case 'input':
          // Игнорируем input элементы, они обрабатываются в родительском div
          return ''
        default:
          return content
      }
    }
    
    return ''
  }
  
  // Обрабатываем все дочерние узлы
  const parts: string[] = []
  for (const child of Array.from(tempDiv.childNodes)) {
    const result = processNode(child)
    if (result.trim()) {
      parts.push(result)
    }
  }
  
  // Соединяем части с правильными переносами строк
  markdown = parts.join('\n')
  
  // Очищаем результат
  markdown = markdown
    .replace(/\n\s*\n\s*\n+/g, '\n\n') // Максимум два перевода строки подряд
    .replace(/^\n+/, '') // Убираем переносы в начале
    .replace(/\n+$/, '') // Убираем переносы в конце
    .replace(/[ \t]+/g, ' ') // Убираем лишние пробелы
    .trim()

  console.log('Converted to markdown:', markdown)
  return markdown
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