import type { Notion, ParsedNotion } from '@/modules/notions/types'

/**
 * Splits a table row string into cells while respecting escaped pipes (\|).
 * Escaped pipes are preserved in the cell content.
 * 
 * @param rowString - The table row string (e.g., "| cell1 | cell2 with \| pipe | cell3 |")
 * @returns Array of cell contents with escaped pipes preserved
 */
export function splitTableRow(rowString: string): string[] {
  // Validate that the row string starts and ends with '|'
  const trimmed = rowString.trim()
  if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) {
    console.warn(`Invalid table row format: "${rowString}". Expected format: "| cell1 | cell2 |"`)
    return []
  }
  
  // Remove leading and trailing |
  const content = trimmed.slice(1, -1)
  
  const cells: string[] = []
  let currentCell = ''
  let i = 0
  
  while (i < content.length) {
    if (content[i] === '\\' && content[i + 1] === '|') {
      // Escaped pipe - add literal pipe to current cell and skip both characters
      currentCell += '|'
      i += 2
    } else if (content[i] === '|') {
      // Unescaped pipe - end current cell and start new one
      cells.push(currentCell.trim())
      currentCell = ''
      i++
    } else {
      // Regular character
      currentCell += content[i]
      i++
    }
  }
  
  // Add the last cell
  cells.push(currentCell.trim())
  
  return cells
}

/**
 * Analyzes table rows to determine the most common column count and fixes inconsistent rows.
 * This prevents creating extra columns when cell content contains "|" characters.
 * 
 * @param tableLines - Array of table row strings
 * @returns Object with fixed table lines and expected column count
 */
/**
 * Разделяет последовательность строк таблицы на отдельные таблицы
 * Новая таблица начинается, когда встречается разделитель после строк данных
 */
export function splitIntoSeparateTables(tableLines: string[]): string[][] {
  if (tableLines.length < 2) {
    return [tableLines]
  }

  // Находим все индексы разделителей
  const separatorIndices: number[] = []
  
  for (let i = 0; i < tableLines.length; i++) {
    const line = tableLines[i]
    const cells = splitTableRow(line)
    
    // Разделитель - это строка, где все непустые ячейки содержат только дефисы
    const isSeparator = cells.length > 0 && cells.every(cell => {
      const trimmed = cell.trim()
      return trimmed === '' || /^-+$/.test(trimmed)
    }) && cells.some(cell => /^-+$/.test(cell.trim()))
    
    if (isSeparator) {
      separatorIndices.push(i)
    }
  }
  
  if (separatorIndices.length <= 1) {
    return [tableLines] // Одна таблица или нет разделителей
  }
  
  // ИСПРАВЛЕНИЕ: Правильно разделяем таблицы
  // Каждая таблица состоит из: заголовок -> разделитель -> данные (опционально)
  const tables: string[][] = []
  
  for (let i = 0; i < separatorIndices.length; i++) {
    const separatorIndex = separatorIndices[i]
    
    // Заголовок должен быть прямо перед разделителем
    const headerIndex = separatorIndex - 1
    if (headerIndex < 0) continue
    
    // Конец таблицы - до следующего заголовка (который перед следующим разделителем) или до конца
    let endIndex = tableLines.length
    if (i < separatorIndices.length - 1) {
      // Следующий заголовок начинается перед следующим разделителем
      endIndex = separatorIndices[i + 1] - 1
    }
    
    // Извлекаем таблицу: заголовок + разделитель + данные
    const table = tableLines.slice(headerIndex, endIndex)
    
    // Валидируем таблицу: минимум заголовок + разделитель
    if (table.length >= 2) {
      tables.push(table)
    }
  }
  
  return tables.length > 0 ? tables : [tableLines]
}

