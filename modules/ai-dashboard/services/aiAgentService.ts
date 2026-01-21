/**
 * AI Agent Service - интеграция с AI агентом
 *
 * @module modules/ai-dashboard/services/aiAgentService
 */

import type { AIResponse } from '../types'

// Mock данные для тестирования
const MOCK_RESPONSES: Record<string, AIResponse> = {
  default: {
    type: 'mixed',
    summary: '## Анализ завершен\n\nВаш запрос был обработан успешно. Система проанализировала данные и подготовила результаты.',
    data: {
      type: 'table',
      columns: ['Метрика', 'Значение'],
      rows: [
        { Метрика: 'Всего проектов', Значение: 42 },
        { Метрика: 'Активных задач', Значение: 156 },
        { Метрика: 'Завершенных задач', Значение: 89 }
      ]
    }
  },
  'проект': {
    type: 'table',
    columns: ['Название', 'Статус', 'Прогресс', 'Бюджет'],
    rows: [
      { Название: 'Проект А', Статус: 'В работе', Прогресс: '75%', Бюджет: '1,2M ₽' },
      { Название: 'Проект Б', Статус: 'Завершен', Прогресс: '100%', Бюджет: '850K ₽' },
      { Название: 'Проект В', Статус: 'Планирование', Прогресс: '20%', Бюджет: '2,5M ₽' }
    ]
  },
  'бюджет': {
    type: 'mixed',
    summary: '## Анализ бюджета\n\nОбщий бюджет всех проектов составляет **4,55M ₽**. Из них израсходовано **2,8M ₽** (61%).',
    data: {
      type: 'table',
      columns: ['Проект', 'Бюджет', 'Израсходовано', 'Остаток'],
      rows: [
        { Проект: 'Проект А', Бюджет: '1,2M ₽', Израсходовано: '900K ₽', Остаток: '300K ₽' },
        { Проект: 'Проект Б', Бюджет: '850K ₽', Израсходовано: '850K ₽', Остаток: '0 ₽' },
        { Проект: 'Проект В', Бюджет: '2,5M ₽', Израсходовано: '1,05M ₽', Остаток: '1,45M ₽' }
      ]
    }
  },
  'задач': {
    type: 'text',
    content: `## Статистика задач\n\nВсего задач в системе: **245**\n\n### Распределение по статусам:\n- ✅ Завершено: 89 (36%)\n- 🔄 В работе: 156 (64%)\n- ⏸️ На паузе: 12 (5%)\n\n### Приоритеты:\n- 🔴 Высокий: 34\n- 🟡 Средний: 128\n- 🟢 Низкий: 83`
  }
}

// Конфигурация
const USE_MOCK = process.env.NEXT_PUBLIC_AI_MOCK === 'true'

/**
 * Отправить запрос к AI агенту
 *
 * @param query - Текст запроса пользователя
 * @returns Promise<AIResponse>
 *
 * @example
 * ```typescript
 * const response = await fetchAIAnalysis('Покажи топ 5 проектов по бюджету')
 * ```
 */
export async function fetchAIAnalysis(query: string): Promise<AIResponse> {
  // Mock режим для разработки
  if (USE_MOCK) {
    console.log('[AI Service] Using MOCK mode for query:', query)

    // Симуляция задержки сети
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Ищем подходящий mock по ключевым словам
    const lowercaseQuery = query.toLowerCase()
    for (const [key, response] of Object.entries(MOCK_RESPONSES)) {
      if (lowercaseQuery.includes(key)) {
        console.log('[AI Service] Found matching mock response for keyword:', key)
        return response
      }
    }

    console.log('[AI Service] No matching keyword, returning default response')
    return MOCK_RESPONSES.default
  }

  // Real API через Next.js API route
  console.log('[AI Service] Fetching from API route')

  const response = await fetch('/api/ai-dashboard/analytics', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error || `Server error: ${response.statusText}`)
  }

  const data = await response.json()

  // Парсинг ответа от AI агента
  const parsedResponse = parseAIResponse(data)

  return parsedResponse
}

/**
 * Парсинг различных форматов ответов от AI агента
 *
 * @param data - Сырые данные от API
 * @returns AIResponse
 */
function parseAIResponse(data: any): AIResponse {
  // Вариант 1: Структурированный JSON с полем type
  if (data.type) {
    return data as AIResponse
  }

  // Вариант 2: Только текст/markdown
  if (typeof data === 'string' || data.content) {
    return {
      type: 'text',
      content: typeof data === 'string' ? data : data.content
    }
  }

  // Вариант 3: summary + data (mixed response)
  if (data.summary && data.data) {
    return {
      type: 'mixed',
      summary: data.summary,
      data: data.data
    }
  }

  // Fallback: преобразуем в JSON строку
  return {
    type: 'text',
    content: '```json\n' + JSON.stringify(data, null, 2) + '\n```'
  }
}
