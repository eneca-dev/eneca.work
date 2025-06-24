import type { Notion, ParsedNotion } from '@/modules/notions/types'

/**
 * Парсит заголовок и контент из notion_content
 */
export function parseNotionContent(notion: Notion): ParsedNotion {
  const content = notion.notion_content || ''
  
  const lines = content.split('\n')
  const firstLine = lines[0]?.trim()
  
  // Проверяем, начинается ли первая строка с # (заголовок)
  if (firstLine?.startsWith('# ')) {
    const title = firstLine.substring(2).trim()
    const contentLines = lines.slice(1).join('\n').trim()
    // Удаляем лишние переносы строк в начале
    const cleanContent = contentLines.replace(/^\n+/, '')
    return { title, content: cleanContent }
  }
  
  return { title: '', content }
}

/**
 * Объединяет заголовок и контент в один notion_content
 */
export function combineNotionContent(title: string, content: string): string {
  const cleanTitle = title.trim()
  const cleanContent = content.trim()
  
  if (!cleanTitle && !cleanContent) return ''
  if (!cleanTitle) return cleanContent
  if (!cleanContent) return `# ${cleanTitle}`
  
  return `# ${cleanTitle}\n\n${cleanContent}`
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
    } else if (/^\d+\. (.+)$/.test(line.trim())) {
      // Нумерованный список
      const match = line.trim().match(/^(\d+)\. (.+)$/)
      if (match) {
        const number = match[1]
        const text = match[2]
        htmlLines.push(`<div class="numbered-line">${number}. ${text}</div>`)
      }
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
    const keepClasses = ['bullet-line', 'checkbox-line', 'numbered-line', 'header-placeholder']
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
          } else if (element.classList.contains('numbered-line')) {
            // Обрабатываем нумерованный список
            return content
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
        case 'ol':
          // Нумерованный список - обрабатываем li элементы
          const olItems: string[] = []
          let itemIndex = 1
          for (const child of Array.from(element.childNodes)) {
            if (child.nodeType === Node.ELEMENT_NODE && (child as Element).tagName.toLowerCase() === 'li') {
              const itemContent = processNode(child).trim()
              if (itemContent) {
                olItems.push(`${itemIndex}. ${itemContent}`)
                itemIndex++
              }
            }
          }
          return olItems.join('\n')
        case 'ul':
          // Маркированный список - обрабатываем li элементы
          const ulItems: string[] = []
          for (const child of Array.from(element.childNodes)) {
            if (child.nodeType === Node.ELEMENT_NODE && (child as Element).tagName.toLowerCase() === 'li') {
              const itemContent = processNode(child).trim()
              if (itemContent) {
                ulItems.push(`- ${itemContent}`)
              }
            }
          }
          return ulItems.join('\n')
        case 'li':
          // Элемент списка - если не обработан выше, возвращаем только содержимое
          return content
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
    return parsed.title
  }
  
  // Если нет заголовка, берем первые 50 символов из содержимого
  const text = parsed.content.replace(/[#*_`\[\]]/g, '').trim()
  if (text.length > 50) {
    return text.substring(0, 50) + '...'
  }
  
  return text || 'Пустая заметка'
} 