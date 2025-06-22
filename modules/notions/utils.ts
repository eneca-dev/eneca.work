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
  
  // Если есть заголовок, всегда добавляем разделитель, даже если контент пустой
  if (!trimmedContent) {
    return `${trimmedTitle}\n:::\n`
  }
  
  return `${trimmedTitle}\n:::\n${trimmedContent}`
}

/**
 * Конвертирует markdown в HTML для отображения
 */
export function markdownToHtml(text: string): string {
  // Сначала исправляем слитые заголовки - разделяем их переносами строк
  let processedText = text
    // Заменяем все варианты слитых заголовков
    .replace(/###([^#\n]+)##([^#\n]+)/g, '### $1\n## $2')
    .replace(/##([^#\n]+)###([^#\n]+)/g, '## $1\n### $2')
    .replace(/##([^#\n]+)#([^#\n]+)/g, '## $1\n# $2')
    .replace(/#([^#\n]+)##([^#\n]+)/g, '# $1\n## $2')
    .replace(/#([^#\n]+)###([^#\n]+)/g, '# $1\n### $2')
    .replace(/###([^#\n]+)#([^#\n]+)/g, '### $1\n# $2')

  // Разбиваем на строки и обрабатываем каждую
  const lines = processedText.split('\n')
  const htmlLines: string[] = []
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    
    if (!line.trim()) {
      // Пустая строка - НЕ добавляем <br/>, оставляем как есть
      htmlLines.push('')
    } else if (/^### (.+)$/.test(line.trim())) {
      // Заголовок 3
      const text = line.trim().replace(/^### /, '')
      htmlLines.push(`<h3 class="text-lg font-bold mt-4 mb-2 header-placeholder">${text}</h3>`)
    } else if (/^## (.+)$/.test(line.trim())) {
      // Заголовок 2
      const text = line.trim().replace(/^## /, '')
      htmlLines.push(`<h2 class="text-xl font-bold mt-4 mb-2 header-placeholder">${text}</h2>`)
    } else if (/^# (.+)$/.test(line.trim())) {
      // Заголовок 1
      const text = line.trim().replace(/^# /, '')
      htmlLines.push(`<h1 class="text-2xl font-bold mt-4 mb-2 header-placeholder">${text}</h1>`)
    } else if (/^- \[ \] (.+)$/.test(line.trim())) {
      // Пустой чекбокс
      const text = line.trim().replace(/^- \[ \] /, '')
      htmlLines.push(`<div class="checkbox-line"><input type="checkbox" class="mr-2 pointer-events-none"> ${text}</div>`)
    } else if (/^- \[x\] (.+)$/.test(line.trim())) {
      // Отмеченный чекбокс
      const text = line.trim().replace(/^- \[x\] /, '')
      htmlLines.push(`<div class="checkbox-line"><input type="checkbox" checked class="mr-2 pointer-events-none"> <span class="line-through opacity-60">${text}</span></div>`)
    } else if (/^- (?!\[[ x]\])(.+)$/.test(line.trim())) {
      // Буллет-лист
      const text = line.trim().replace(/^- /, '')
      htmlLines.push(`<div class="bullet-line">• ${text}</div>`)
    } else if (line.trim()) {
      // Обычный текст с форматированием (только если не пустая строка)
      let formattedLine = line.trim()
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/__(.*?)__/g, '<u>$1</u>')
      htmlLines.push(formattedLine)
    }
  }
  
  // Фильтруем пустые строки и соединяем без лишних переносов
  const filteredLines = htmlLines.filter(line => line.trim() !== '')
  return filteredLines.join('\n')
}

/**
 * Нормализует HTML из contentEditable, удаляя лишние стили
 */
function normalizeContentEditableHTML(html: string): string {
  console.log('Normalizing HTML:', html)
  
  // Создаем временный элемент для обработки
  const tempDiv = document.createElement('div')
  tempDiv.innerHTML = html
  
  // Сначала исправляем вложенные заголовки
  function flattenHeaders(parent: Element) {
    const headersToFlatten: { parent: Element, header: Element, children: Node[] }[] = []
    
    // Находим заголовки, которые содержат другие элементы
    const headers = parent.querySelectorAll('h1, h2, h3')
    headers.forEach(header => {
      const childElements = Array.from(header.children)
      if (childElements.length > 0) {
        headersToFlatten.push({
          parent: header.parentElement!,
          header,
          children: Array.from(header.childNodes)
        })
      }
    })
    
    // Исправляем каждый вложенный заголовок
    headersToFlatten.forEach(({ parent, header, children }) => {
      // Создаем правильную структуру
      const newElements: Node[] = []
      
      // Сначала создаем очищенный заголовок
      const cleanHeader = header.cloneNode(false) as Element
      const headerText = header.firstChild?.textContent || ''
      if (headerText.trim()) {
        cleanHeader.textContent = headerText.trim()
        newElements.push(cleanHeader)
      }
      
      // Затем добавляем остальные элементы как отдельные блоки
      children.forEach(child => {
        if (child.nodeType === Node.ELEMENT_NODE) {
          const element = child as Element
          if (!['H1', 'H2', 'H3'].includes(element.tagName)) {
            newElements.push(child.cloneNode(true))
          } else {
            // Вложенный заголовок - добавляем отдельно
            newElements.push(child.cloneNode(true))
          }
        } else if (child.nodeType === Node.TEXT_NODE && child.textContent?.trim()) {
          // Текстовый узел - создаем div
          const div = document.createElement('div')
          div.textContent = child.textContent.trim()
          newElements.push(div)
        }
      })
      
      // Заменяем исходный заголовок на новые элементы
      const nextSibling = header.nextSibling
      parent.removeChild(header)
      
      newElements.forEach(element => {
        if (nextSibling) {
          parent.insertBefore(element, nextSibling)
        } else {
          parent.appendChild(element)
        }
      })
    })
  }
  
  // Исправляем вложенные заголовки
  flattenHeaders(tempDiv)
  
  // Рекурсивно очищаем элементы
  function cleanElement(element: Element) {
    // Удаляем все style атрибуты и классы, кроме наших специальных классов
    element.removeAttribute('style')
    
    // Сохраняем только наши специальные классы
    const classList = element.classList
    const keepClasses = ['bullet-line', 'checkbox-line', 'header-placeholder']
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
          // Пропускаем пустые заголовки с плейсхолдерами
          if (!content.trim()) {
            return ''
          }
          return `# ${content}`
        case 'h2':
          // Пропускаем пустые заголовки с плейсхолдерами
          if (!content.trim()) {
            return ''
          }
          return `## ${content}`
        case 'h3':
          // Пропускаем пустые заголовки с плейсхолдерами
          if (!content.trim()) {
            return ''
          }
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
          // Не добавляем лишние переносы - br уже означает перенос
          return ''
        case 'p':
          // Сохраняем параграфы, даже пустые (они могут быть намеренными пустыми строками)
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
            const span = element.querySelector('span')
            const textContent = span ? span.textContent?.trim() || '' : content.replace(/^\s*/, '').trim()
            return `- [${isChecked ? 'x' : ' '}] ${textContent}`
          } else {
            // Обычные div - проверяем, содержат ли они заголовки
            const hasHeaders = element.querySelector('h1, h2, h3')
            if (hasHeaders) {
              // Если div содержит заголовки, обрабатываем дочерние элементы отдельно
              const childParts: string[] = []
              for (const child of Array.from(element.childNodes)) {
                const childResult = processNode(child)
                if (childResult.trim()) {
                  childParts.push(childResult.trim())
                }
              }
              return childParts.join('\n')
            } else {
              // Обычный div без заголовков
              return content
            }
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
  
  // Обрабатываем все дочерние узлы и соединяем их с переносами строк
  const parts: string[] = []
  for (const child of Array.from(tempDiv.childNodes)) {
    const result = processNode(child)
    
    // Добавляем результат только если он не пустой
    if (result.trim()) {
      parts.push(result.trim())
    }
  }
  
  // Соединяем части с одним переносом строки между ними
  const markdown = parts.join('\n')

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