export function analyzeAndFixTableStructure(tableLines: string[]): { 
  fixedLines: string[], 
  expectedColumns: number 
} {
  if (tableLines.length < 2) {
    return { fixedLines: tableLines, expectedColumns: 0 }
  }

  // Parse all rows and count columns
  const rowData: Array<{ cells: string[], originalLine: string }> = []
  const columnCounts: Map<number, number> = new Map()

  for (const line of tableLines) {
    const cells = splitTableRow(line)
    const columnCount = cells.length
    
    rowData.push({ cells, originalLine: line })
    columnCounts.set(columnCount, (columnCounts.get(columnCount) || 0) + 1)
  }

  // ИСПРАВЛЕНИЕ: Всегда используем заголовок (первую строку) для определения количества столбцов
  // Это предотвращает расширение таблиц с малым количеством столбцов
  const headerCells = splitTableRow(tableLines[0])
  let expectedColumns = headerCells.length

  // Если заголовок пустой или проблемный, используем наиболее частое количество столбцов
  if (expectedColumns === 0) {
    let maxCount = 0
    for (const [columns, count] of columnCounts.entries()) {
      if (count > maxCount) {
        maxCount = count
        expectedColumns = columns
      }
    }
  }



  // Fix rows that have too many columns by merging extra cells
  // Fix separator row to match header column count
  const fixedLines: string[] = []
  
  for (let i = 0; i < rowData.length; i++) {
    const { cells, originalLine } = rowData[i]
    
    // Специальная обработка для разделительной строки (обычно индекс 1)
    if (i === 1 && cells.every(cell => /^-+$/.test(cell.trim()))) {
      // Создаем правильную разделительную строку с нужным количеством столбцов
      const separatorCells = Array(expectedColumns).fill('---')
      const fixedLine = `| ${separatorCells.join(' | ')} |`
      fixedLines.push(fixedLine)
      continue
    }
    
    if (cells.length > expectedColumns) {
      // Too many columns - merge extra cells into the last expected column
      const fixedCells = cells.slice(0, expectedColumns - 1)
      const lastCell = cells.slice(expectedColumns - 1).join(' | ')
      fixedCells.push(lastCell)
      
      // Reconstruct the line
      const fixedLine = `| ${fixedCells.join(' | ')} |`
      fixedLines.push(fixedLine)
    } else if (cells.length < expectedColumns) {
      // Too few columns - pad with empty cells
      const fixedCells = [...cells]
      while (fixedCells.length < expectedColumns) {
        fixedCells.push('')
      }
      
      // Reconstruct the line
      const fixedLine = `| ${fixedCells.join(' | ')} |`
      fixedLines.push(fixedLine)
    } else {
      // Correct number of columns
      fixedLines.push(originalLine)
    }
  }

  return { fixedLines, expectedColumns }
}

/**
 * Предварительно обрабатывает markdown контент для исправления таблиц с неэкранированными "|".
 * Используется при загрузке существующих заметок.
 * 
 * @param markdown - Исходный markdown контент
 * @returns Исправленный markdown контент
 */
export function preprocessMarkdownTables(markdown: string): string {
  if (!markdown) return markdown
  
  const lines = markdown.split('\n')
  const processedLines: string[] = []
  let i = 0
  
  while (i < lines.length) {
    const line = lines[i]
    
    // Проверяем, начинается ли строка таблицы
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      const tableLines: string[] = []
      let currentIndex = i
      
      // Собираем все строки таблицы
      while (currentIndex < lines.length && 
             lines[currentIndex].trim().startsWith('|') && 
             lines[currentIndex].trim().endsWith('|')) {
        tableLines.push(lines[currentIndex])
        currentIndex++
      }
      
      if (tableLines.length >= 2) {
        // ИСПРАВЛЕНИЕ: Сначала разделяем на отдельные таблицы, затем обрабатываем каждую
        const separateTables = splitIntoSeparateTables(tableLines)
        
        // Обрабатываем каждую таблицу отдельно
        separateTables.forEach(tableLines => {
          if (tableLines.length >= 2) {
            // Проверяем, является ли это действительно таблицей (есть ли разделитель)
            const separatorRow = splitTableRow(tableLines[1])
            const isSeparator = separatorRow.every(cell => {
              const trimmed = cell.trim()
              return trimmed === '' || /^-+$/.test(trimmed)
            }) && tableLines[1].includes('-')
            
            if (isSeparator) {
              // Это таблица - применяем исправление только к этой таблице
              const { fixedLines } = analyzeAndFixTableStructure(tableLines)
              processedLines.push(...fixedLines)
            } else {
              // Не таблица - добавляем как есть
              processedLines.push(...tableLines)
            }
          } else {
            // Менее 2 строк - добавляем как есть
            processedLines.push(...tableLines)
          }
        })
        
        i = currentIndex // Переходим к следующей строке после таблицы
        continue
      }
    }
    
    // Не таблица или одиночная строка - добавляем как есть
    processedLines.push(line)
    i++
  }
  
  return processedLines.join('\n')
}

/**
 * Применяет все markdown форматирования к тексту
 */
function applyMarkdownFormatting(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/__(.*?)__/g, '<u>$1</u>')
    .replace(/==(.*?)==/g, '<mark>$1</mark>')
    .replace(/~~(.*?)~~/g, '<s>$1</s>')
    .replace(/`(.*?)`/g, '<code class="bg-gray-100 px-1 rounded font-mono text-sm">$1</code>')
    .replace(/⏎/g, '<br>') // Преобразуем символы переноса строки в <br> теги
}

/**
 * Применяет markdown форматирования для TipTap редактора (упрощенная версия)
 */
