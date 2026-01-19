/**
 * AI Dashboard Module - Public API
 *
 * @module modules/ai-dashboard
 */

// Components
export { AIAnalyticsPage } from './components/AIAnalyticsPage'
export { InputSection } from './components/InputSection'
export { ResultRenderer } from './components/ResultRenderer'
export { LoadingState } from './components/LoadingState'

// Hooks
export { useAIAnalytics } from './hooks/useAIAnalytics'

// Types
export type {
  AIResponse,
  AITextResponse,
  AITableResponse,
  AIChartResponse,
  AIMixedResponse,
  AIResponseType,
  AnalyticsResult,
  AIAnalyticsState
} from './types'

// Services
export { fetchAIAnalysis } from './services/aiAgentService'
