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

/** CSS-классы для подсвеченного фрагмента (используются в HighlightedText). */
export const HIGHLIGHT_CLASS = 'rounded-sm bg-primary/20 px-0.5 text-primary'
