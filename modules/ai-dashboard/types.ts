/**
 * Типы для AI Dashboard модуля
 *
 * @module modules/ai-dashboard/types
 */

// Типы ответов от AI агента
export type AIResponseType = 'text' | 'table' | 'chart' | 'mixed'

/**
 * Текстовый ответ (Markdown)
 */
export interface AITextResponse {
  type: 'text'
  content: string  // Markdown текст
}

/**
 * Табличный ответ
 */
export interface AITableResponse {
  type: 'table'
  columns: string[]
  rows: Record<string, any>[]
}

/**
 * Графический ответ (будущее)
 */
export interface AIChartResponse {
  type: 'chart'
  chartType: 'line' | 'bar' | 'pie'
  data: any[]  // Chart.js формат
}

/**
 * Комбинированный ответ (текст + данные)
 */
export interface AIMixedResponse {
  type: 'mixed'
  summary: string  // Markdown текст
  data: AITableResponse | AIChartResponse
}

/**
 * Универсальный тип ответа от AI агента
 */
export type AIResponse = AITextResponse | AITableResponse | AIChartResponse | AIMixedResponse

/**
 * Результат запроса к AI
 */
export interface AnalyticsResult {
  query: string
  response: AIResponse
  timestamp: Date
  executionTime?: number
}

/**
 * Состояние хука useAIAnalytics
 */
export interface AIAnalyticsState {
  isLoading: boolean
  error: string | null
  result: AnalyticsResult | null
}