function applyMarkdownFormattingForTipTap(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/~~(.*?)~~/g, '<s>$1</s>')
    .replace(/__(.*?)__/g, '<u>$1</u>')
    .replace(/==(.*?)==/g, '<mark>$1</mark>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code>$1</code>')
    .replace(/⏎/g, '<br>') // Преобразуем символы переноса строки в <br> теги
}

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
  
  // Если нет заголовка, но есть контент, устанавливаем "Без названия"
  if (!cleanTitle) {
    if (cleanContent) {
      return `# Без названия\n\n${cleanContent}`
    }
    return cleanContent
  }
  
  // Если есть заголовок, но нет контента
  if (!cleanContent) return `# ${cleanTitle}`
  
  // Если есть и заголовок, и контент
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
  let inCodeBlock = false
  let codeBlockContent: string[] = []
  let codeBlockLanguage = ''
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    
    // Обработка блоков кода
    if (line.trim().startsWith('```')) {
      if (!inCodeBlock) {
        // Начало блока кода
        inCodeBlock = true
        codeBlockLanguage = line.trim().replace(/^```/, '')
        codeBlockContent = []
      } else {
        // Конец блока кода
        inCodeBlock = false
        const codeContent = codeBlockContent.join('\n')
        htmlLines.push(`<pre class="bg-gray-100 p-4 rounded-lg overflow-x-auto"><code class="font-mono text-sm ${codeBlockLanguage ? `language-${codeBlockLanguage}` : ''}">${codeContent}</code></pre>`)
        codeBlockContent = []
        codeBlockLanguage = ''
      }
      continue
    }
    
    if (inCodeBlock) {
      codeBlockContent.push(line)
      continue
    }
    
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
      const formattedText = applyMarkdownFormatting(text)
      htmlLines.push(`<div class="checkbox-line"><input type="checkbox" class="mr-2 pointer-events-none"> ${formattedText}</div>`)
    } else if (/^- \[x\] (.+)$/.test(line.trim())) {
      // Отмеченный чекбокс
      const text = line.trim().replace(/^- \[x\] /, '')
      const formattedText = applyMarkdownFormatting(text)
      htmlLines.push(`<div class="checkbox-line"><input type="checkbox" checked class="mr-2 pointer-events-none"> <span class="line-through opacity-60">${formattedText}</span></div>`)
    } else if (/^- (?!\[[ x]\])(.+)$/.test(line.trim())) {
      // Буллет-лист
      const text = line.trim().replace(/^- /, '')
      const formattedText = applyMarkdownFormatting(text)
      htmlLines.push(`<div class="bullet-line">• ${formattedText}</div>`)
    } else if (/^\d+\. (.+)$/.test(line.trim())) {
      // Нумерованный список
      const match = line.trim().match(/^(\d+)\. (.+)$/)
      if (match) {
        const number = match[1]
        const text = match[2]
        const formattedText = applyMarkdownFormatting(text)
        htmlLines.push(`<div class="numbered-line">${number}. ${formattedText}</div>`)
      }
    } else if (/^> (.+)$/.test(line.trim())) {
      // Цитата
      const text = line.trim().replace(/^> /, '')
      const formattedText = applyMarkdownFormatting(text)
      htmlLines.push(`<blockquote class="border-l-4 border-gray-300 pl-4 italic">${formattedText}</blockquote>`)
    } else if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      // Обработка таблиц в markdown формате
      const tableLines: string[] = []
      let currentIndex = i
      
      // Собираем все строки таблицы
      while (currentIndex < lines.length && lines[currentIndex].trim().startsWith('|') && lines[currentIndex].trim().endsWith('|')) {
        tableLines.push(lines[currentIndex])
        currentIndex++
      }
      
      if (tableLines.length >= 2) {
        // Парсим таблицу
        const headerRow = splitTableRow(tableLines[0])
        const separatorRow = splitTableRow(tableLines[1])
        
        // Проверяем, что вторая строка - это разделитель (содержит только --- или подобное)
        const isSeparator = separatorRow.every(cell => /^-+$/.test(cell.trim()))
        
        if (isSeparator) {
          const tableRows: string[][] = []
          
          // Добавляем заголовки
          tableRows.push(headerRow)
          
          // Добавляем остальные строки данных
          for (let j = 2; j < tableLines.length; j++) {
            const dataRow = splitTableRow(tableLines[j])
            tableRows.push(dataRow)
          }
          
          // Создаем HTML таблицу с теми же стилями, что в TipTap редакторе
          const tableHtml: string[] = ['<table class="border-collapse table max-w-full min-w-[200px] border border-gray-300 relative my-4">']
          
          if (tableRows.length > 0) {
            // Заголовок
            tableHtml.push('<thead>')
            tableHtml.push('<tr>')
            tableRows[0].forEach(cell => {
              const formattedCell = applyMarkdownFormatting(cell)
              tableHtml.push(`<th class="border border-gray-300 p-2 bg-gray-50 font-semibold min-w-[50px] relative text-center" style="white-space: pre-wrap; word-wrap: break-word; vertical-align: top;">${formattedCell}</th>`)
            })
            tableHtml.push('</tr>')
            tableHtml.push('</thead>')
            
            // Тело таблицы
            if (tableRows.length > 1) {
              tableHtml.push('<tbody>')
              for (let j = 1; j < tableRows.length; j++) {
                tableHtml.push('<tr>')
                tableRows[j].forEach(cell => {
                  const formattedCell = applyMarkdownFormatting(cell)
                  tableHtml.push(`<td class="border border-gray-300 p-2 bg-white font-normal text-left min-w-[50px] relative" style="white-space: pre-wrap; word-wrap: break-word; vertical-align: top;">${formattedCell}</td>`)
                })
                tableHtml.push('</tr>')
              }
              tableHtml.push('</tbody>')
            }
          }
          
          tableHtml.push('</table>')
          htmlLines.push(tableHtml.join(''))
          
          // Добавляем пустую строку после таблицы
          htmlLines.push('<br>')
          
          // Обновляем индекс, чтобы пропустить обработанные строки таблицы
          i = currentIndex - 1
        } else {
          // Если это не таблица, обрабатываем как обычный текст
          let formattedLine = applyMarkdownFormatting(line.trim())
          htmlLines.push(formattedLine)
        }
      } else {
        // Если только одна строка с |, обрабатываем как обычный текст
        let formattedLine = applyMarkdownFormatting(line.trim())
        htmlLines.push(formattedLine)
      }
    } else if (line.trim()) {
      // Обычный текст с форматированием (только если не пустая строка)
      let formattedLine = applyMarkdownFormatting(line.trim())
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
export function normalizeContentEditableHTML(html: string): string {
  
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
  return normalized
}

/**
 * Конвертирует HTML обратно в markdown
 */
export function htmlToMarkdown(html: string, options?: { normalize?: boolean }): string {
  // По умолчанию НЕ нормализуем во время набора текста
  const shouldNormalize = Boolean(options?.normalize)
  const normalizedHtml = shouldNormalize ? normalizeContentEditableHTML(html) : html
  
  // Создаем временный элемент для парсинга
  const tempDiv = document.createElement('div')
  tempDiv.innerHTML = normalizedHtml
  
  // Обрабатываем элементы списка с учетом вложенности
  function processListItems(listElement: Element, marker: string, depth: number = 0): string {
    const items: string[] = []
    const indent = ' '.repeat(depth * INDENT_SPACES_PER_LEVEL) // Configurable spaces per indent level
    
    for (const child of Array.from(listElement.childNodes)) {
      if (child.nodeType === Node.ELEMENT_NODE && (child as Element).tagName.toLowerCase() === 'li') {
        const liElement = child as Element
        let itemContent = ''
        let nestedLists = ''
        
        // Обрабатываем содержимое li, исключая вложенные списки
        for (const liChild of Array.from(liElement.childNodes)) {
          if (liChild.nodeType === Node.ELEMENT_NODE) {
            const childElement = liChild as Element
            if (childElement.tagName.toLowerCase() === 'ul') {
              // Вложенный маркированный список
              if (childElement.getAttribute('data-type') === 'taskList') {
                nestedLists += '\n' + processTaskList(childElement, depth + 1)
              } else {
                nestedLists += '\n' + processListItems(childElement, '-', depth + 1)
              }
            } else if (childElement.tagName.toLowerCase() === 'ol') {
              // Вложенный нумерованный список
              nestedLists += '\n' + processListItems(childElement, '1.', depth + 1)
            } else {
              // Обычное содержимое
              itemContent += processNode(liChild)
            }
          } else {
            itemContent += processNode(liChild)
          }
        }
        
        if (itemContent.trim()) {
          if (marker === '1.') {
            // Для нумерованных списков нужен правильный номер
            const itemNumber = items.length + 1
            items.push(`${indent}${itemNumber}. ${itemContent.trim()}${nestedLists}`)
          } else {
            items.push(`${indent}${marker} ${itemContent.trim()}${nestedLists}`)
          }
        }
      }
    }
    
    return items.join('\n')
  }

  // Специальная функция для обработки содержимого ячеек таблицы
  function processTableCell(cell: Element): string {
    let content = ''
    
    // Обрабатываем дочерние узлы, заменяя <br> на специальный символ переноса
    for (const child of Array.from(cell.childNodes)) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        const childElement = child as Element
        if (childElement.tagName.toLowerCase() === 'br') {
          content += '⏎' // Специальный символ для переноса строки
        } else if (childElement.tagName.toLowerCase() === 'p') {
          // Специальная обработка параграфа в ячейке таблицы - заменяем <br> на ⏎
          const pContent = processTableCellParagraph(childElement)
          content += pContent
        } else {
          content += processNode(childElement)
        }
      } else if (child.nodeType === Node.TEXT_NODE) {
        content += child.textContent || ''
      }
    }
    
    return content
  }

  // Специальная функция для обработки параграфов внутри ячеек таблицы
  function processTableCellParagraph(paragraph: Element): string {
    let content = ''
    
    for (const child of Array.from(paragraph.childNodes)) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        const childElement = child as Element
        if (childElement.tagName.toLowerCase() === 'br') {
          content += '⏎' // Специальный символ для переноса строки
        } else {
          content += processNode(childElement)
        }
      } else if (child.nodeType === Node.TEXT_NODE) {
        content += child.textContent || ''
      }
    }
    
    return content
  }

  // Обрабатываем task list с учетом вложенности
  function processTaskList(listElement: Element, depth: number = 0): string {
    const items: string[] = []
    const indent = ' '.repeat(depth * INDENT_SPACES_PER_LEVEL) // Configurable spaces per indent level
    
    for (const child of Array.from(listElement.childNodes)) {
      if (child.nodeType === Node.ELEMENT_NODE && (child as Element).tagName.toLowerCase() === 'li') {
        const liElement = child as Element
        const isChecked = liElement.getAttribute('data-checked') === 'true'
        let itemContent = ''
        let nestedLists = ''
        
        // Сначала получаем основной контент из div, исключая вложенные списки
        const divElement = liElement.querySelector('div')
        if (divElement) {
          // Клонируем div и удаляем из него все вложенные ul/ol
          const clonedDiv = divElement.cloneNode(true) as Element
          const nestedListsInDiv = clonedDiv.querySelectorAll('ul, ol')
          nestedListsInDiv.forEach(list => list.remove())
          itemContent = processNode(clonedDiv)
        }
        
        // Затем обрабатываем вложенные списки отдельно
        const nestedUls = liElement.querySelectorAll(':scope > div > ul, :scope > div > ol')
        for (const nestedList of Array.from(nestedUls)) {
          if (nestedList.tagName.toLowerCase() === 'ul') {
            if (nestedList.getAttribute('data-type') === 'taskList') {
              nestedLists += '\n' + processTaskList(nestedList, depth + 1)
            } else {
              nestedLists += '\n' + processListItems(nestedList, '-', depth + 1)
            }
          } else if (nestedList.tagName.toLowerCase() === 'ol') {
            nestedLists += '\n' + processListItems(nestedList, '1.', depth + 1)
          }
        }
        
        if (itemContent.trim() || nestedLists) {
          const checkboxMarker = isChecked ? '[x]' : '[ ]'
          items.push(`${indent}- ${checkboxMarker} ${itemContent.trim()}${nestedLists}`)
        }
      }
    }
    
    return items.join('\n')
  }

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
        case 's':
        case 'del':
          return `~~${content}~~`
        case 'mark':
          return `==${content}==`
        case 'br':
          // В контексте таблицы сохраняем переносы как специальные символы
          // В других контекстах не добавляем лишние переносы
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
          // Нумерованный список - обрабатываем вложенность
          return processListItems(element, '1.')
        case 'ul':
          // Проверяем, является ли это списком задач
          if (element.getAttribute('data-type') === 'taskList') {
            // Обрабатываем task list с учетом вложенности
            return processTaskList(element)
          } else {
            // Обычный маркированный список - обрабатываем вложенность
            return processListItems(element, '-')
          }
        case 'li':
          // Элемент списка - если не обработан выше, возвращаем только содержимое
          return content
        case 'span':
          return content
        case 'blockquote':
          // Цитата - обрабатываем каждый дочерний элемент отдельно
          const quoteLines: string[] = []
          for (const child of Array.from(element.childNodes)) {
            if (child.nodeType === Node.ELEMENT_NODE && (child as Element).tagName.toLowerCase() === 'p') {
              const pContent = processNode(child).trim()
              if (pContent) {
                quoteLines.push(`> ${pContent}`)
              }
            } else if (child.nodeType === Node.TEXT_NODE && child.textContent?.trim()) {
              // Обрабатываем прямой текст в blockquote
              const textLines = child.textContent.trim().split('\n')
              textLines.forEach(line => {
                if (line.trim()) {
                  quoteLines.push(`> ${line.trim()}`)
                }
              })
            }
          }
          return quoteLines.join('\n')
        case 'code':
          // Инлайн код
          return `\`${content}\``
        case 'pre':
          // Блок кода
          const codeElement = element.querySelector('code')
          if (codeElement) {
            const language = codeElement.className.match(/language-(\w+)/)?.[1] || ''
            return `\`\`\`${language}\n${codeElement.textContent || ''}\n\`\`\``
          }
          return `\`\`\`\n${content}\n\`\`\``
        case 'table':
          // Обработка таблиц - каждая таблица обрабатывается отдельно
          const rows: string[][] = []
          const tableRows = element.querySelectorAll('tr')
          
          tableRows.forEach((row, rowIndex) => {
            const cells: string[] = []
            const rowCells = row.querySelectorAll('th, td')
            
            rowCells.forEach(cell => {
              // Специальная обработка для ячеек таблицы - сохраняем переносы строк
              let cellContent = processTableCell(cell).trim() || ' '
              // Экранируем символы "|" 
              cellContent = cellContent.replace(/\|/g, '\\|')
              cells.push(cellContent)
            })
            
            if (cells.length > 0) {
              rows.push(cells)
            }
          })
          
          if (rows.length > 0) {
            // ИСПРАВЛЕНИЕ: Используем количество колонок из ЭТОЙ таблицы, а не максимальное среди всех
            // Определяем количество колонок из первой строки (заголовков)
            const expectedCols = rows[0].length
            
            // Нормализуем все строки до количества колонок этой таблицы
            const normalizedRows = rows.map(row => {
              // Если строка имеет больше колонок, обрезаем
              if (row.length > expectedCols) {
                // Объединяем лишние колонки в последнюю
                const fixedRow = row.slice(0, expectedCols - 1)
                const lastCell = row.slice(expectedCols - 1).join(' | ')
                fixedRow.push(lastCell)
                return fixedRow
              }
              // Если строка имеет меньше колонок, дополняем пустыми
              while (row.length < expectedCols) {
                row.push(' ')
              }
              return row
            })
            
            // Создаем markdown таблицу
            const markdownRows: string[] = []
            
            // Первая строка (заголовки)
            if (normalizedRows.length > 0) {
              markdownRows.push(`| ${normalizedRows[0].join(' | ')} |`)
              
              // Разделительная строка
              const separator = Array(expectedCols).fill('---').join(' | ')
              markdownRows.push(`| ${separator} |`)
              
              // Остальные строки
              for (let i = 1; i < normalizedRows.length; i++) {
                markdownRows.push(`| ${normalizedRows[i].join(' | ')} |`)
              }
            }
            
            // ИСПРАВЛЕНИЕ: Добавляем дополнительную пустую строку для разделения таблиц
            const result = markdownRows.join('\n') + '\n\n'
            
            return result
          }
          return ''
        case 'tr':
        case 'th':
        case 'td':
          // Эти элементы обрабатываются в table
          return content
        case 'input':
          // Игнорируем input элементы, они обрабатываются в родительском элементе
          return ''
        case 'label':
          // Обрабатываем label элементы (для задач)
          return content
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

  return markdown
}

/**
 * Number of spaces per indentation level for markdown lists
 * This constant controls how many spaces constitute one level of indentation
 * when parsing and generating markdown content. The default value of 2 follows
 * common markdown conventions, but can be adjusted if needed.
 * 
 * Used by:
 * - getIndentLevel(): Calculates indentation depth from leading spaces
 * - processListItems(): Generates proper indentation for nested bullet/numbered lists
 * - processTaskList(): Generates proper indentation for nested task lists
 */
const INDENT_SPACES_PER_LEVEL = 2

/**
 * Конвертирует markdown в HTML для TipTap редактора
 */
export function markdownToTipTapHTML(markdown: string): string {
  if (!markdown.trim()) return '<p></p>'
  
  // Предварительно обрабатываем markdown для исправления таблиц
  const processedMarkdown = preprocessMarkdownTables(markdown)
  
  const lines = processedMarkdown.split('\n')
  const htmlParts: string[] = []
  let listStack: Array<{ type: 'ul' | 'ol' | 'taskList', depth: number }> = []
  let currentBlockquote: string[] = []
  let inCodeBlock = false
  let codeBlockContent: string[] = []
  let codeBlockLanguage = ''
  
  const flushListStack = () => {
    // Закрываем все открытые списки
    while (listStack.length > 0) {
      const list = listStack.pop()!
      if (list.type === 'taskList') {
        htmlParts.push('</ul>')
      } else if (list.type === 'ul') {
        htmlParts.push('</ul>')
      } else if (list.type === 'ol') {
        htmlParts.push('</ol>')
      }
    }
  }

  const flushCurrentBlockquote = () => {
    if (currentBlockquote.length > 0) {
      const blockquoteContent = currentBlockquote.map(line => `<p>${line}</p>`).join('')
      htmlParts.push(`<blockquote>${blockquoteContent}</blockquote>`)
      currentBlockquote = []
    }
  }

  /**
   * Calculates the indentation level of a line based on leading whitespaces
   * @param line - The line to analyze
   * @param spacesPerLevel - Number of spaces per indentation level (default: INDENT_SPACES_PER_LEVEL)
   * @returns The indentation level (0-based)
   */
  const getIndentLevel = (line: string, spacesPerLevel: number = INDENT_SPACES_PER_LEVEL): number => {
    const match = line.match(/^(\s*)/)
    return match ? Math.floor(match[1].length / spacesPerLevel) : 0
  }

  const adjustListStack = (targetDepth: number, newType: 'ul' | 'ol' | 'taskList') => {
    // Закрываем списки глубже чем нужно
    while (listStack.length > 0 && listStack[listStack.length - 1].depth > targetDepth) {
      const list = listStack.pop()!
      if (list.type === 'taskList') {
        htmlParts.push('</ul>')
      } else if (list.type === 'ul') {
        htmlParts.push('</ul>')
      } else if (list.type === 'ol') {
        htmlParts.push('</ol>')
      }
    }

    // Проверяем, есть ли уже список на нужной глубине
    const existingList = listStack.find(list => list.depth === targetDepth)
    
    if (existingList) {
      // Если на этой глубине уже есть список
      if (existingList.type === newType) {
        // Тот же тип - продолжаем существующий список
        return
      } else {
        // Разный тип - закрываем старый и открываем новый
        while (listStack.length > 0 && listStack[listStack.length - 1].depth >= targetDepth) {
          const list = listStack.pop()!
          if (list.type === 'taskList') {
            htmlParts.push('</ul>')
          } else if (list.type === 'ul') {
            htmlParts.push('</ul>')
          } else if (list.type === 'ol') {
            htmlParts.push('</ol>')
          }
        }
      }
    }

    // Открываем новые списки до нужной глубины
    while (listStack.length === 0 || listStack[listStack.length - 1].depth < targetDepth) {
      const currentDepth = listStack.length === 0 ? 0 : listStack[listStack.length - 1].depth + 1
      listStack.push({ type: newType, depth: currentDepth })
      
      if (newType === 'taskList') {
        htmlParts.push('<ul data-type="taskList">')
      } else if (newType === 'ul') {
        htmlParts.push('<ul>')
      } else if (newType === 'ol') {
        htmlParts.push('<ol>')
      }
    }
  }
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    
    // Обработка блоков кода
    if (line.trim().startsWith('```')) {
      if (!inCodeBlock) {
        // Начало блока кода
        flushListStack()
        flushCurrentBlockquote()
        inCodeBlock = true
        codeBlockLanguage = line.trim().replace(/^```/, '')
        codeBlockContent = []
      } else {
        // Конец блока кода
        inCodeBlock = false
        const codeContent = codeBlockContent.join('\n')
        htmlParts.push(`<pre><code class="${codeBlockLanguage ? `language-${codeBlockLanguage}` : ''}">${codeContent}</code></pre>`)
        codeBlockContent = []
        codeBlockLanguage = ''
      }
      continue
    }
    
    if (inCodeBlock) {
      codeBlockContent.push(line)
      continue
    }
    
    if (!line.trim()) {
      flushListStack()
      flushCurrentBlockquote()
      htmlParts.push('<p></p>')
    } else if (/^> (.+)$/.test(line.trim())) {
      // Цитата
      flushListStack()
      const text = line.trim().replace(/^> /, '')
      // Обрабатываем форматирование в тексте цитаты
      const formattedText = applyMarkdownFormattingForTipTap(text)
      currentBlockquote.push(formattedText)
    } else if (/^### (.+)$/.test(line.trim())) {
      flushListStack()
      flushCurrentBlockquote()
      const text = line.trim().replace(/^### /, '')
      htmlParts.push(`<h3>${text}</h3>`)
    } else if (/^## (.+)$/.test(line.trim())) {
      flushListStack()
      flushCurrentBlockquote()
      const text = line.trim().replace(/^## /, '')
      htmlParts.push(`<h2>${text}</h2>`)
    } else if (/^# (.+)$/.test(line.trim())) {
      flushListStack()
      flushCurrentBlockquote()
      const text = line.trim().replace(/^# /, '')
      htmlParts.push(`<h1>${text}</h1>`)
    } else if (/^\s*- \[ \] (.+)$/.test(line)) {
      const indentLevel = getIndentLevel(line)
      const text = line.replace(/^\s*- \[ \] /, '')
      // Обрабатываем форматирование в тексте чекбокса
      const formattedText = applyMarkdownFormattingForTipTap(text)
      
      flushCurrentBlockquote()
      adjustListStack(indentLevel, 'taskList')
      htmlParts.push(`<li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>${formattedText}</p></div></li>`)
    } else if (/^\s*- \[x\] (.+)$/.test(line)) {
      const indentLevel = getIndentLevel(line)
      const text = line.replace(/^\s*- \[x\] /, '')
      // Обрабатываем форматирование в тексте чекбокса
      const formattedText = applyMarkdownFormattingForTipTap(text)
      
      flushCurrentBlockquote()
      adjustListStack(indentLevel, 'taskList')
      htmlParts.push(`<li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked><span></span></label><div><p>${formattedText}</p></div></li>`)
    } else if (/^\s*- (?!\[[ x]\])(.+)$/.test(line)) {
      const indentLevel = getIndentLevel(line)
      const text = line.replace(/^\s*- /, '')
      // Обрабатываем форматирование в тексте списка
      const formattedText = applyMarkdownFormattingForTipTap(text)
      
      flushCurrentBlockquote()
      adjustListStack(indentLevel, 'ul')
      htmlParts.push(`<li><p>${formattedText}</p></li>`)
    } else if (/^\s*\d+\. (.+)$/.test(line)) {
      const indentLevel = getIndentLevel(line)
      const match = line.match(/^\s*(\d+)\. (.+)$/)
      if (match) {
        const text = match[2]
        // Обрабатываем форматирование в тексте списка
        const formattedText = applyMarkdownFormattingForTipTap(text)
        
        flushCurrentBlockquote()
        adjustListStack(indentLevel, 'ol')
        htmlParts.push(`<li><p>${formattedText}</p></li>`)
      }
    } else if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      // Обработка таблиц в markdown формате
      flushListStack()
      flushCurrentBlockquote()
      
      const allTableLines: string[] = []
      let currentIndex = i
      
      // Собираем все подряд идущие строки таблицы
      while (currentIndex < lines.length && lines[currentIndex].trim().startsWith('|') && lines[currentIndex].trim().endsWith('|')) {
        allTableLines.push(lines[currentIndex])
        currentIndex++
      }
      
      if (allTableLines.length >= 2) {
                // Разделяем на отдельные таблицы
        const separateTables = splitIntoSeparateTables(allTableLines)
        
        // Обрабатываем каждую таблицу отдельно
        separateTables.forEach((tableLines, tableIndex) => {
          if (tableLines.length < 2) {
            return
          }
          
          // Анализируем и исправляем структуру таблицы
          const { fixedLines, expectedColumns } = analyzeAndFixTableStructure(tableLines)
          
          // Парсим исправленную таблицу
          const headerRow = splitTableRow(fixedLines[0])
          const separatorRow = splitTableRow(fixedLines[1])
          
          // Проверяем, что вторая строка - это разделитель (содержит только --- или подобное)
          const isSeparator = separatorRow.every(cell => /^-+$/.test(cell.trim()))
          
          if (isSeparator) {
            const tableRows: string[][] = []
            
            // Добавляем заголовки
            tableRows.push(headerRow)
            
            // Добавляем остальные строки данных из исправленных строк
            for (let j = 2; j < fixedLines.length; j++) {
              const dataRow = splitTableRow(fixedLines[j])
              tableRows.push(dataRow)
            }
            
            // Создаем HTML таблицу
            const tableHtml: string[] = ['<table>']
            
            if (tableRows.length > 0) {
              // Заголовок
                                tableHtml.push('<thead>')
                  tableHtml.push('<tr>')
                  tableRows[0].forEach(cell => {
                    const formattedCell = applyMarkdownFormattingForTipTap(cell)
                    // Восстанавливаем переносы строк в ячейках заголовка
                    const cellWithBreaks = formattedCell.replace(/⏎/g, '<br>')
                    tableHtml.push(`<th>${cellWithBreaks}</th>`)
                  })
                  tableHtml.push('</tr>')
                  tableHtml.push('</thead>')
                  
                  // Тело таблицы
                  if (tableRows.length > 1) {
                    tableHtml.push('<tbody>')
                    for (let j = 1; j < tableRows.length; j++) {
                      tableHtml.push('<tr>')
                      tableRows[j].forEach(cell => {
                        const formattedCell = applyMarkdownFormattingForTipTap(cell)
                        // Восстанавливаем переносы строк в ячейках
                        const cellWithBreaks = formattedCell.replace(/⏎/g, '<br>')
                        tableHtml.push(`<td>${cellWithBreaks}</td>`)
                      })
                      tableHtml.push('</tr>')
                    }
                    tableHtml.push('</tbody>')
                  }
            }
            
            tableHtml.push('</table>')
            htmlParts.push(tableHtml.join(''))
            
            // Добавляем пустой параграф после каждой таблицы (кроме последней, чтобы не было лишнего отступа)
            htmlParts.push('<p></p>')
          }
        })
        
        // Обновляем индекс, чтобы пропустить обработанные строки таблицы
        i = currentIndex - 1
      } else {
        // Если только одна строка с |, обрабатываем как обычный текст
        let formattedLine = applyMarkdownFormattingForTipTap(line.trim())
        htmlParts.push(`<p>${formattedLine}</p>`)
      }
    } else if (line.trim()) {
      flushListStack()
      flushCurrentBlockquote()
      let formattedLine = applyMarkdownFormattingForTipTap(line.trim())
      htmlParts.push(`<p>${formattedLine}</p>`)
    }
  }
  
  flushListStack()
  flushCurrentBlockquote()
  const finalHtml = htmlParts.join('')
  return finalHtml
}

/**
 * Получает отображаемый заголовок заметки
 */
export function getNotionDisplayTitle(notion: Notion): string {
  const parsed = parseNotionContent(notion)
  
  if (parsed.title) {
    return parsed.title
  }
  
  
  // Если совсем нет содержимого - возвращаем "Без названия"
  return 'Без названия'
} 