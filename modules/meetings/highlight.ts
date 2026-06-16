export interface HighlightSegment {
  text: string
  match: boolean
}

/**
 * Разбивает текст на сегменты, помечая вхождения query (регистронезависимо).
 * Пустой запрос → один сегмент без совпадения. Чистая функция (тестируется).
 */
export function splitHighlight(text: string, query: string): HighlightSegment[] {
  const needle = query.trim()
  if (!needle) return [{ text, match: false }]

  const lowerText = text.toLowerCase()
  const lowerNeedle = needle.toLowerCase()
  const segments: HighlightSegment[] = []

  let cursor = 0
  while (cursor < text.length) {
    const found = lowerText.indexOf(lowerNeedle, cursor)
    if (found === -1) {
      segments.push({ text: text.slice(cursor), match: false })
      break
    }
    if (found > cursor) {
      segments.push({ text: text.slice(cursor, found), match: false })
    }
    segments.push({ text: text.slice(found, found + lowerNeedle.length), match: true })
    cursor = found + lowerNeedle.length
  }

  return segments
}

/** CSS-классы для подсвеченного фрагмента (используются и в HighlightedText). */
export const HIGHLIGHT_CLASS = 'rounded-sm bg-primary/20 px-0.5 text-primary'

/**
 * Подсвечивает вхождения query внутри HTML, оборачивая их в <mark>.
 * Обходит только текстовые узлы — теги и атрибуты не затрагиваются.
 * Возвращает исходный HTML, если запрос пуст или DOM недоступен (SSR).
 * HTML должен быть предварительно очищен (DOMPurify) — функция добавляет только свои <mark>.
 */
export function highlightHtml(html: string, query: string): string {
  const needle = query.trim()
  if (!needle) return html
  if (typeof window === 'undefined' || typeof window.DOMParser === 'undefined') return html

  const doc = new window.DOMParser().parseFromString(html, 'text/html')
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT)

  const textNodes: Text[] = []
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    textNodes.push(node as Text)
  }

  const lowerNeedle = needle.toLowerCase()
  for (const textNode of textNodes) {
    const text = textNode.nodeValue ?? ''
    if (!text.toLowerCase().includes(lowerNeedle)) continue

    const fragment = doc.createDocumentFragment()
    for (const segment of splitHighlight(text, needle)) {
      if (segment.match) {
        const mark = doc.createElement('mark')
        mark.className = HIGHLIGHT_CLASS
        mark.textContent = segment.text
        fragment.appendChild(mark)
      } else {
        fragment.appendChild(doc.createTextNode(segment.text))
      }
    }
    textNode.parentNode?.replaceChild(fragment, textNode)
  }

  return doc.body.innerHTML
}
