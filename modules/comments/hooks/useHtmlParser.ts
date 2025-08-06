import { useCallback, useRef } from 'react'

interface ParsedHtmlResult {
  textLength: number
  textContent: string
}

/**
 * Хук для кеширования парсинга HTML контента
 * Избегаем создания DOM элементов при каждом рендере
 */
export function useHtmlParser() {
  const cache = useRef(new Map<string, ParsedHtmlResult>())
  
  return useCallback((htmlContent: string): ParsedHtmlResult => {
    // Проверяем кеш
    if (cache.current.has(htmlContent)) {
      return cache.current.get(htmlContent)!
    }
    
    // Парсим HTML только если нет в кеше
    if (typeof document === 'undefined') {
      // SSR fallback
      const result = { textLength: 0, textContent: '' }
      cache.current.set(htmlContent, result)
      return result
    }
    
    const tempDiv = document.createElement('div')
    tempDiv.innerHTML = htmlContent
    const textContent = tempDiv.textContent || tempDiv.innerText || ''
    
    const result: ParsedHtmlResult = {
      textLength: textContent.length,
      textContent
    }
    
    // Сохраняем в кеш
    cache.current.set(htmlContent, result)
    
    // Ограничиваем размер кеша для избежания утечек памяти
    if (cache.current.size > 100) {
      const firstKey = cache.current.keys().next().value
      if (firstKey) {
        cache.current.delete(firstKey)
      }
    }
    
    return result
  }, [])
}