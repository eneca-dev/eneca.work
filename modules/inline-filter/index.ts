/**
 * Модуль inline-filter
 *
 * Инлайн-фильтры в стиле GitHub Projects
 * Синтаксис: ключ:"значение" или ключ:значение
 *
 * @example
 * import { InlineFilter, parseFilterString, tokensToQueryParams } from '@/modules/inline-filter'
 *
 * const config = {
 *   keys: {
 *     'подразделение': { field: 'subdivision_id', label: 'Подразделение' },
 *     'проект': { field: 'project_id', label: 'Проект' },
 *     'метка': { field: 'tag_id', label: 'Метка', multiple: true },
 *   }
 * }
 *
 * // Компонент
 * <InlineFilter
 *   config={config}
 *   value={filter}
 *   onChange={setFilter}
 *   options={filterOptions}
 * />
 *
 * // Парсинг строки фильтров
 * const parsed = parseFilterString(filterString, config)
 * const queryParams = tokensToQueryParams(parsed.tokens, config)
 */

// Types
export type {
  FilterConfig,
  FilterKeyConfig,
  ParsedToken,
  ParsedFilter,
  FilterOption,
  FilterQueryParams,
  FilterKeyColor,
} from './types'

// Parser utilities
export {
  parseFilterString,
  serializeFilter,
  tokensToQueryParams,
  addOrUpdateToken,
  removeToken,
  hasActiveFilters,
  getValuesForKey,
} from './parser'

// Components
export { InlineFilter } from './components'
export type { InlineFilterProps } from './components'

// Internal components (for advanced usage - not recommended for general use)
export { FilterSuggestions, COLOR_MAP, DEFAULT_COLOR } from './components'
export type { FilterSuggestion, FilterSuggestionsProps } from './components'

// Hooks
export { useFilterContext } from './hooks'
export type { FilterInputContext, UseFilterContextOptions } from './hooks'
