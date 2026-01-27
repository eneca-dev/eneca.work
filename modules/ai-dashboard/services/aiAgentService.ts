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
      content: {
        columns: ['Метрика', 'Значение'],
        rows: [
          ['Всего проектов', 42],
          ['Активных задач', 156],
          ['Завершенных задач', 89]
        ]
      }
    }
  },
  'проект': {
    type: 'table',
    content: {
      columns: ['Название', 'Статус', 'Прогресс', 'Бюджет'],
      rows: [
        ['Проект А', 'В работе', '75%', '1,2M BYN'],
        ['Проект Б', 'Завершен', '100%', '850K BYN'],
        ['Проект В', 'Планирование', '20%', '2,5M BYN']
      ]
    }
  },
  'бюджет': {
    type: 'mixed',
    summary: '## Анализ бюджета\n\nОбщий бюджет всех проектов составляет **4,55M BYN**. Из них израсходовано **2,8M BYN** (61%).',
    data: {
      type: 'table',
      content: {
        columns: ['Проект', 'Бюджет', 'Израсходовано', 'Остаток'],
        rows: [
          ['Проект А', '1,2M BYN', '900K BYN', '300K BYN'],
          ['Проект Б', '850K BYN', '850K BYN', '0 BYN'],
          ['Проект В', '2,5M BYN', '1,05M BYN', '1,45M BYN']
        ]
      }
    }
  },
  'задач': {
    type: 'text',
    content: `## Статистика задач\n\nВсего задач в системе: **245**\n\n### Распределение по статусам:\n- ✅ Завершено: 89 (36%)\n- 🔄 В работе: 156 (64%)\n- ⏸️ На паузе: 12 (5%)\n\n### Приоритеты:\n- 🔴 Высокий: 34\n- 🟡 Средний: 128\n- 🟢 Низкий: 83`
  },
  'график': {
    type: 'chart',
    content: {
      chartType: 'bar',
      data: [
        { month: 'Янв', revenue: 12000, expenses: 8000 },
        { month: 'Фев', revenue: 15000, expenses: 9500 },
        { month: 'Мар', revenue: 18000, expenses: 11000 },
        { month: 'Апр', revenue: 22000, expenses: 13000 },
        { month: 'Май', revenue: 25000, expenses: 15000 },
        { month: 'Июн', revenue: 28000, expenses: 16000 }
      ],
      xKey: 'month',
      yKeys: ['revenue', 'expenses'],
      title: 'Доходы и расходы по месяцам'
    }
  },
  'динамик': {
    type: 'mixed',
    summary: '## Динамика выполнения проектов\n\nАнализ показывает устойчивый рост количества завершенных задач за последние 6 месяцев.',
    data: {
      type: 'chart',
      content: {
        chartType: 'line',
        data: [
          { month: 'Янв', completed: 12, inProgress: 45 },
          { month: 'Фев', completed: 18, inProgress: 42 },
          { month: 'Мар', completed: 25, inProgress: 38 },
          { month: 'Апр', completed: 32, inProgress: 35 },
          { month: 'Май', completed: 38, inProgress: 30 },
          { month: 'Июн', completed: 45, inProgress: 28 }
        ],
        xKey: 'month',
        yKeys: ['completed', 'inProgress'],
        title: 'Динамика задач'
      }
    }
  },
  'распределение': {
    type: 'chart',
    content: {
      chartType: 'pie',
      data: [
        { category: 'Разработка', value: 45 },
        { category: 'Тестирование', value: 20 },
        { category: 'Документация', value: 15 },
        { category: 'Поддержка', value: 12 },
        { category: 'Прочее', value: 8 }
      ],
      xKey: 'category',
      yKeys: ['value'],
      title: 'Распределение задач по категориям'
    }
  },
  'дат': {
    type: 'table',
    content: {
      columns: ['Проект', 'Дата создания', 'Прогресс (%)'],
      rows: [
        ['Проект Alpha', '2024-01-15', 85],
        ['Проект Beta', '2024-02-03', 92],
        ['Проект Gamma', '2024-02-18', 67],
        ['Проект Delta', '2024-03-05', 78],
        ['Проект Epsilon', '2024-03-22', 45],
        ['Проект Zeta', '2024-04-10', 88],
        ['Проект Eta', '2024-04-28', 71],
        ['Проект Theta', '2024-05-12', 94]
      ]
    }
  },
  'радар': {
    type: 'chart',
    content: {
      chartType: 'radar',
      data: [
        { skill: 'Frontend', team1: 85, team2: 70 },
        { skill: 'Backend', team1: 90, team2: 85 },
        { skill: 'DevOps', team1: 60, team2: 80 },
        { skill: 'Testing', team1: 75, team2: 90 },
        { skill: 'Design', team1: 80, team2: 55 },
        { skill: 'PM', team1: 70, team2: 75 }
      ],
      xKey: 'skill',
      yKeys: ['team1', 'team2'],
      title: 'Сравнение навыков команд'
    }
  },
  'прогресс': {
    type: 'chart',
    content: {
      chartType: 'radialBar',
      data: [
        { name: 'Проект А', value: 85 },
        { name: 'Проект Б', value: 72 },
        { name: 'Проект В', value: 95 },
        { name: 'Проект Г', value: 58 }
      ],
      xKey: 'name',
      yKeys: ['value'],
      title: 'Прогресс проектов'
    }
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
